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
    
    // WORKAROUND: $match con ObjectId está fallando con Mongoose 9.x + Node 24
    // Usar aggregate con $addFields para convertir _id a string y hacer match
    const courses = await this.model.aggregate([
      {
        $addFields: {
          idString: { $toString: '$_id' }
        }
      },
      {
        $match: {
          idString: id
        }
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
        $lookup: {
          from: 'users',
          localField: 'teachers',
          foreignField: '_id',
          as: 'teachersInfo',
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
        $addFields: {
          // Si hay teachersInfo, limpiar mainTeacherInfo para evitar confusión
          mainTeacherInfo: {
            $cond: {
              if: { $gt: [{ $size: { $ifNull: ['$teachersInfo', []] } }, 0] },
              then: null, // Si hay teachers, no mostrar mainTeacher
              else: { $arrayElemAt: ['$mainTeacherInfo', 0] }
            }
          }
        },
      },
      {
        $project: {
          idString: 0, // Remover el campo temporal
        },
      },
    ]).exec();
    
    if (courses.length === 0) {
      return null;
    }
    
    return courses[0] as unknown as ICourse;
  }

  async findById(id: string): Promise<ICourse | null> {
    // WORKAROUND: findById está roto con Mongoose 9.x + Node 24
    // Buscar en todos los cursos y comparar _id como string
    const allCourses = await this.model.find({}).exec();
    const foundCourse = allCourses.find((c: any) => String(c._id) === id);
    
    if (foundCourse) {
      return foundCourse as unknown as ICourse;
    }
    
    return null;
  }

  async update(id: string, updateData: Partial<ICourse>, unsetFields?: string[]): Promise<ICourse> {
    // WORKAROUND: findByIdAndUpdate está roto con Mongoose 9.x + Node 24
    // Buscar el curso primero
    const allCourses = await this.model.find({}).exec();
    const foundCourse = allCourses.find((c: any) => String(c._id) === id);
    
    if (!foundCourse) {
      throw new Error('Course not found.');
    }
    
    // Construir operación de actualización
    const updateOperation: any = {};
    
    if (Object.keys(updateData).length > 0) {
      updateOperation.$set = updateData;
    }
    
    if (unsetFields && unsetFields.length > 0) {
      updateOperation.$unset = {};
      unsetFields.forEach((field) => {
        updateOperation.$unset[field] = '';
      });
    }
    
    // Usar updateOne para evitar validación completa del documento
    await this.model.updateOne(
      { _id: (foundCourse as any)._id },
      updateOperation,
      { runValidators: false } // No validar todo el documento, solo los campos actualizados
    ).exec();
    
    // Obtener el curso actualizado
    const updatedCourses = await this.model.find({}).exec();
    const updatedCourse = updatedCourses.find((c: any) => String(c._id) === id);
    
    if (!updatedCourse) {
      throw new Error('Course not found after update.');
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
        $lookup: {
          from: 'users',
          localField: 'teachers',
          foreignField: '_id',
          as: 'teachersInfo',
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
        $addFields: {
          classCount: { $size: '$classes' },
          // Si hay teachersInfo, limpiar mainTeacherInfo para evitar confusión
          mainTeacherInfo: {
            $cond: {
              if: { $gt: [{ $size: { $ifNull: ['$teachersInfo', []] } }, 0] },
              then: null, // Si hay teachers, no mostrar mainTeacher
              else: { $arrayElemAt: ['$mainTeacherInfo', 0] }
            }
          }
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
        $lookup: {
          from: 'users',
          localField: 'teachers',
          foreignField: '_id',
          as: 'teachersInfo',
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
        $addFields: {
          classCount: { $size: '$classes' },
          // Si hay teachersInfo, limpiar mainTeacherInfo para evitar confusión
          mainTeacherInfo: {
            $cond: {
              if: { $gt: [{ $size: { $ifNull: ['$teachersInfo', []] } }, 0] },
              then: null, // Si hay teachers, no mostrar mainTeacher
              else: { $arrayElemAt: ['$mainTeacherInfo', 0] }
            }
          }
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
   * Prioriza el array teachers, luego mainTeacher para compatibilidad, y finalmente assignedCoursesEdit
   * @param teacherId ID del profesor
   * @returns Array de cursos asignados al profesor
   */
  async findByTeacherId(teacherId: string): Promise<ICourse[]> {
    if (!Types.ObjectId.isValid(teacherId)) {
      throw new Error('El ID del profesor proporcionado no es válido.');
    }

    const teacherObjectId = new Types.ObjectId(teacherId);

    // Buscar cursos donde el profesor está en el array teachers (prioridad)
    const teachersArrayCourses = await this.model.aggregate([
      {
        $match: {
          teachers: teacherObjectId,
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
        },
      },
      {
        $sort: { order: 1 },
      },
    ]).exec();

    // Buscar cursos donde el profesor es mainTeacher (compatibilidad, solo si no tiene teachers)
    const mainTeacherCourses = await this.model.aggregate([
      {
        $match: {
          $and: [
            { mainTeacher: teacherObjectId },
            {
              $or: [
                { teachers: { $exists: false } },
                { teachers: { $size: 0 } },
                { teachers: { $ne: teacherObjectId } }
              ]
            }
          ],
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

    // Buscar cursos donde el profesor está en assignedCoursesEdit (legacy)
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
          // Excluir cursos que ya están en teachers o mainTeacher
          $and: [
            {
              $or: [
                { teachers: { $exists: false } },
                { teachers: { $ne: teacherObjectId } }
              ]
            },
            { mainTeacher: { $ne: teacherObjectId } }
          ]
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

    // Combinar todos los resultados y eliminar duplicados
    const allCourses = [...teachersArrayCourses, ...mainTeacherCourses, ...assignedCourses];
    const uniqueCourses = allCourses.filter((course, index, self) =>
      index === self.findIndex((c) => String(c._id) === String(course._id))
    );

    return uniqueCourses as unknown as ICourse[];
  }

  async enrollStudent(courseId: string, studentId: string): Promise<ICourse> {
    if (!Types.ObjectId.isValid(courseId)) {
      throw new Error('El ID del curso proporcionado no es válido.');
    }

    if (!Types.ObjectId.isValid(studentId)) {
      throw new Error('El ID del estudiante proporcionado no es válido.');
    }

    const updatedCourse = await this.model.findByIdAndUpdate(
      new Types.ObjectId(courseId),
      {
        $addToSet: { students: new Types.ObjectId(studentId) },
      },
      { new: true }
    ).lean();

    if (!updatedCourse) {
      throw new Error('Course not found');
    }

    return updatedCourse as unknown as ICourse;
  }

  async getStudentCourses(studentId: string): Promise<ICourse[]> {
    if (!Types.ObjectId.isValid(studentId)) {
      throw new Error('El ID del estudiante proporcionado no es válido.');
    }

    const courses = await this.model.aggregate([
      {
        $match: {
          students: new Types.ObjectId(studentId),
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
        $unwind: {
          path: '$mainTeacherInfo',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'teacherIds',
          foreignField: '_id',
          as: 'teacherInfo',
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
        $sort: { createdAt: -1 },
      },
    ]).exec();

    return courses as ICourse[];
  }

  async unenrollStudent(courseId: string, studentId: string): Promise<ICourse> {
    if (!Types.ObjectId.isValid(courseId)) {
      throw new Error('El ID del curso proporcionado no es válido.');
    }

    if (!Types.ObjectId.isValid(studentId)) {
      throw new Error('El ID del estudiante proporcionado no es válido.');
    }

    const updatedCourse = await this.model.findByIdAndUpdate(
      new Types.ObjectId(courseId),
      {
        $pull: { students: new Types.ObjectId(studentId) },
      },
      { new: true }
    ).lean();

    if (!updatedCourse) {
      throw new Error('Course not found');
    }

    return updatedCourse as unknown as ICourse;
  }
}

export default CourseRepository;
