import { logger } from '../utils';
import { ClassSchema, IClassData } from '@/models/mongo/class.model';
import { Connection, Model, Types } from '@/models';
import { stringToObjectId } from '@/utils/objectIdToString.util';
import { ClassDoc } from '@/models/mongo/class.model';

class ClassRepository {
  private readonly model: Model<IClassData>;
  private anyModel: import('@/models/mongo/genericMongo.model').AnyModel<IClassData>;

  constructor(private readonly connection: Connection) {
    this.model = this.connection.model<IClassData>('Class', ClassSchema, 'classes');
    this.anyModel = this.model as import('@/models/mongo/genericMongo.model').AnyModel<IClassData>;
  }

  /**
   * Encuentra una clase por su ID.
   * @param id - ID de la clase.
   * @returns La clase encontrada o null si no existe.
   */
  async findOneById(id: string): Promise<ClassDoc | null> {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error('El ID de la clase proporcionado no es válido.');
    }
    const res = await this.model.findById(id).exec();
    return res as unknown as ClassDoc | null;
  }

  /**
   * Crea una nueva clase.
   * @param classData - Datos de la clase a crear.
   * @returns La clase creada.
   */
  // Código corregido en el repositorio
  async create(classData: Partial<IClassData>): Promise<ClassDoc> {
    if (!classData.courseId) {
      throw new Error('El ID del curso proporcionado no es válido.');
    }

    // Corrige la conversión: convierte directamente el string a ObjectId
    const courseIdArray = stringToObjectId([classData.courseId.toString()]);
    const courseId = courseIdArray[0];

    const lastClase = await this.model.findOne().sort({ order: -1 }).exec();
    const nextOrder = lastClase ? (lastClase as unknown as { order: number }).order + 1 : 1;

    try {
      const created = (await this.anyModel.create({
        ...classData,
        courseId, // ObjectId correcto
        status: 'ACTIVE',
        order: nextOrder,
      } as Partial<IClassData>) ) as unknown as ClassDoc;
      return created;
    } catch (error) {
      logger.error(`Error creating class: ${error}`);
      throw new Error('Error creating class.');
    }
  }

  /**
   * Actualiza una clase existente.
   * @param id - ID de la clase.
   * @param updateData - Datos a actualizar.
   * @returns La clase actualizada.
   */
  async update(id: string, updateData: Partial<IClassData>): Promise<ClassDoc> {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error('El ID de la clase proporcionado no es válido.');
    }
    const updatedClass = await this.model.findByIdAndUpdate(id, updateData, { new: true }).exec() as ClassDoc | null;
    if (!updatedClass) {
      throw new Error('Class not found.');
    }
    return updatedClass;
  }

  /**
   * Actualiza una clase existente usando operadores de MongoDB.
   * @param id - ID de la clase.
   * @param updateQuery - Query con operadores de MongoDB ($set, $unset, etc.).
   * @returns La clase actualizada.
   */
  async updateWithOperators(id: string, updateQuery: Record<string, unknown>): Promise<ClassDoc> {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error('El ID de la clase proporcionado no es válido.');
    }
    const updateQ = updateQuery as unknown as import('mongoose').UpdateQuery<IClassData>;
    const updatedClass = await this.model.findByIdAndUpdate(id, updateQ, { new: true }).exec() as ClassDoc | null;
    if (!updatedClass) {
      throw new Error('Class not found.');
    }
    return updatedClass;
  }

  /**
   * Elimina una clase por su ID.
   * @param id - ID de la clase.
   * @returns La clase eliminada o null si no existe.
   */
  async delete(id: string): Promise<ClassDoc | null> {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error('El ID de la clase proporcionado no es válido.');
    }
    const res = await this.model.findByIdAndDelete(id).exec();
    return res as unknown as ClassDoc | null;
  }

  /**
   * Encuentra todas las clases de un curso específico.
   * @param courseId - ID del curso.
   * @returns Lista de clases ordenadas por su campo `order`.
   */
  async findAllByCourse(courseId: string): Promise<ClassDoc[]> {
    if (!Types.ObjectId.isValid(courseId)) {
      throw new Error('El ID del curso proporcionado no es válido.');
    }
    const classes = await this.model.find({ courseId: new Types.ObjectId(courseId) }).sort({ order: 1 }).exec();
    return classes as unknown as ClassDoc[];
  }

  /**
   * Cambia el estado de una clase.
   * @param classId - ID de la clase.
   * @param status - Nuevo estado (ACTIVE, INACTIVE, etc.).
   * @returns La clase actualizada.
   */
  async changeStatus(classId: string, status: string): Promise<ClassDoc | null> {
    if (!Types.ObjectId.isValid(classId)) {
      throw new Error('El ID de la clase proporcionado no es válido.');
    }
    const res = await this.model.findByIdAndUpdate(classId, { $set: { status } }, { new: true }).exec();
    return res as unknown as ClassDoc | null;
  }

  /**
   * Mueve una clase hacia arriba en el orden.
   * @param classId - ID de la clase.
   * @returns La clase actualizada.
   */
  async moveUpOrder(classId: string): Promise<ClassDoc | null> {
    if (!Types.ObjectId.isValid(classId)) {
      throw new Error('El ID de la clase proporcionado no es válido.');
    }
    const currentClass = await this.model.findById(classId).exec() as ClassDoc | null;
    if (!currentClass) {
      throw new Error('Class not found.');
    }

    // Encuentra la clase inmediatamente anterior (con un order menor)
    const upperClass = await this.model
      .findOne({ courseId: currentClass.courseId, order: { $lt: currentClass.order } })
      .sort({ order: -1 })
      .exec() as unknown as ClassDoc | null;

    if (!upperClass) {
      return currentClass;
    }

    // Intercambia los valores de order
    const tempOrder = currentClass.order;
    currentClass.order = upperClass.order;
    upperClass.order = tempOrder;

    const currentClassTyped = currentClass as unknown as ClassDoc;
    const upperClassTyped = upperClass as unknown as ClassDoc;
    await Promise.all([currentClassTyped.save(), upperClassTyped.save()]);
    return currentClassTyped;
  }

  /**
   * Mueve una clase hacia abajo en el orden.
   * @param classId - ID de la clase.
   * @returns La clase actualizada.
   */
  async moveDownOrder(classId: string): Promise<ClassDoc | null> {
    if (!Types.ObjectId.isValid(classId)) {
      throw new Error('El ID de la clase proporcionado no es válido.');
    }
    const currentClass = await this.model.findById(classId).exec() as ClassDoc | null;
    if (!currentClass) {
      throw new Error('Class not found.');
    }

    // Encuentra la clase inmediatamente siguiente (con un order mayor)
    const lowerClass = await this.model
      .findOne({ courseId: currentClass.courseId, order: { $gt: currentClass.order } })
      .sort({ order: 1 })
      .exec() as unknown as ClassDoc | null;

    if (!lowerClass) {
      return currentClass;
    }

    // Intercambia los valores de order
    const tempOrder = currentClass.order;
    currentClass.order = lowerClass.order;
    lowerClass.order = tempOrder;

    const currentClassTyped = currentClass as unknown as ClassDoc;
    const lowerClassTyped = lowerClass as unknown as ClassDoc;
    await Promise.all([currentClassTyped.save(), lowerClassTyped.save()]);
    return currentClassTyped;
  }

  /**
   * Actualiza la configuración del examen para una clase.
   * @param classId - ID de la clase.
   * @param examConfig - Configuración del examen.
   * @returns La clase actualizada.
   */
  async updateExamConfig(classId: string, examConfig: Partial<IClassData['examConfig']>): Promise<ClassDoc | null> {
    if (!Types.ObjectId.isValid(classId)) {
      throw new Error('El ID de la clase proporcionado no es válido.');
    }

    if (!examConfig) {
      throw new Error('La configuración del examen es requerida.');
    }

    const updateData: Record<string, unknown> = {};

    if (examConfig.examLink !== undefined) {
      updateData['examConfig.examLink'] = examConfig.examLink;
    }
    if (examConfig.examVisible !== undefined) {
      updateData['examConfig.examVisible'] = examConfig.examVisible;
    }
    if (examConfig.examStartDate !== undefined) {
      updateData['examConfig.examStartDate'] = examConfig.examStartDate;
    }
    if (examConfig.examEndDate !== undefined) {
      updateData['examConfig.examEndDate'] = examConfig.examEndDate;
    }

    const updatedClass = await this.model.findByIdAndUpdate(classId, { $set: updateData }, { new: true, runValidators: true }).exec() as ClassDoc | null;

    if (!updatedClass) {
      throw new Error('Class not found.');
    }

    return updatedClass;
  }

  /**
   * Obtiene la configuración del examen de una clase.
   * @param classId - ID de la clase.
   * @returns La configuración del examen.
   */
  async getExamConfig(classId: string): Promise<IClassData['examConfig'] | null> {
    if (!Types.ObjectId.isValid(classId)) {
      throw new Error('El ID de la clase proporcionado no es válido.');
    }

    const classData = await this.model.findById(classId).select('examConfig').exec();
    const c = classData as unknown as ClassDoc | null;
    return c?.examConfig || null;
  }
}

export default ClassRepository;
