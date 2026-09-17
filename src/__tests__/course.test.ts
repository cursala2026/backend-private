import { Types } from 'mongoose';
import { Course } from '../models/course.model';

describe('Course Model', () => {
    it('crea curso SYNC en estado DRAFT sin errores', async () => {
        const course = new Course({
            title: 'Curso de prueba',
            description: 'Descripción del curso de prueba',
            instructor: new Types.ObjectId(),
            modality: 'SYNC',
            status: 'DRAFT',
            modules: []
        });
        await expect(course.validate()).resolves.toBeUndefined();
    });

    it('rechaza curso ASYNC en PUBLISHED sin lección con video', async () => {
        const course = new Course({
            title: 'Curso asincrónico',
            description: 'Descripción del curso de prueba',
            instructor: new Types.ObjectId(),
            modality: 'ASYNC',
            status: 'PUBLISHED',
            modules: [
                { title: 'Módulo 1', order: 1, lessons: [{ title: 'Lección 1', order: 1, durationSeconds: 60, isFreePreview: false }] }
            ]
        });
        await expect(course.save()).rejects.toThrow('El curso debe tener al menos una lección con video.');
    });

    it('rechaza módulos con orden duplicado', async () => {
        const course = new Course({
            title: 'Curso duplicado',
            description: 'Descripción del curso de prueba',
            instructor: new Types.ObjectId(),
            modality: 'SYNC',
            status: 'DRAFT',
            modules: [
                { title: 'Módulo 1', order: 1, lessons: [] },
                { title: 'Módulo 2', order: 1, lessons: [] }
            ]
        });
        await expect(course.validate()).rejects.toThrow('Los módulos deben tener un orden único.');
    });

    it('rechaza lecciones con orden duplicado dentro de un módulo', async () => {
        const course = new Course({
            title: 'Curso con lecciones duplicadas',
            description: 'Descripción del curso de prueba',
            instructor: new Types.ObjectId(),
            modality: 'SYNC',
            status: 'DRAFT',
            modules: [
                { title: 'Módulo 1', order: 1, lessons: [
                    { title: 'Lección 1', order: 1, durationSeconds: 60, isFreePreview: false },
                    { title: 'Lección 2', order: 1, durationSeconds: 60, isFreePreview: false }
                ] }
            ]
        });
        await expect(course.validate()).rejects.toThrow('Las lecciones del módulo "Módulo 1" deben tener un orden único.');
    });
});
