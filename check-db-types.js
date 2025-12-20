const { MongoClient } = require('mongodb');

async function checkTypes() {
  const client = new MongoClient('mongodb://localhost:27017/cursala');

  try {
    await client.connect();
    console.log('Conectado a MongoDB');

    const db = client.db('cursala');

    // Verificar tipo de mainTeacher en courses
    console.log('\n=== CURSOS CON mainTeacher ===');
    const course = await db.collection('courses').findOne(
      { mainTeacher: { $exists: true } },
      { projection: { _id: 1, name: 1, mainTeacher: 1 } }
    );

    if (course) {
      console.log('Documento encontrado:');
      console.log(JSON.stringify(course, null, 2));
      console.log('\nTipo de mainTeacher:', typeof course.mainTeacher);
      console.log('Es ObjectId?:', course.mainTeacher?.constructor?.name);
    } else {
      console.log('No se encontraron cursos con mainTeacher');
    }

    // Verificar tipo de assignedCoursesEdit en users
    console.log('\n\n=== USUARIOS CON assignedCoursesEdit ===');
    const user = await db.collection('users').findOne(
      { assignedCoursesEdit: { $exists: true, $ne: [] } },
      { projection: { _id: 1, firstName: 1, lastName: 1, assignedCoursesEdit: 1 } }
    );

    if (user) {
      console.log('Documento encontrado:');
      console.log(JSON.stringify(user, null, 2));
      console.log('\nTipo de assignedCoursesEdit:', typeof user.assignedCoursesEdit);
      if (user.assignedCoursesEdit && user.assignedCoursesEdit[0]) {
        console.log('Tipo de courseId:', typeof user.assignedCoursesEdit[0].courseId);
        console.log('Es ObjectId?:', user.assignedCoursesEdit[0].courseId?.constructor?.name);
      }
    } else {
      console.log('No se encontraron usuarios con assignedCoursesEdit');
    }

    // Contar documentos
    console.log('\n\n=== ESTADÍSTICAS ===');
    const coursesWithMainTeacher = await db.collection('courses').countDocuments({ mainTeacher: { $exists: true } });
    const usersWithAssignedCourses = await db.collection('users').countDocuments({ assignedCoursesEdit: { $exists: true, $ne: [] } });

    console.log(`Cursos con mainTeacher: ${coursesWithMainTeacher}`);
    console.log(`Usuarios con assignedCoursesEdit: ${usersWithAssignedCourses}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkTypes();
