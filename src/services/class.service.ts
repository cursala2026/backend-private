import fs from 'fs';
import path from 'path';
import {
  parseArgentinaDateFromFrontend,
  isStartBeforeEndArgentina,
  isInFutureArgentina,
  getCurrentArgentinaTime,
  formatArgentinaDate,
  formatForFrontend,
} from '../utils';
import { IClassData } from '@/models';
import ClassRepository from '@/repositories/class.repository';

export default class ClassService {
  constructor(private readonly classRepository: ClassRepository) {}

  /**
   * Encuentra una clase por su ID.
   * @param id - ID de la clase.
   * @returns La clase encontrada o null si no existe, con fechas formateadas para Argentina.
   */
  async findOneById(id: string): Promise<any> {
    const classData = await this.classRepository.findOneById(id);

    if (!classData) {
      return null;
    }

    // Formatear fechas del examen si existen
    if (classData.examConfig) {
      return {
        ...JSON.parse(JSON.stringify(classData)),
        examConfig: {
          examLink: classData.examConfig.examLink,
          examVisible: classData.examConfig.examVisible,
          examStartDate: classData.examConfig.examStartDate
            ? formatForFrontend(classData.examConfig.examStartDate)
            : null,
          examEndDate: classData.examConfig.examEndDate ? formatForFrontend(classData.examConfig.examEndDate) : null,
        },
      };
    }

    return classData;
  }

  /**
   * Crea una nueva clase.
   * @param classData - Datos de la clase a crear.
   * @returns La clase creada.
   */
  async create(classData: Partial<IClassData>): Promise<IClassData> {
    return this.classRepository.create(classData);
  }

  /**
   * Actualiza una clase existente.
   * @param id - ID de la clase.
   * @param updateData - Datos a actualizar.
   * @returns La clase actualizada.
   */
  async update(id: string, updateData: Partial<IClassData>): Promise<IClassData> {
    return this.classRepository.update(id, updateData);
  }

  /**
   * Actualiza una clase existente usando operadores de MongoDB.
   * @param id - ID de la clase.
   * @param updateQuery - Query con operadores de MongoDB ($set, $unset, etc.).
   * @returns La clase actualizada.
   */
  async updateWithOperators(id: string, updateQuery: Record<string, unknown>): Promise<IClassData> {
    const updateQ = updateQuery as unknown as import('mongoose').UpdateQuery<IClassData>;
    return this.classRepository.updateWithOperators(id, updateQ);
  }

  /**
   * Elimina una clase por su ID.
   * @param id - ID de la clase.
   * @returns La clase eliminada o null si no existe.
   */
  async delete(id: string): Promise<IClassData | null> {
    // Obtiene la clase antes de eliminarla para saber los archivos asociados
    const classData = await this.classRepository.findOneById(id);
    if (!classData) return null;

    // Elimina la clase del repositorio
    const deletedClass = await this.classRepository.delete(id);

    // Elimina archivos asociados si existen
    if (classData.imageUrl) {
      const imagePath = path.join(__dirname, '../static/images', classData.imageUrl);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    if (classData.videoUrl) {
      const videoPath = path.join(__dirname, '../static/videos', classData.videoUrl);
      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
      }
    }
    // Elimina archivos de material de apoyo si existen
    if (classData.supportMaterials && Array.isArray(classData.supportMaterials)) {
      classData.supportMaterials.forEach((materialFileName) => {
        const materialPath = path.join(__dirname, '../static/supportMaterials', materialFileName);
        if (fs.existsSync(materialPath)) {
          fs.unlinkSync(materialPath);
        }
      });
    }

    return deletedClass;
  }

  /**
   * Encuentra todas las clases de un curso específico.
   * @param courseId - ID del curso.
   * @returns Lista de clases ordenadas por su campo `order`, con fechas formateadas para Argentina.
   */
  async findAllByCourse(courseId: string): Promise<any[]> {
    const classes = await this.classRepository.findAllByCourse(courseId);

    // Formatear fechas de examen en cada clase
    const result = classes.map((classData) => {
      const baseClassData = JSON.parse(JSON.stringify(classData));

      if (classData.examConfig) {
        return {
          ...baseClassData,
          examConfig: {
            examLink: classData.examConfig.examLink,
            examVisible: classData.examConfig.examVisible,
            examStartDate: classData.examConfig.examStartDate
              ? formatForFrontend(classData.examConfig.examStartDate)
              : null,
            examEndDate: classData.examConfig.examEndDate ? formatForFrontend(classData.examConfig.examEndDate) : null,
          },
        };
      }

      return baseClassData;
    });

    return result;
  }

  /**
   * Cambia el estado de una clase.
   * @param classId - ID de la clase.
   * @param status - Nuevo estado (ACTIVE, INACTIVE, etc.).
   * @returns La clase actualizada.
   */
  async changeStatus(classId: string, status: string): Promise<IClassData | null> {
    return this.classRepository.changeStatus(classId, status);
  }

  /**
   * Mueve una clase hacia arriba en el orden.
   * @param classId - ID de la clase.
   * @returns La clase actualizada.
   */
  async moveUpOrder(classId: string): Promise<IClassData | null> {
    return this.classRepository.moveUpOrder(classId);
  }

  /**
   * Mueve una clase hacia abajo en el orden.
   * @param classId - ID de la clase.
   * @returns La clase actualizada.
   */
  async moveDownOrder(classId: string): Promise<IClassData | null> {
    return this.classRepository.moveDownOrder(classId);
  }

