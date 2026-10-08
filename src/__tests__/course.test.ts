import mongoose, { Types } from 'mongoose';
import { CourseSchema } from '../models/mongo/course.model';

const Course = mongoose.models.Course || mongoose.model('Course', CourseSchema);

describe('Course Model', () => {
    it('crea curso SYNC en estado DRAFT sin errores', async () => {
        const course = new Course({
            name: 'Curso de prueba',
            description: 'Descripción del curso de prueba',
            instructor: new Types.ObjectId(),
            modality: 'SYNC',
            status: 'DRAFT',
            order: 1,
            modules: []
        });
        await expect(course.validate()).resolves.toBeUndefined();
    });

    it('rechaza curso ASYNC en PUBLISHED sin lección con video', async () => {
        const course = new Course({
            name: 'Curso asincrónico',
            description: 'Descripción del curso de prueba',
            instructor: new Types.ObjectId(),
            modality: 'ASYNC',
            status: 'PUBLISHED',
            order: 1,
            modules: [
                { title: 'Módulo 1', order: 1, lessons: [{ title: 'Lección 1', order: 1, durationSeconds: 60, isFreePreview: false }] }
            ]
        });
        await expect(course.save()).rejects.toThrow('El curso debe tener al menos una lección con video.');
    });

    it('rechaza módulos con orden duplicado', async () => {
        const course = new Course({
            name: 'Curso duplicado',
            description: 'Descripción del curso de prueba',
            instructor: new Types.ObjectId(),
            modality: 'SYNC',
            status: 'DRAFT',
            order: 1,
            modules: [
                { title: 'Módulo 1', order: 1, lessons: [] },
                { title: 'Módulo 2', order: 1, lessons: [] }
            ]
        });
        await expect(course.validate()).rejects.toThrow('Los módulos deben tener un orden único.');
    });

    it('rechaza lecciones con orden duplicado dentro de un módulo', async () => {
        const course = new Course({
            name: 'Curso con lecciones duplicadas',
            description: 'Descripción del curso de prueba',
            instructor: new Types.ObjectId(),
            modality: 'SYNC',
            status: 'DRAFT',
            order: 1,
            modules: [
                { title: 'Módulo 1', order: 1, lessons: [
                    { title: 'Lección 1', order: 1, durationSeconds: 60, isFreePreview: false },
                    { title: 'Lección 2', order: 1, durationSeconds: 60, isFreePreview: false }
                ] }
            ]
        });
        await expect(course.validate()).rejects.toThrow('Las lecciones del módulo "Módulo 1" deben tener un orden único.');
    });

    it('rechaza curso con título demasiado largo', async () => {
        const longTitle = 'a'.repeat(121);
        const course = new Course({
            name: longTitle,
            description: 'Descripción válida',
            instructor: new Types.ObjectId(),
            modality: 'SYNC',
            status: 'DRAFT',
            order: 1,
            modules: []
        });
        await expect(course.validate()).rejects.toThrow();
    });

    it('rechaza curso con descripción demasiado larga', async () => {
        const longDesc = 'a'.repeat(2001);
        const course = new Course({
            name: 'Curso válido',
            description: longDesc,
            instructor: new Types.ObjectId(),
            modality: 'SYNC',
            status: 'DRAFT',
            order: 1,
            modules: []
        });
        await expect(course.validate()).rejects.toThrow();
    });
    it('rechaza curso con modality inválida', async () => {
        const course = new Course({
            name: 'Curso inválido',
            description: 'Descripción válida',
            instructor: new Types.ObjectId(),
            modality: 'INVALID',
            status: 'DRAFT',
            order: 1,
            modules: []
        });
        await expect(course.validate()).rejects.toThrow();
    });
    
    it('rechaza curso con status inválido', async () => {
        const course = new Course({
            name: 'Curso inválido',
            description: 'Descripción válida',
            instructor: new Types.ObjectId(),
            modality: 'SYNC',
            status: 'INVALID',
            order: 1,
            modules: []
        });
        await expect(course.validate()).rejects.toThrow();
    });
});
