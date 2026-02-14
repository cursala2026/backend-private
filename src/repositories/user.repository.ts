import { IUser, UserSchema, IAssignedCourseEdit } from '../models/user.model';
import { IUserExtended } from '@/types/user.types';
import { Connection, Model, Types, UserStatus } from '@/models';
import { CourseSchema } from '../models/mongo/course.model';
import { logger } from '../utils';
import bcrypt from 'bcryptjs';

class UserRepository {
  private readonly model: Model<IUser>;
  private readonly courseModel: Model<any>;

  constructor(private readonly connection: Connection) {
    this.model = this.connection.model<IUser>('User', UserSchema, 'users');
    this.courseModel = this.connection.model('Course', CourseSchema, 'courses');
  }

  /**
   * Finds a single user by email.
   * @param email - The user's email.
   * @returns A promise that resolves to the user object if found, or null.
   */
  async findOneByEmail(email: string): Promise<IUser | null> {
    // Buscar de forma case-insensitive y escapando caracteres especiales
    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const res = await this.model.findOne({ email: { $regex: `^${escapeRegex(email)}$`, $options: 'i' } }).exec();
    return res as unknown as IUser | null;
  }

  /**
   * Finds a single user by exact username.
   * @param username - The user's username.
   * @returns A promise that resolves to the user object if found, or null.
   */
  async findOneByUsername(username: string): Promise<IUser | null> {
    const res = await this.model.findOne({ username }).exec();
    return res as unknown as IUser | null;
  }

  /**
   * Finds a single user by ID.
   * @param id - The user's unique identifier.
   * @returns A promise that resolves to the user object if found, or null.
   */
  async findOneById(id: string): Promise<IUser | null> {
    const res = await this.model.findById(id).exec();
    return res as unknown as IUser | null;
  }

  async findOne(user: string): Promise<IUser | null> {
    const res = await this.model
      .findOne({
        $or: [
          { username: { $regex: `^${user}$`, $options: 'i' } },
          { email: { $regex: `^${user}$`, $options: 'i' } }
        ]
      })
      .exec();
    
    return res as unknown as IUser | null;
  }

  /**
   * Saves the user object to the database.
   * @param user - The user object to save.
   * @returns A promise that resolves when the save operation is complete.
   */
  async save(user: IUser): Promise<IUser> {
    // La contraseña ya debe venir hasheada desde el servicio
    const res = await this.model.create(user as Partial<IUser>);
    return res as unknown as IUser;
  }

  async createUser(user: Partial<IUser>) {
    // La contraseña ya debe venir hasheada desde el servicio
    const res = await this.model.create(user as Partial<IUser>);
    return res as unknown as IUser;
  }

