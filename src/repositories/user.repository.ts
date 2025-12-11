import { IUser, UserSchema, IAssignedCourse, IAssignedCourseEdit } from '../models/user.model';
import { IUserExtended } from '@/types/user.types';
import { Connection, Model, Types, UserStatus } from '@/models';
import { logger } from '../utils';

class UserRepository {
  private readonly model: Model<IUser>;

  constructor(private readonly connection: Connection) {
    this.model = this.connection.model<IUser>('User', UserSchema, 'users');
  }

  /**
   * Finds a single user by email.
   * @param email - The user's email.
   * @returns A promise that resolves to the user object if found, or null.
   */
  async findOneByEmail(email: string): Promise<IUser | null> {
    const res = await this.model.findOne({ email }).exec();
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
    const res = await this.model.create(user as Partial<IUser>);
    return res as unknown as IUser;
  }

  async createUser(user: Partial<IUser>) {
    const res = await this.model.create(user as Partial<IUser>);
    return res as unknown as IUser;
  }

  async findById(id: string): Promise<IUser | null> {
    const res = await this.model.findById(id).exec();
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
      // Lookup by role code (roles stored as strings). For backward compatibility,
      // allow matching by _id if roles contain ObjectId-like hex strings.
      {
        $lookup: {
          from: 'roles',
          localField: 'roles',
          foreignField: 'code',
          as: 'roleDetails',
        },
      },
      {
        $project: {
          password: 0,
          resetPasswordToken: 0,
          roleDetails: {
            password: 0,
            resetPasswordToken: 0,
          },
        },
      },
      {
        $addFields: {
          roleNames: {
            $map: {
              input: '$roleDetails',
              as: 'role',
              in: '$$role.name',
            },
          },
        },
      },
      {
        $project: {
          roleDetails: 0,
        },
      },
    ]).exec();

    return res as unknown as IUser[];
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

    const user = await this.model.findById(userId).exec() as unknown as IUser | null;

    if (!user) {
      throw new Error('Usuario no encontrado.');
    }

    // Buscar el curso en los cursos asignados
    const assignedCourse = user.assignedCourses?.find((course: IAssignedCourse) => course.courseId.toString() === courseId);

    if (!assignedCourse) {
      return {
        isAssigned: false,
        isWithinTimeRange: false,
        isValid: false,
        message: 'El curso no está asignado al usuario.',
      };
    }

    // Verificar si estamos dentro del rango de fechas permitido
    const currentDate = new Date();
    const startDate = new Date(assignedCourse.startDate);
    const endDate = new Date(assignedCourse.endDate);

    const isWithinTimeRange = currentDate >= startDate && currentDate <= endDate;

    return {
      isAssigned: true,
      isWithinTimeRange,
      isValid: isWithinTimeRange,
      courseInfo: {
        startDate: assignedCourse.startDate,
        endDate: assignedCourse.endDate,
      },
      message: isWithinTimeRange
        ? 'El curso está asignado y es válido para el período actual.'
        : 'El curso está asignado pero no está dentro del período permitido.',
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

    // Verificar si el curso está en assignedCoursesEdit
    const isInEditCourses = user.assignedCoursesEdit?.some((course: IAssignedCourseEdit) => course.courseId.toString() === courseId);

    if (isInEditCourses) {
      return true;
    }

    // Si no está en assignedCoursesEdit, hacer la validación actual
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
      assignedCourses: du.assignedCourses,
      status: du.status,
    };
  }

  async getUserById(userId: string): Promise<IUser | null> {
    if (!Types.ObjectId.isValid(userId)) {
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

    const updatedUser = await this.model.findByIdAndUpdate(userId, { $set: userData }, { new: true }).exec();
    return updatedUser as unknown as IUser | null;
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

    const user = await this.model.findOne({
      _id: new Types.ObjectId(userId),
      $or: [
        { 'assignedCourses.courseId': new Types.ObjectId(courseId) },
        { 'assignedCoursesEdit.courseId': new Types.ObjectId(courseId) },
      ],
    }).exec() as unknown as IUser | null;

    return !!user;
  }

  /**
   * Cuenta el total de usuarios registrados
   * @returns El número total de usuarios
   */
  async countUsers(): Promise<number> {
    return this.model.countDocuments();
  }
}

export default UserRepository;