  /**
   * Obtiene la imagen de una clase.
   * @param imageFileName - Nombre del archivo de la imagen.
   * @returns El contenido de la imagen como Buffer o null si no existe.
   */
  async getClassImage(imageFileName: string): Promise<Buffer | null> {
    try {
      const filePath = path.join(__dirname, '../static/images', imageFileName);
      if (!fs.existsSync(filePath)) {
        return null;
      }
      return fs.readFileSync(filePath);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error reading class image: ${error.message}`);
      }
      throw new Error('Unknown error reading class image');
    }
  }

  /**
   * Obtiene el video de una clase.
   * @param videoFileName - Nombre del archivo del video.
   * @returns El contenido del video como Buffer o null si no existe.
   */
  async getClassVideo(videoFileName: string): Promise<Buffer | null> {
    try {
      const filePath = path.join(__dirname, '../static/videos', videoFileName);
      if (!fs.existsSync(filePath)) {
        return null;
      }
      return fs.readFileSync(filePath);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error reading class video: ${error.message}`);
      }
      throw new Error('Unknown error reading class video');
    }
  }

  /**
   * Actualiza la configuración del examen para una clase.
   * @param classId - ID de la clase.
   * @param examConfig - Configuración del examen.
   * @returns La clase actualizada.
   */
  async updateExamConfig(classId: string, examConfig: Partial<IClassData['examConfig']>): Promise<IClassData | null> {
    if (!examConfig) {
      throw new Error('La configuración del examen es requerida');
    }

    // Crear una copia local para evitar mutación del parámetro
    const configToUpdate = { ...examConfig };

    // Validaciones de negocio con timezone argentino
    if (configToUpdate.examStartDate && configToUpdate.examEndDate) {
      try {
        const startDate = parseArgentinaDateFromFrontend(configToUpdate.examStartDate.toString());
        const endDate = parseArgentinaDateFromFrontend(configToUpdate.examEndDate.toString());

        if (!isStartBeforeEndArgentina(startDate, endDate)) {
          throw new Error('La fecha de fin del examen debe ser posterior a la fecha de inicio (Hora Argentina)');
        }

        // Actualizar configToUpdate con las fechas convertidas
        configToUpdate.examStartDate = startDate;
        configToUpdate.examEndDate = endDate;
      } catch (error) {
        throw new Error(`Error procesando fechas del examen: ${(error as Error).message}`);
      }
    }

    if (configToUpdate.examLink && configToUpdate.examVisible) {
      // Validar que si se está activando el examen, tenga link
      if (!configToUpdate.examLink.trim()) {
        throw new Error('El link del examen es obligatorio cuando el examen está visible');
      }
    }

    return this.classRepository.updateExamConfig(classId, configToUpdate);
  }

  /**
   * Obtiene la configuración del examen de una clase.
   * @param classId - ID de la clase.
   * @returns La configuración del examen con fechas formateadas para Argentina.
   */
  async getExamConfig(classId: string): Promise<any> {
    const examConfig = await this.classRepository.getExamConfig(classId);

    if (!examConfig) {
      return null;
    }

    // Formatear fechas para el frontend con timezone argentino
    const formattedConfig = {
      examLink: examConfig.examLink,
      examVisible: examConfig.examVisible,
      examStartDate: examConfig.examStartDate ? formatForFrontend(examConfig.examStartDate) : null,
      examEndDate: examConfig.examEndDate ? formatForFrontend(examConfig.examEndDate) : null,
    };

    return formattedConfig;
  }

  /**
   * Activa un examen para una clase con validaciones completas.
   * @param classId - ID de la clase.
   * @param examData - Datos completos del examen.
   * @returns La clase actualizada.
   */
  async activateExam(
    classId: string,
    examData: {
      examLink: string;
      examStartDate: string;
      examEndDate: string;
    }
  ): Promise<IClassData | null> {
    // Validaciones
    if (!examData.examLink?.trim()) {
      throw new Error('El link del examen es obligatorio');
    }

    if (!examData.examStartDate || !examData.examEndDate) {
      throw new Error('Las fechas de inicio y fin son obligatorias');
    }

    let startDate: Date;
    let endDate: Date;

    try {
      startDate = parseArgentinaDateFromFrontend(examData.examStartDate);
      endDate = parseArgentinaDateFromFrontend(examData.examEndDate);
    } catch (error) {
      throw new Error(`Formato de fecha inválido: ${(error as Error).message}`);
    }

    if (!isStartBeforeEndArgentina(startDate, endDate)) {
      throw new Error('La fecha de fin debe ser posterior a la fecha de inicio (Hora Argentina)');
    }

    if (!isInFutureArgentina(startDate)) {
      const currentArgTime = formatArgentinaDate(getCurrentArgentinaTime(), 'DD/MM/YYYY HH:mm');
      throw new Error(`La fecha de inicio no puede ser en el pasado (Hora actual Argentina: ${currentArgTime})`);
    }

    const examConfig = {
      examLink: examData.examLink.trim(),
      examVisible: true,
      examStartDate: startDate,
      examEndDate: endDate,
    };

    return this.classRepository.updateExamConfig(classId, examConfig);
  }

  /**
   * Desactiva un examen para una clase.
   * @param classId - ID de la clase.
   * @returns La clase actualizada.
   */
  async deactivateExam(classId: string): Promise<IClassData | null> {
    const examConfig = {
      examVisible: false,
    };

    return this.classRepository.updateExamConfig(classId, examConfig);
  }
}