  async findById(id: string): Promise<IUser | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    // Usar findOne con el ID convertido a ObjectId es mucho más eficiente que 
    // cargar todos los usuarios. Si el entorno tiene problemas con findById,
    // findOne es la alternativa correcta.
    const res = await this.model.findOne({ _id: new Types.ObjectId(id) }).exec();
    return res as unknown as IUser | null;
  }

  async addCountriesToUser(userId: string, updatedCountries: string[]) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('El userId proporcionado no es válido.');
    }

    if (!Array.isArray(updatedCountries)) {
      throw new Error('Los países actualizados deben ser un array.');
    }

    const updatedUser = await this.model
      .findOneAndUpdate({ _id: new Types.ObjectId(userId) }, { $set: { assignedCountries: updatedCountries } }, { new: true, upsert: true })
      .exec();

    if (!updatedUser) {
      return null;
    }

    const u = updatedUser as unknown as IUser;
    return {
      userInfo: {
        _id: String(u._id),
        email: u.email,
        username: u.username,
        roles: u.roles,
      },
    };
  }

  /**
   * Updates the password reset token for a user.
   * @param userId - The user's unique identifier.
   * @param resetPasswordToken - The token to reset the user's password.
   * @returns A promise that resolves to the updated user object if successful, or null if not found.
   */
  async updatePasswordResetToken(userId: string, resetPasswordToken: string): Promise<IUser | null> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('El userId proporcionado no es válido.');
    }

    const updatedUser = await this.model.findByIdAndUpdate(userId, { $set: { resetPasswordToken } }, { new: true }).exec();
    return updatedUser as unknown as IUser | null;
  }

  async getAllUsers() {
    const res = await this.model.aggregate([
      {
        $project: {
          password: 0,
          resetPasswordToken: 0,
        },
      },
    ]).exec();

    return res as unknown as IUser[];
  }

  async getUsersPaginated(params: {
    page: number;
    limit: number;
    sort: string;
    dir: number;
    search?: string;
    role?: string;
    courseId?: string; // optional; if 'none' returns users with no assigned courses
  }) {
    const { page, limit, sort, dir, search, role, courseId } = params;
    const skip = (page - 1) * limit;

    // Build aggregation pipeline and combined search + role filter
    const pipeline: any[] = [];
    const matchConditions: any[] = [];
    if (search) {
      matchConditions.push({
        $or: [
          { email: { $regex: search, $options: 'i' } },
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
        ],
      });
    }

    if (role) {
      const r = String(role).toUpperCase();
      // Support roles stored as strings or as objects with `code` property
      matchConditions.push({
        $or: [
          { roles: { $in: [r] } },
          { 'roles.code': r },
        ],
      });
    }

    if (matchConditions.length > 0) {
      pipeline.push({ $match: { $and: matchConditions } });
    }

    const sortObj: Record<string, 1 | -1> = { [sort]: dir as 1 | -1 };

    // Build aggregation pipeline dynamically to support course filters.
    let courseObjId: Types.ObjectId | null = null;
    const isNoneFilter = courseId === 'none' || courseId === 'unassigned';
    
    if (courseId && !isNoneFilter) {
      try {
        courseObjId = new Types.ObjectId(courseId);
      } catch (err) {
        // invalid id -> return empty result set
        logger.warn('Invalid courseId provided for filter:', courseId);
        pipeline.push({ $match: { _id: { $exists: false } } });
      }
    }

    // Lookup courses where user is enrolled (checking Course.students array)
    pipeline.push({
      $lookup: {
        from: 'courses',
        let: { userId: '$_id' },
        pipeline: [
          ...(courseObjId ? [{ $match: { _id: courseObjId } }] : []),
          {
            $match: {
              $expr: {
                $gt: [
                  {
                    $size: {
                      $filter: {
                        input: { $ifNull: ['$students', []] },
                        as: 'student',
                        cond: { $eq: ['$$student.userId', '$$userId'] }
                      }
                    }
                  },
                  0
                ]
              }
            }
          },
          { $project: { _id: 1 } }
        ],
        as: 'enrolledCoursesFromCourses',
      }
    });

    // Apply course filtering
    if (courseId) {
      if (isNoneFilter) {
        // Users with NO courses assigned anywhere
        pipeline.push({
          $match: {
            $and: [
              { $expr: { $eq: [{ $size: { $ifNull: ['$enrolledCoursesFromCourses', []] } }, 0] } },
              {
                $or: [
                  { assignedCoursesEdit: { $exists: false } },
                  { assignedCoursesEdit: { $eq: [] } },
                  { $expr: { $eq: [{ $size: { $ifNull: ['$assignedCoursesEdit', []] } }, 0] } }
                ]
              }
            ]
          }
        });
      } else if (courseObjId) {
        // Users enrolled in specific course (either in Course.students OR User.assignedCoursesEdit)
        pipeline.push({
          $match: {
            $or: [
              { $expr: { $gt: [{ $size: { $ifNull: ['$enrolledCoursesFromCourses', []] } }, 0] } },
              { 'assignedCoursesEdit.courseId': courseObjId }
            ]
          }
        });
      }
    }

    // Count total with the current pipeline (without sort/skip/limit)
    const countPipeline = [...pipeline, { $count: 'count' }];
    const totalRes = await this.model.aggregate(countPipeline).exec();
    const total = (totalRes && totalRes[0] && (totalRes[0] as any).count) || 0;

    // Continue building pipeline for page results
    pipeline.push({ $sort: sortObj }, { $skip: skip }, { $limit: limit });

    // Enrich users with their enrolled courses for frontend display
    pipeline.push({
      $lookup: {
        from: 'courses',
        let: { userId: '$_id', assignedCoursesEdit: { $ifNull: ['$assignedCoursesEdit', []] } },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  {
                    $gt: [
                      {
                        $size: {
                          $filter: {
                            input: { $ifNull: ['$students', []] },
                            as: 'student',
                            cond: { $eq: ['$$student.userId', '$$userId'] }
                          }
                        }
                      },
                      0
                    ]
                  },
                  {
                    $in: ['$_id', { $map: { input: '$$assignedCoursesEdit', as: 'ac', in: '$$ac.courseId' } }]
                  }
                ]
              }
            }
          },
          {
            $project: {
              _id: 1,
              name: 1,
              title: '$name',
              imageUrl: 1,
              status: 1
            }
          }
        ],
        as: 'enrolledCourses',
      }
    });

    // Project out internal lookup fields and sensitive data
    pipeline.push({
      $project: {
        password: 0,
        resetPasswordToken: 0,
        enrolledCoursesFromCourses: 0,
      },
    });

    const usersAgg = await this.model.aggregate(pipeline).exec();

    // Debug logging
    if (courseId) {
      logger.debug(`getUsersPaginated with courseId filter: ${courseId}, found ${total} total users, returned ${usersAgg.length} users on page ${page}`);
      if (usersAgg.length > 0) {
        logger.debug(`First user sample: ${JSON.stringify({ email: usersAgg[0].email, enrolledCourses: usersAgg[0].enrolledCourses?.length || 0 })}`);
      }
    }

    return {
      data: (usersAgg as unknown) as IUser[],
      pagination: {
        page,
        page_size: limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTeachers(): Promise<IUser[]> {
    // Filtrar usuarios que tengan el rol PROFESOR en su array de roles
    // Usar $in para buscar en el array de roles
    const teachers = await this.model
      .find({ roles: { $in: ['PROFESOR'] } })
      .select('-password -resetPasswordToken')
      .sort({ firstName: 1, lastName: 1 })
      .lean()
      .exec();

    return teachers as unknown as IUser[];
  }

  /**
   * Removes a role from a user's roles.
   * @param userId - The user's unique identifier.
   * @param roleId - The role's unique identifier to be removed.
   * @returns A promise that resolves to the updated user object if successful, or null if not found.
   */
  async removeRoleFromUser(userId: string, roleId: string): Promise<IUser | null> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('El userId proporcionado no es válido.');
    }

    // roleId is actually a role code after refactor
    const updatedUser = await this.model
      .findOneAndUpdate({ _id: new Types.ObjectId(userId) }, { $pull: { roles: roleId } }, { new: true })
      .exec();

    return updatedUser as unknown as IUser | null;
  }

  /**
   * Adds a role to a user's roles.
   * @param userId - The user's unique identifier.
   * @param roleId - The role's unique identifier to be added.
   * @returns A promise that resolves to the updated user object if successful, or null if not found.
   */
  async addRoleToUser(userId: string, roleId: string): Promise<IUser | null> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('El userId proporcionado no es válido.');
    }

    // roleId is actually a role code after refactor
    const updatedUser = await this.model
      .findOneAndUpdate({ _id: new Types.ObjectId(userId) }, { $addToSet: { roles: roleId } }, { new: true })
      .exec();

    return updatedUser as unknown as IUser | null;
  }

  async changueStatus(userId: string, status: UserStatus) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('El userId proporcionado no es válido.');
    }

    const updatedUser = await this.model.findOneAndUpdate({ _id: new Types.ObjectId(userId) }, { $set: { status } }, { new: true }).exec();
    return updatedUser as unknown as IUser | null;
  }

  async toggleUserStatus(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('El userId proporcionado no es válido.');
    }

    const user = await this.model.findById(userId).exec();
    if (!user) {
      throw new Error('Usuario no encontrado.');
    }

    const userData = user as unknown as IUser;
    const newStatus = userData.status === UserStatus.ACTIVE ? UserStatus.INACTIVE : UserStatus.ACTIVE;
    const updatedUser = await this.model.findOneAndUpdate(
      { _id: new Types.ObjectId(userId) }, 
      { $set: { status: newStatus } }, 
      { new: true }
    ).exec();
    
    return updatedUser as unknown as IUser | null;
  }

  async assignCourseToUser(userId: string, courseId: string, startDate: Date, endDate: Date): Promise<IUser | null> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('El userId proporcionado no es válido.');
    }

    if (!Types.ObjectId.isValid(courseId)) {
      throw new Error('El courseId proporcionado no es válido.');
    }

    const courseData = {
      courseId: new Types.ObjectId(courseId),
      startDate,
      endDate,
    };

    const updatedUser = await this.model.findOneAndUpdate(
      { _id: new Types.ObjectId(userId), 'assignedCourses.courseId': { $ne: courseData.courseId } },
      { $push: { assignedCourses: courseData } },
      { new: true }
    ).exec();

    return updatedUser as unknown as IUser | null;
  }

  async removeCourseFromUser(userId: string, courseId: string): Promise<IUser | null> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('El userId proporcionado no es válido.');
    }

    if (!Types.ObjectId.isValid(courseId)) {
      throw new Error('El courseId proporcionado no es válido.');
    }

    const updatedUser = await this.model
      .findOneAndUpdate(
        { _id: new Types.ObjectId(userId) },
        { $pull: { assignedCourses: { courseId: new Types.ObjectId(courseId) } } },
        { new: true }
      )
      .exec();
    return updatedUser as unknown as IUser | null;
  }

  async getAssignedCourses(userId: string): Promise<{ courseId: string; name: string }[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('El userId proporcionado no es válido.');
    }

    const result = await this.model.aggregate([
      { $match: { _id: new Types.ObjectId(userId) } },
      { $unwind: '$assignedCourses' },
      {
        $lookup: {
          from: 'courses',
          localField: 'assignedCourses.courseId',
          foreignField: '_id',
          as: 'courseInfo',
        },
      },
      { $unwind: '$courseInfo' },
      {
        $project: {
          _id: 0,
          courseId: '$courseInfo._id',
          name: '$courseInfo.name',
          startDate: '$assignedCourses.startDate',
          endDate: '$assignedCourses.endDate',
        },
      },
    ]).exec();

    return (result as unknown[]).map((r: unknown) => {
      const item = r as unknown as { courseId: Types.ObjectId; name: string };
      return {
        courseId: String(item.courseId),
        name: item.name,
      };
    });
  }

  async getUnassignedCourses(userId: string): Promise<{ courseId: string; name: string }[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('El userId proporcionado no es válido.');
    }

    const assignedCourses = await this.model.aggregate([
      { $match: { _id: new Types.ObjectId(userId) } },
      {
        $project: {
          _id: 0,
          assignedCourseIds: '$assignedCourses.courseId',
        },
      },
    ]).exec();

    const assignedCourseIds = ((assignedCourses as unknown as Array<{ assignedCourseIds?: Types.ObjectId[] }>)[0]?.assignedCourseIds) || [];

    const unassignedCourses = await this.connection.model('Course').aggregate([
      {
        $match: {
          _id: { $nin: assignedCourseIds },
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
        },
      },
    ]).exec();

    return (unassignedCourses as unknown[]).map((course: unknown) => {
      const c = course as unknown as { _id: Types.ObjectId; name: string };
      return {
        courseId: String(c._id),
        name: c.name,
      };
    });
  }

  /**
   * Checks if a course is assigned to a user and if it's within the allowed time period.
   * @param userId - The user's unique identifier.
   * @param courseId - The course's unique identifier.
   * @returns A promise that resolves to an object with assignment status and validity information.
   */
  async isCourseValidForUser(
    userId: string,
    courseId: string
  ): Promise<{
    isAssigned: boolean;
    isWithinTimeRange: boolean;
    isValid: boolean;
    courseInfo?: {
      startDate: Date;
      endDate: Date;
    };
    message?: string;
  }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('El userId proporcionado no es válido.');
    }

    if (!Types.ObjectId.isValid(courseId)) {
      throw new Error('El courseId proporcionado no es válido.');
    }

    const res = await this.courseModel.aggregate([
      { $match: { _id: new Types.ObjectId(courseId) } },
      { $project: { students: 1 } },
      { $unwind: { path: '$students', preserveNullAndEmptyArrays: false } },
      { $match: { 'students.userId': new Types.ObjectId(userId) } },
      { $project: { student: '$students' } },
    ]).exec();

    if (!res || res.length === 0) {
      return {
        isAssigned: false,
        isWithinTimeRange: false,
        isValid: false,
        message: 'El curso no está asignado al usuario.',
      };
    }

    const studentEntry = (res[0] as any).student;
    const startDate = studentEntry.startDate ? new Date(studentEntry.startDate) : null;
    const endDate = studentEntry.endDate ? new Date(studentEntry.endDate) : null;
    const now = new Date();

    const isWithinTimeRange = (!startDate || now >= startDate) && (!endDate || now <= endDate);

    return {
      isAssigned: true,
      isWithinTimeRange,
      isValid: isWithinTimeRange,
      courseInfo: startDate && endDate ? { startDate, endDate } : undefined,
      message: isWithinTimeRange ? 'El curso está asignado y es válido para el período actual.' : 'El curso está asignado pero no está dentro del período permitido.',
    };
  }

  /**
   * Alternative simpler version that just returns a boolean
   * @param userId - The user's unique identifier.
   * @param courseId - The course's unique identifier.
   * @returns A promise that resolves to true if the course is assigned and valid, false otherwise.
   */
  async isCourseAccessibleForUser(userId: string, courseId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('El userId proporcionado no es válido.');
    }

    if (!Types.ObjectId.isValid(courseId)) {
      throw new Error('El courseId proporcionado no es válido.');
    }

    const user = await this.model.findById(userId).exec() as unknown as IUser | null;

    if (!user) {
      throw new Error('Usuario no encontrado.');
    }

    // Sólo comprobar membership en courses.students (source of truth)
    const result = await this.isCourseValidForUser(userId, courseId);
    return result.isValid;
  }

  async deleteUser(userId: string): Promise<Partial<IUser> | null> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('El userId proporcionado no es válido.');
    }

    const deletedUser = await this.model.findByIdAndDelete(userId).exec();

    if (!deletedUser) {
      return null;
    }

    const du = deletedUser as unknown as IUser;
    return {
      email: du.email,
      username: du.username,
      roles: du.roles,
      status: du.status,
    };
  }

  async getUserById(userId: string): Promise<IUser | null> {
    if (!Types.ObjectId.isValid(userId)) {
      logger.error('getUserById: Invalid userId received', { 
        userId, 
        type: typeof userId,
        length: userId?.length,
        value: userId 
      });
      throw new Error('El userId proporcionado no es válido.');
    }

    const user = await this.model.findById(userId, { password: 0, resetPasswordToken: 0 }).exec();

    if (!user) {
      return null;
    }

    return user as unknown as IUser | null;
  }

  async assignCourseToUserEdit(userId: string, courseId: string): Promise<IUser | null> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('El userId proporcionado no es válido.');
    }

    if (!Types.ObjectId.isValid(courseId)) {
      throw new Error('El courseId proporcionado no es válido.');
    }

    const courseData = {
      courseId: new Types.ObjectId(courseId),
    };

    const updatedUser = await this.model.findOneAndUpdate(
      { _id: new Types.ObjectId(userId), 'assignedCoursesEdit.courseId': { $ne: courseData.courseId } },
      { $push: { assignedCoursesEdit: courseData } },
      { new: true }
    ).exec();

    return updatedUser as unknown as IUser | null;
  }

  async getAssignedCoursesEdit(userId: string): Promise<{ courseId: string; name: string }[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('El userId proporcionado no es válido.');
    }

    const result = await this.model.aggregate([
      { $match: { _id: new Types.ObjectId(userId) } },
      { $unwind: '$assignedCoursesEdit' },
      {
        $lookup: {
          from: 'courses',
          localField: 'assignedCoursesEdit.courseId',
          foreignField: '_id',
          as: 'courseInfo',
        },
      },
      { $unwind: '$courseInfo' },
      {
        $project: {
          _id: 0,
          courseId: '$courseInfo._id',
          name: '$courseInfo.name',
        },
      },
    ]).exec();

    return (result as unknown[]).map((r: unknown) => {
      const item = r as unknown as { courseId: Types.ObjectId; name: string };
      return {
        courseId: String(item.courseId),
        name: item.name,
      };
    });
  }

  async getUnassignedCoursesEdit(userId: string): Promise<{ courseId: string; name: string }[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('El userId proporcionado no es válido.');
    }

    const assignedCourses = await this.model.aggregate([
      { $match: { _id: new Types.ObjectId(userId) } },
      {
        $project: {
          _id: 0,
          assignedCourseIds: '$assignedCoursesEdit.courseId',
        },
      },
    ]).exec();

    const assignedCourseIds = ((assignedCourses as unknown as Array<{ assignedCourseIds?: Types.ObjectId[] }>)[0]?.assignedCourseIds) || [];

    const unassignedCourses = await this.connection.model('Course').aggregate([
      {
        $match: {
          _id: { $nin: assignedCourseIds },
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
        },
      },
    ]).exec();

    return (unassignedCourses as unknown[]).map((course: unknown) => {
      const c = course as unknown as { _id: Types.ObjectId; name: string };
      return {
        courseId: String(c._id),
        name: c.name,
      };
    });
  }

  async removeCourseFromUserEdit(userId: string, courseId: string): Promise<IUser | null> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('El userId proporcionado no es válido.');
    }

    if (!Types.ObjectId.isValid(courseId)) {
      throw new Error('El courseId proporcionado no es válido.');
    }

    const updatedUser = await this.model
      .findOneAndUpdate(
        { _id: new Types.ObjectId(userId) },
        { $pull: { assignedCoursesEdit: { courseId: new Types.ObjectId(courseId) } } },
        { new: true }
      )
      .exec();
    return updatedUser as unknown as IUser | null;
  }

  /**
   * Updates the last connection date for a user.
   * @param userId - The user's unique identifier.
   * @param connectionDate - The date of the last connection.
   * @returns A promise that resolves to the updated user object if successful, or null if not found.
   */
  async updateLastConnection(userId: string): Promise<IUser | null> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('El userId proporcionado no es válido.');
    }

    const updatedUser = await this.model.findByIdAndUpdate(userId, { $set: { lastConnection: new Date() } }, { new: true }).exec();
    return updatedUser as unknown as IUser | null;
  }

  async updateUser(userId: string, userData: Partial<IUser>): Promise<IUser | null> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('El userId proporcionado no es válido.');
    }

    // Filtrar campos undefined y strings vacíos. Permitimos `null` explícito para borrar campos.
    const cleanedData: any = {};
    Object.keys(userData).forEach(key => {
      const value = (userData as any)[key];
      // Incluir valores que no sean undefined ni strings vacíos. `null` se conserva intencionalmente.
      if (value !== undefined && value !== '') {
        cleanedData[key] = value;
      }
    });

    // Hashear la contraseña si se está actualizando
    if (cleanedData.password) {
      const saltRounds = 10;
      cleanedData.password = await bcrypt.hash(cleanedData.password, saltRounds);
    }

    // Convertir fechas si vienen como strings y son válidas
    if (cleanedData.birthDate) {
      if (typeof cleanedData.birthDate === 'string') {
        const parsedDate = new Date(cleanedData.birthDate);
        // Verificar que la fecha es válida
        if (isNaN(parsedDate.getTime())) {
          delete cleanedData.birthDate; // Eliminar fecha inválida
        } else {
          cleanedData.birthDate = parsedDate;
        }
      }
    }

    try {
      const updatedUser = await this.model.findByIdAndUpdate(
        userId, 
        { $set: cleanedData }, 
        { new: true, runValidators: true }
      ).exec();
      return updatedUser as unknown as IUser | null;
    } catch (error) {
      console.error('Error updating user in repository:', error);
      throw error;
    }
  }

  async getUsersByAssignedCourses(courseId: string): Promise<
    {
      userId: string;
      email: string;
      username: string;
      firstName: string;
      lastName: string;
      startDate: Date;
      endDate: Date;
    }[]
  > {
    if (!Types.ObjectId.isValid(courseId)) {
      throw new Error('El courseId proporcionado no es válido.');
    }

    const users = await this.model.aggregate([
      {
        $match: {
          'assignedCourses.courseId': new Types.ObjectId(courseId),
        },
      },
      { $unwind: '$assignedCourses' },
      {
        $match: {
          'assignedCourses.courseId': new Types.ObjectId(courseId),
        },
      },
      {
        $project: {
          userId: '$_id',
          email: 1,
          username: 1,
          firstName: 1,
          lastName: 1,
          startDate: '$assignedCourses.startDate',
          endDate: '$assignedCourses.endDate',
        },
      },
    ]);

    return users.map((u) => ({
      userId: u.userId.toString(),
      email: u.email,
      username: u.username,
      firstName: u.firstName,
      lastName: u.lastName,
      startDate: u.startDate,
      endDate: u.endDate,
    }));
  }

  /**
   * Obtiene todos los alumnos asignados a los cursos de un profesor
   * Este método recibe los IDs de los cursos del profesor (obtenidos desde CourseRepository)
   * @param courseIds Array de IDs de cursos del profesor
   * @returns Array de alumnos con información del curso al que están asignados
   */
  async getStudentsByTeacherCourses(courseIds: Types.ObjectId[]): Promise<
    {
      userId: string;
      email: string;
      username: string;
      firstName: string;
      lastName: string;
      profilePhotoUrl?: string;
      courseId: string;
      courseName: string;
      startDate: Date;
      endDate: Date;
      progress: number;
      completedClasses: number;
      totalClasses: number;
      completedQuestionnaires: number;
      totalQuestionnaires: number;
    }[]
  > {
    if (!courseIds || courseIds.length === 0) {
      return [];
    }

    // Obtener alumnos desde el array students de los cursos
    // (Sistema unificado - ya no se usa assignedCourses)
    const allStudents = await this.model.aggregate([
      {
        $lookup: {
          from: 'courses',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $in: ['$_id', courseIds] },
                    { $in: ['$$userId', { $ifNull: [{ $map: { input: '$students', as: 'student', in: '$$student.userId' } }, []] }] }
                  ]
                }
              }
            }
          ],
          as: 'enrolledCourses'
        }
      },
      {
        $match: {
          enrolledCourses: { $ne: [] }
        }
      },
      { $unwind: '$enrolledCourses' },
      // Obtener el objeto student del curso para extraer startDate y endDate
      {
        $addFields: {
          studentInfo: {
            $arrayElemAt: [
              {
                $filter: {
                  input: '$enrolledCourses.students',
                  as: 'student',
                  cond: { $eq: ['$$student.userId', '$_id'] }
                }
              },
              0
            ]
          }
        }
      },
      // Lookup para contar clases activas desde la colección classes
      {
        $lookup: {
          from: 'classes',
          let: { courseId: '$enrolledCourses._id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$courseId', '$$courseId'] },
                    { $eq: ['$status', 'ACTIVE'] }
                  ]
                }
              }
            }
          ],
          as: 'classesFromCollection'
        }
      },
      // Lookup para contar cuestionarios activos del curso
      {
        $lookup: {
          from: 'questionnaires',
          let: { courseId: '$enrolledCourses._id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$courseId', '$$courseId'] },
                    { $eq: ['$status', 'ACTIVE'] }
                  ]
                }
              }
            }
          ],
          as: 'questionnairesFromCollection'
        }
      },
      // Lookup para obtener el progreso del estudiante
      {
        $lookup: {
          from: 'courseprogresses',
          let: {
            userId: '$_id',
            courseId: '$enrolledCourses._id'
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$userId', '$$userId'] },
                    { $eq: ['$courseId', '$$courseId'] }
                  ]
                }
              }
            }
          ],
          as: 'progressInfo'
        }
      },
      {
        $project: {
          uniqueKey: { $concat: [{ $toString: '$_id' }, '-', { $toString: '$enrolledCourses._id' }] },
          userId: '$_id',
          email: 1,
          username: 1,
          firstName: 1,
          lastName: 1,
          profilePhotoUrl: { $ifNull: ['$profilePhotoUrl', null] },
          courseId: '$enrolledCourses._id',
          courseName: '$enrolledCourses.name',
          totalClasses: { $size: '$classesFromCollection' },
          totalQuestionnaires: { $size: '$questionnairesFromCollection' },
          startDate: { $ifNull: ['$studentInfo.startDate', null] },
          endDate: { $ifNull: ['$studentInfo.endDate', null] },
          progressInfo: { $arrayElemAt: ['$progressInfo', 0] }
        }
      }
    ]).exec();

    return allStudents.map((s: any) => {
      // Filtrar clases duplicadas usando un Set de IDs únicos
      const completedClassIds = new Set<string>();
      if (s.progressInfo?.classesProgress) {
        s.progressInfo.classesProgress.forEach((cp: any) => {
          if (cp.completed && cp.classId) {
            completedClassIds.add(String(cp.classId));
          }
        });
      }
      const completedClasses = completedClassIds.size;
      
      // Filtrar cuestionarios duplicados usando un Set de IDs únicos
      const completedQuestionnaireIds = new Set<string>();
      if (s.progressInfo?.questionnairesProgress) {
        s.progressInfo.questionnairesProgress.forEach((qp: any) => {
          if (qp.completed && qp.questionnaireId) {
            completedQuestionnaireIds.add(String(qp.questionnaireId));
          }
        });
      }
      const completedQuestionnaires = completedQuestionnaireIds.size;
      
      const totalClasses = s.totalClasses || 0;
      const totalQuestionnaires = s.totalQuestionnaires || 0;
      
      // Recalcular el progreso total usando los valores correctos y limitar a 100%
      const totalItems = totalClasses + totalQuestionnaires;
      const completedItems = completedClasses + completedQuestionnaires;
      const calculatedProgress = totalItems > 0 
        ? Math.min(100, Math.round((completedItems / totalItems) * 100)) 
        : 0;
      
      return {
        userId: s.userId.toString(),
        email: s.email,
        username: s.username,
        firstName: s.firstName,
        lastName: s.lastName,
        profilePhotoUrl: s.profilePhotoUrl,
        courseId: s.courseId.toString(),
        courseName: s.courseName,
        startDate: s.startDate,
        endDate: s.endDate,
        progress: calculatedProgress, // Usar el progreso recalculado en lugar del almacenado
        completedClasses: completedClasses,
        totalClasses: totalClasses,
        completedQuestionnaires: completedQuestionnaires,
        totalQuestionnaires: totalQuestionnaires
      };
    });
  }

  async updateUserProfessionalData(
    userId: string,
    professionalDescription: string,
    profilePhotoUrl?: string,
    professionalSignatureUrl?: string
  ): Promise<IUserExtended | null> {
    console.log('DEBUG REPO: updateUserProfessionalData called with:', {
      userId,
      professionalDescription: professionalDescription.substring(0, 50) + '...',
      profilePhotoUrl,
      professionalSignatureUrl
    });

    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('El userId proporcionado no es válido.');
    }

    const updateData: Partial<IUserExtended> = {
      professionalDescription,
    };

    if (profilePhotoUrl !== undefined) {
      updateData.profilePhotoUrl = profilePhotoUrl || undefined;
    }

    if (professionalSignatureUrl !== undefined) {
      updateData.professionalSignatureUrl = professionalSignatureUrl || undefined;
    }

    console.log('DEBUG REPO: updateData to be applied:', updateData);

    const updatedUser = await this.model.findByIdAndUpdate(userId, { $set: updateData }, { new: true }).exec();

    const _u = updatedUser as unknown as Partial<IUserExtended> | null;
    console.log('DEBUG REPO: User after update:', {
      _id: _u?._id,
      profilePhotoUrl: _u?.profilePhotoUrl,
      professionalSignatureUrl: _u?.professionalSignatureUrl,
    });

    return updatedUser as IUserExtended | null;
  }

  /**
   * Verifica si un usuario está inscrito en un curso específico
   * @param userId - ID del usuario
   * @param courseId - ID del curso
   * @returns Promise<boolean> - true si está inscrito, false en caso contrario
   */
  async isUserEnrolledInCourse(userId: string, courseId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('El userId proporcionado no es válido.');
    }

    if (!Types.ObjectId.isValid(courseId)) {
      throw new Error('El courseId proporcionado no es válido.');
    }

    // 1. Verificar en el curso (fuente de verdad principal en el sistema actual)
    const enrollment = await this.courseModel.findOne({
      _id: new Types.ObjectId(courseId),
      'students.userId': new Types.ObjectId(userId),
    }).lean();

    if (enrollment) {
      return true;
    }

    // 2. Por compatibilidad, verificar en assignedCoursesEdit del usuario
    const user = await this.model.findOne({
      _id: new Types.ObjectId(userId),
      'assignedCoursesEdit.courseId': new Types.ObjectId(courseId),
    }).lean();

    return !!user;
  }

  /**
   * Cuenta el total de usuarios registrados
   * @returns El número total de usuarios
   */
  async countUsers(): Promise<number> {
    return this.model.countDocuments();
  }

  /**
   * Cuenta el total de estudiantes (usuarios con rol ALUMNO)
   * @returns El número total de estudiantes
   */
  async countStudents(): Promise<number> {
    return this.model.countDocuments({ roles: { $in: ['ALUMNO'] } });
  }

  /**
   * Cuenta el total de profesores (usuarios con rol PROFESOR)
   * @returns El número total de profesores
   */
  async countTeachers(): Promise<number> {
    return this.model.countDocuments({ roles: { $in: ['PROFESOR'] } });
  }

  /**
   * Cuenta el total de administradores (usuarios con rol ADMIN)
   * @returns El número total de administradores
   */
  async countAdmins(): Promise<number> {
    return this.model.countDocuments({ roles: { $in: ['ADMIN'] } });
  }

  /**
   * Obtiene los últimos usuarios registrados
   * @param limit - Número de usuarios a retornar (por defecto 5)
   * @returns Array de usuarios recientes sin información sensible
   */
  async getRecentUsers(limit: number = 5): Promise<Partial<IUser>[]> {
    const users = await this.model
      .find()
      .select('_id username email firstName lastName createdAt roles profilePhotoUrl')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    return users as Partial<IUser>[];
  }

  /**
   * Obtiene la cantidad de usuarios registrados por mes (últimos 6 meses)
   * @returns Array con objetos { month: string, count: number }
   */
  async getUsersByMonth(months: number = 6): Promise<Array<{ month: string; count: number }>> {
    const now = new Date();
    const result: Array<{ month: string; count: number }> = [];

    // Generar los últimos N meses
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

      const count = await this.model.countDocuments({
        createdAt: {
          $gte: startOfMonth,
          $lte: endOfMonth,
        },
      });

      const monthName = date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
      result.push({ month: monthName, count });
    }

    return result;
  }
}

export default UserRepository;
