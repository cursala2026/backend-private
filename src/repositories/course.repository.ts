import { CourseSchema, ICourse, Connection, Model, Types } from '@/models';

class CourseRepository {
  private readonly model: Model<ICourse>;

  constructor(private readonly connection: Connection) {
    this.model = this.connection.model<ICourse>('Course', CourseSchema, 'courses');
  }

  async findOneById(id: string): Promise<ICourse | null> {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error('El ID del curso proporcionado no es válido.');
    }
    
    const res = await this.model.aggregate([
      {
        $match: {
          _id: new Types.ObjectId(id),
        },
      },
      {
        $lookup: {
          from: 'classes',
          localField: '_id',
          foreignField: 'courseId',
          as: 'classes',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'mainTeacher',
          foreignField: '_id',
          as: 'mainTeacherInfo',
          pipeline: [
            {
              $project: {
                teacherName: { $concat: ['$firstName', ' ', '$lastName'] },
                teacherId: '$_id',
                firstName: 1,
                lastName: 1,
                email: 1,
                professionalDescription: { $ifNull: ['$professionalDescription', null] },
                profilePhotoUrl: { $ifNull: ['$profilePhotoUrl', null] },
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: 'users',
          let: { courseId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $isArray: '$assignedCoursesEdit' },
                    { $in: ['$$courseId', '$assignedCoursesEdit.courseId'] },
                  ],
                },
              },
            },
            {
              $project: {
                teacherName: { $concat: ['$firstName', ' ', '$lastName'] },
                teacherId: '$_id',
                firstName: 1,
                lastName: 1,
                email: 1,
                professionalDescription: { $ifNull: ['$professionalDescription', null] },
                profilePhotoUrl: { $ifNull: ['$profilePhotoUrl', null] },
              },
            },
          ],
          as: 'teacherInfo',
        },
      },
      {
        $addFields: {
          classCount: { $size: '$classes' },
          mainTeacherInfo: { $arrayElemAt: ['$mainTeacherInfo', 0] },
        },
      },
      {
        $project: {
          classes: 0,
        },
      },
    ]).exec();
    
    if (!res || res.length === 0) {
      return null;
    }
    
    return res[0] as unknown as ICourse;
  }

  async findById(id: string): Promise<ICourse | null> {
    const res = await this.model.findById(id).exec();
    return res as unknown as ICourse | null;
  }

  async update(id: string, updateData: Partial<ICourse>, unsetFields?: string[]): Promise<ICourse> {
    const updateOperation: Record<string, unknown> & { $unset?: Record<string, unknown> } = { $set: updateData };

    if (unsetFields && unsetFields.length > 0) {
      updateOperation.$unset = updateOperation.$unset || {};
      unsetFields.forEach((field) => {
        (updateOperation.$unset as Record<string, unknown>)[field] = '';
      });
    }

    const updateOp = updateOperation as unknown as import('mongoose').UpdateQuery<ICourse>;
    const updatedCourse = await this.model.findByIdAndUpdate(id, updateOp, { new: true }).exec();
    if (!updatedCourse) {
      throw new Error('Course not found.');
    }
    return updatedCourse as unknown as ICourse;
  }

  async create(courseData: Partial<ICourse>): Promise<ICourse> {
    // Asigna el siguiente valor de order basado en el último curso creado.
    const lastCourse = await this.model.findOne().sort({ order: -1 }).exec();
    const nextOrder = lastCourse ? (lastCourse as unknown as ICourse).order + 1 : 1;
    const payload = { ...(courseData as Partial<ICourse>), status: 'ACTIVE', order: nextOrder } as Partial<ICourse>;
    const created = await this.model.create(payload);
    return created as unknown as ICourse;
  }

  async delete(id: string): Promise<ICourse | null> {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error('El ID del curso proporcionado no es válido.');
    }
    const res = await this.model.findByIdAndDelete(id).exec();
    return res as unknown as ICourse | null;
  }

  async findAll(): Promise<ICourse[]> {
    const res = await this.model.aggregate([
      {
        $lookup: {
          from: 'classes',
          localField: '_id',
          foreignField: 'courseId',
          as: 'classes',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'mainTeacher',
          foreignField: '_id',
          as: 'mainTeacherInfo',
          pipeline: [
            {
              $project: {
                teacherName: { $concat: ['$firstName', ' ', '$lastName'] },
                teacherId: '$_id',
                firstName: 1,
                lastName: 1,
                email: 1,
                professionalDescription: { $ifNull: ['$professionalDescription', null] },
                profilePhotoUrl: { $ifNull: ['$profilePhotoUrl', null] },
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: 'users',
          let: { courseId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $isArray: '$assignedCoursesEdit' },
                    { $in: ['$$courseId', '$assignedCoursesEdit.courseId'] },
                  ],
                },
              },
            },
            {
              $project: {
                teacherName: { $concat: ['$firstName', ' ', '$lastName'] },
                teacherId: '$_id',
                firstName: 1,
                lastName: 1,
                email: 1,
                professionalDescription: { $ifNull: ['$professionalDescription', null] },
                profilePhotoUrl: { $ifNull: ['$profilePhotoUrl', null] },
              },
            },
          ],
          as: 'teacherInfo',
        },
      },
      {
        $addFields: {
          classCount: { $size: '$classes' },
          mainTeacherInfo: { $arrayElemAt: ['$mainTeacherInfo', 0] },
        },
      },
      {
        $unset: ['classes'], // Remover solo el campo classes, mantener todos los demás
      },
      {
        $sort: { order: 1 },
      },
    ]).exec();
    return res as unknown as ICourse[];
  }

  async findPublishedCourses(): Promise<ICourse[]> {
    const res = await this.model.aggregate([
      {
        $match: {
          isPublished: true, // Solo incluir cursos explícitamente publicados
        },
      },
      {
        $lookup: {
          from: 'classes',
          localField: '_id',
          foreignField: 'courseId',
          as: 'classes',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'mainTeacher',
          foreignField: '_id',
          as: 'mainTeacherInfo',
          pipeline: [
            {
              $project: {
                teacherName: { $concat: ['$firstName', ' ', '$lastName'] },
                teacherId: '$_id',
                firstName: 1,
                lastName: 1,
                email: 1,
                professionalDescription: { $ifNull: ['$professionalDescription', null] },
                profilePhotoUrl: { $ifNull: ['$profilePhotoUrl', null] },
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: 'users',
          let: { courseId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $isArray: '$assignedCoursesEdit' },
                    { $in: ['$$courseId', '$assignedCoursesEdit.courseId'] },
                  ],
                },
              },
            },
            {
              $project: {
                teacherName: { $concat: ['$firstName', ' ', '$lastName'] },
                teacherId: '$_id',
                firstName: 1,
                lastName: 1,
                email: 1,
                professionalDescription: { $ifNull: ['$professionalDescription', null] },
                profilePhotoUrl: { $ifNull: ['$profilePhotoUrl', null] },
              },
            },
          ],
          as: 'teacherInfo',
        },
      },
      {
        $addFields: {
          classCount: { $size: '$classes' },
          mainTeacherInfo: { $arrayElemAt: ['$mainTeacherInfo', 0] },
        },
      },
      {
        $project: {
          classes: 0,
        },
      },
      {
        $sort: { order: 1 },
      },
    ]).exec();
    return res as unknown as ICourse[];
  }

  async changeStatus(courseId: string, status: string): Promise<ICourse | null> {
    if (!Types.ObjectId.isValid(courseId)) {
      throw new Error('El ID del curso proporcionado no es válido.');
    }
    const res = await this.model.findByIdAndUpdate(courseId, { $set: { status } }, { new: true }).exec();
    return res as unknown as ICourse | null;
  }

  async moveUpOrder(courseId: string): Promise<ICourse | null> {
    if (!Types.ObjectId.isValid(courseId)) {
      throw new Error('El ID del curso proporcionado no es válido.');
    }
    const currentCourse = await this.model.findById(courseId).exec() as unknown as ICourse | null;
    if (!currentCourse) {
      throw new Error('Course not found.');
    }
    // Encuentra el curso inmediatamente anterior (con un order menor)
    const upperCourse = await this.model.findOne({ order: { $lt: (currentCourse as ICourse).order } }).sort({ order: -1 }).exec() as unknown as ICourse | null;
    if (!upperCourse) {
      return currentCourse;
    }
    // Intercambia los valores de order
    const tempOrder = (currentCourse as ICourse).order;
    (currentCourse as ICourse).order = (upperCourse as ICourse).order;
    (upperCourse as ICourse).order = tempOrder;
    await Promise.all([((currentCourse as unknown) as ICourse & { save: () => Promise<ICourse> }).save(), ((upperCourse as unknown) as ICourse & { save: () => Promise<ICourse> }).save()]);
    return currentCourse as unknown as ICourse;
  }

  async moveDownOrder(courseId: string): Promise<ICourse | null> {
    if (!Types.ObjectId.isValid(courseId)) {
      throw new Error('El ID del curso proporcionado no es válido.');
    }
    const currentCourse = await this.model.findById(courseId).exec() as unknown as ICourse | null;
    if (!currentCourse) {
      throw new Error('Course not found.');
    }
    // Encuentra el curso inmediatamente siguiente (con un order mayor)
    const lowerCourse = await this.model.findOne({ order: { $gt: (currentCourse as ICourse).order } }).sort({ order: 1 }).exec() as unknown as ICourse | null;
    if (!lowerCourse) {
      return currentCourse;
    }
    // Intercambia los valores de order
    const tempOrder = (currentCourse as ICourse).order;
    (currentCourse as ICourse).order = (lowerCourse as ICourse).order;
    (lowerCourse as ICourse).order = tempOrder;
    await Promise.all([((currentCourse as unknown) as ICourse & { save: () => Promise<ICourse> }).save(), ((lowerCourse as unknown) as ICourse & { save: () => Promise<ICourse> }).save()]);
    return currentCourse as unknown as ICourse;
  }

  async findForHome(): Promise<Array<Omit<ICourse, '_id'> & { _id: string }>> {
    const courses = await this.model
      .find({
        showOnHome: true,
        isPublished: true, // Solo cursos explícitamente publicados
      })
      .sort({ order: 1 })
      .lean()
      .exec(); // Devolver objetos planos

    // Convertir ObjectIds a strings para compatibilidad con promotional codes
    return (courses as unknown[]).map((course: unknown) => {
      const c = course as unknown as Record<string, unknown> & { _id?: unknown };
      return {
        ...c,
        _id: String(c._id),
      } as unknown as Omit<ICourse, '_id'> & { _id: string };
    });
  }

  async changeShowOnHome(courseId: string): Promise<ICourse | null> {
    if (!Types.ObjectId.isValid(courseId)) {
      throw new Error('El ID del curso proporcionado no es válido.');
    }
    const currentCourse = await this.model.findById(courseId).exec() as unknown as ICourse | null;
    if (!currentCourse) {
      throw new Error('Course not found.');
    }
    const res = await this.model.findByIdAndUpdate(courseId, { $set: { showOnHome: !(currentCourse as ICourse).showOnHome } }, { new: true }).exec();
    return res as unknown as ICourse | null;
  }

  async assignMainTeacher(courseId: string, mainTeacherId: Types.ObjectId | null): Promise<ICourse> {
    if (!Types.ObjectId.isValid(courseId)) {
      throw new Error('El ID del curso proporcionado no es válido.');
    }

    // If mainTeacherId is null, unset the field; otherwise, set it
    const updateOperation = mainTeacherId ? { $set: { mainTeacher: mainTeacherId } } : { $unset: { mainTeacher: '' } };

    const updateOp2 = updateOperation as unknown as import('mongoose').UpdateQuery<ICourse>;
    const updatedCourse = await this.model.findByIdAndUpdate(courseId, updateOp2, { new: true }).exec();
    if (!updatedCourse) {
      throw new Error('Course not found.');
    }
    return updatedCourse as unknown as ICourse;
  }

  /**
   * Cuenta el total de cursos
   * @returns El número total de cursos
   */
  async countCourses(): Promise<number> {
    return this.model.countDocuments();
  }

  /**
   * Obtiene todos los cursos asignados a un profesor
   * Incluye cursos donde el profesor es mainTeacher o está en assignedCoursesEdit
   * @param teacherId ID del profesor
   * @returns Array de cursos asignados al profesor
   */
  async findByTeacherId(teacherId: string): Promise<ICourse[]> {
    if (!Types.ObjectId.isValid(teacherId)) {
      throw new Error('El ID del profesor proporcionado no es válido.');
    }

    const teacherObjectId = new Types.ObjectId(teacherId);

    // Buscar cursos donde el profesor es mainTeacher
    const mainTeacherCourses = await this.model.aggregate([
      {
        $match: {
          mainTeacher: teacherObjectId,
        },
      },
      {
        $lookup: {
          from: 'classes',
          localField: '_id',
          foreignField: 'courseId',
          as: 'classes',
        },
      },
      {
        $addFields: {
          classCount: { $size: '$classes' },
          isMainTeacher: true,
        },
      },
      {
        $project: {
          classes: 0,
        },
      },
      {
        $sort: { order: 1 },
      },
    ]).exec();

    // Buscar cursos donde el profesor está en assignedCoursesEdit
    const assignedCourses = await this.model.aggregate([
      {
        $lookup: {
          from: 'users',
          let: { courseId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$_id', teacherObjectId] },
                    { $isArray: '$assignedCoursesEdit' },
                    { $in: ['$$courseId', '$assignedCoursesEdit.courseId'] },
                  ],
                },
              },
            },
          ],
          as: 'teacherMatch',
        },
      },
      {
        $match: {
          teacherMatch: { $ne: [] },
        },
      },
      {
        $lookup: {
          from: 'classes',
          localField: '_id',
          foreignField: 'courseId',
          as: 'classes',
        },
      },
      {
        $addFields: {
          classCount: { $size: '$classes' },
          isMainTeacher: false,
        },
      },
      {
        $project: {
          classes: 0,
          teacherMatch: 0,
        },
      },
      {
        $sort: { order: 1 },
      },
    ]).exec();

    // Combinar ambos resultados y eliminar duplicados
    const allCourses = [...mainTeacherCourses, ...assignedCourses];
    const uniqueCourses = allCourses.filter((course, index, self) =>
      index === self.findIndex((c) => String(c._id) === String(course._id))
    );

    return uniqueCourses as unknown as ICourse[];
  }
}

export default CourseRepository;
