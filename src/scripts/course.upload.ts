import mongoose from 'mongoose';
import CourseRepository from '../repositories/course.repository';
import { ProgramGeneratorService, mapCourseToPdfData } from '../services/course-upload.service';
import { logger } from '../utils';

async function main() {
  try {
    // Conectar a la base de datos
    await mongoose.connect(process.env.DATABASE_URL!);
    const courseRepository = new CourseRepository(mongoose.connection);

    // Buscar todos los cursos
    const courses = await courseRepository.findAll();
    logger.info(`📚 Encontrados ${courses.length} cursos`);

    const programGenerator = new ProgramGeneratorService();

    // Iterar sobre cada curso y generar PDF
    for (const course of courses) {
      try {
        const programData = await mapCourseToPdfData(course);

        // Generar y subir PDF (sin oldUrl porque es la primera vez)
        const programUrl = await programGenerator.generateAndUploadProgramPDF(programData);

        // Guardar la URL en el curso (si tu modelo lo soporta)
        course.programUrl = programUrl;
        await courseRepository.update(course._id.toString(), course);

        logger.info(`✅ PDF generado y subido para curso: ${course.name}`);
      } catch (err) {
        logger.error(`❌ Error generando PDF para curso ${course.name}: ${(err as Error).message}`);
      }
    }

    logger.info('🎉 Todos los PDFs generados y subidos');
    process.exit(0);
  } catch (error) {
    logger.error('Error en el script de generación masiva:', error);
    process.exit(1);
  }
}

main();