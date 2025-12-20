const { MongoClient, ObjectId } = require('mongodb');

async function checkDetailedTypes() {
  const client = new MongoClient('mongodb://localhost:27017/cursala');

  try {
    await client.connect();
    console.log('Conectado a MongoDB\n');

    const db = client.db('cursala');

    // Verificar si hay courseIds almacenados como strings en assignedCoursesEdit
    console.log('=== VERIFICANDO TIPOS DE courseId EN assignedCoursesEdit ===\n');

    const usersWithAssignedCourses = await db.collection('users')
      .find({ assignedCoursesEdit: { $exists: true, $ne: [] } })
      .toArray();

    console.log(`Total usuarios con assignedCoursesEdit: ${usersWithAssignedCourses.length}\n`);

    let stringCourseIds = [];
    let objectIdCourseIds = [];

    usersWithAssignedCourses.forEach(user => {
      user.assignedCoursesEdit.forEach((assignment, index) => {
        const courseId = assignment.courseId;
        const isObjectId = courseId instanceof ObjectId;
        const typeInfo = {
          userId: user._id.toString(),
          userName: `${user.firstName} ${user.lastName}`,
          courseId: courseId,
          isObjectId: isObjectId,
          type: courseId.constructor.name
        };

        if (isObjectId) {
          objectIdCourseIds.push(typeInfo);
        } else {
          stringCourseIds.push(typeInfo);
        }
      });
    });

    console.log(`✓ CourseIds como ObjectId: ${objectIdCourseIds.length}`);
    console.log(`✗ CourseIds como String: ${stringCourseIds.length}\n`);

    if (stringCourseIds.length > 0) {
      console.log('⚠️  PROBLEMA ENCONTRADO: Hay courseIds almacenados como STRING\n');
      console.log('Ejemplos:');
      stringCourseIds.slice(0, 5).forEach(item => {
        console.log(`  - Usuario: ${item.userName} (${item.userId})`);
        console.log(`    CourseId: ${item.courseId} (tipo: ${item.type})\n`);
      });
    }

    // Verificar mainTeacher en courses
    console.log('\n=== VERIFICANDO TIPO DE mainTeacher EN courses ===\n');

    const coursesWithMainTeacher = await db.collection('courses')
      .find({ mainTeacher: { $exists: true } })
      .toArray();

    console.log(`Total cursos con mainTeacher: ${coursesWithMainTeacher.length}\n`);

    let stringMainTeachers = [];
    let objectIdMainTeachers = [];

    coursesWithMainTeacher.forEach(course => {
      const mainTeacher = course.mainTeacher;
      const isObjectId = mainTeacher instanceof ObjectId;
      const typeInfo = {
        courseId: course._id.toString(),
        courseName: course.name,
        mainTeacher: mainTeacher,
        isObjectId: isObjectId,
        type: mainTeacher.constructor.name
      };

      if (isObjectId) {
        objectIdMainTeachers.push(typeInfo);
      } else {
        stringMainTeachers.push(typeInfo);
      }
    });

    console.log(`✓ MainTeacher como ObjectId: ${objectIdMainTeachers.length}`);
    console.log(`✗ MainTeacher como String: ${stringMainTeachers.length}\n`);

    if (stringMainTeachers.length > 0) {
      console.log('⚠️  PROBLEMA ENCONTRADO: Hay mainTeacher almacenados como STRING\n');
      console.log('Ejemplos:');
      stringMainTeachers.slice(0, 5).forEach(item => {
        console.log(`  - Curso: ${item.courseName} (${item.courseId})`);
        console.log(`    MainTeacher: ${item.mainTeacher} (tipo: ${item.type})\n`);
      });
    }

    // Verificar _id de usuarios
    console.log('\n=== VERIFICANDO TIPO DE _id EN users ===\n');

    const allUsers = await db.collection('users').find({}).limit(10).toArray();

    let stringUserIds = [];
    let objectIdUserIds = [];

    allUsers.forEach(user => {
      const userId = user._id;
      const isObjectId = userId instanceof ObjectId;

      if (isObjectId) {
        objectIdUserIds.push(userId);
      } else {
        stringUserIds.push({
          _id: userId,
          type: userId.constructor.name,
          userName: `${user.firstName} ${user.lastName}`
        });
      }
    });

    console.log(`✓ User _id como ObjectId: ${objectIdUserIds.length}`);
    console.log(`✗ User _id como String: ${stringUserIds.length}\n`);

    if (stringUserIds.length > 0) {
      console.log('⚠️  PROBLEMA ENCONTRADO: Hay _id de usuarios almacenados como STRING\n');
      console.log('Ejemplos:');
      stringUserIds.slice(0, 5).forEach(item => {
        console.log(`  - Usuario: ${item.userName}`);
        console.log(`    _id: ${item._id} (tipo: ${item.type})\n`);
      });
    }

    // Resumen final
    console.log('\n' + '='.repeat(60));
    console.log('RESUMEN DE VERIFICACIÓN');
    console.log('='.repeat(60));

    const hasIssues = stringCourseIds.length > 0 || stringMainTeachers.length > 0 || stringUserIds.length > 0;

    if (hasIssues) {
      console.log('❌ Se encontraron inconsistencias en los tipos de datos\n');
      if (stringCourseIds.length > 0) {
        console.log(`   - ${stringCourseIds.length} courseIds en assignedCoursesEdit son strings`);
      }
      if (stringMainTeachers.length > 0) {
        console.log(`   - ${stringMainTeachers.length} mainTeacher en courses son strings`);
      }
      if (stringUserIds.length > 0) {
        console.log(`   - ${stringUserIds.length} _id de usuarios son strings`);
      }
    } else {
      console.log('✅ Todos los IDs están correctamente almacenados como ObjectId\n');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkDetailedTypes();
