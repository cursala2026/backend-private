import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';
import { User } from '../models/user.model';
import { Course } from '../models/mongo/course.model';
import { CourseProgressModel } from '../models/mongo/courseProgress.model';
import { UserRoles, UserStatus } from '../models/enums/user.enum';

// Cargar variables de entorno
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const PASSWORD_DEFAULT = 'password123';

async function seedTestData() {
  try {
    const mongoUri = process.env.DATABASE_URL;
    if (!mongoUri) {
      throw new Error('DATABASE_URL no está definida en el archivo .env');
    }

    console.log('⏳ Conectando a MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Conectado con éxito.\n');

    const hashedPassword = await bcrypt.hash(PASSWORD_DEFAULT, 10);

    // 1. Crear 3 Profesores
    console.log('👥 Creando 3 profesores...');
    const teachers = [];
    for (let i = 1; i <= 3; i++) {
        const teacherData = {
            username: `profesor${i}_${Date.now()}`,
            email: `profesor${i}_${Date.now()}@test.com`,
            password: hashedPassword,
            firstName: `Profesor`,
            lastName: `${i} Test`,
            status: UserStatus.ACTIVE,
            roles: [UserRoles.PROFESOR],
            professionalDescription: `Experto en la materia ${i}`,
            professionalSignatureUrl: `https://ui-avatars.com/api/?name=Firma+Profesor+${i}&background=random&color=fff&size=512&font-size=0.1` // Firma digital de prueba generada por UI Avatars
        };
        const teacher = await User.create(teacherData);
        teachers.push(teacher);
        console.log(`   - Profesor ${i}: ${teacher.email}`);
    }

    // 2. Crear 1 Alumno
    console.log('\n👤 Creando 1 alumno...');
    const studentData = {
        username: `alumno_${Date.now()}`,
        email: `alumno_${Date.now()}@test.com`,
        password: hashedPassword,
        firstName: 'Alumno',
        lastName: 'De Prueba',
        dni: '12345678X', // Requerido para certificados
        status: UserStatus.ACTIVE,
        roles: [UserRoles.ALUMNO]
    };
    const student = await User.create(studentData);
    console.log(`   - Alumno: ${student.email}`);

    // 3. Crear Curso
    console.log('\n📚 Creando curso de prueba...');
    
    // Definimos las clases dentro del curso (según el esquema embebido)
    const classes = [
        {
            title: 'Introducción al Sistema',
            status: UserStatus.ACTIVE
        },
        {
            title: 'Dominando la Herramienta',
            status: UserStatus.ACTIVE
        }
    ];

    const courseData = {
        name: `Curso Master de Prueba ${Date.now()}`,
        description: 'Un curso diseñado para probar el sistema de certificados y progreso.',
        status: UserStatus.ACTIVE,
        order: 1,
        classes: classes,
        teachers: teachers.map(t => t._id),
        students: [{
            userId: student._id,
            enrolledAt: new Date(),
            enrollmentType: 'MANUAL'
        }],
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Hace 30 días
        isPublished: true,
        numberOfClasses: 2,
        duration: 10
    };

    const course = await Course.create(courseData);
    console.log(`   - Curso creado: ${course.name} (ID: ${course._id})`);

    // 4. Crear Progreso al 100% para el alumno
    console.log('\n📈 Configurando progreso al 100% para el alumno...');
    
    // Necesitamos los IDs de las clases creadas. 
    // Importamos el modelo Class adecuadamente para evitar MissingSchemaError
    const { ClassSchema } = require('../models/mongo/class.model');
    const ClassModel = mongoose.model('Class', ClassSchema);

    const class1 = await ClassModel.create({
        name: classes[0].title,
        status: UserStatus.ACTIVE,
        order: 1,
        courseId: course._id
    });
    const class2 = await ClassModel.create({
        name: classes[1].title,
        status: UserStatus.ACTIVE,
        order: 2,
        courseId: course._id
    });

    const progressData = {
        userId: student._id,
        courseId: course._id,
        classesProgress: [
            {
                classId: class1._id,
                watchTime: 3600,
                duration: 3600,
                completed: true,
                completedAt: new Date(),
                lastWatchedAt: new Date()
            },
            {
                classId: class2._id,
                watchTime: 3600,
                duration: 3600,
                completed: true,
                completedAt: new Date(),
                lastWatchedAt: new Date()
            }
        ],
        overallProgress: 100,
        startedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        lastAccessedAt: new Date()
    };

    await CourseProgressModel.create(progressData);
    console.log('   - Progreso al 100% creado correctamente.');

    console.log('\n=================================================');
    console.log('✅ ESCENARIO DE PRUEBA LISTO');
    console.log('=================================================');
    console.log(`📧 Login Alumno: ${student.email}`);
    console.log(`📧 Login Profesor 1: ${teachers[0].email}`);
    console.log(`🔑 Password (todos): ${PASSWORD_DEFAULT}`);
    console.log('-------------------------------------------------');
    console.log('El alumno tiene el DNI configurado y el curso con');
    console.log('profesores que tienen firma. El progreso está al 100%.');
    console.log('El sistema está listo para que generes el certificado.');
    console.log('=================================================\n');

  } catch (error) {
    console.error('\n❌ Error durante el seeding:');
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
}

seedTestData();
