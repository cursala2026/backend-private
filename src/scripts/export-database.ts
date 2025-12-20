import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import config from '@/config';

const execAsync = promisify(exec);

/**
 * Script para exportar toda la base de datos MongoDB a un archivo
 * Crea un backup en formato BSON (binario) que puede compartirse con otros PCs
 */
async function exportDatabase() {
  try {
    console.log('📦 Iniciando exportación de la base de datos...\n');
    
    // Parsear la URL de MongoDB para obtener el nombre de la base de datos
    const dbUrl = config.DATABASE_URL;
    const dbName = dbUrl.split('/').pop()?.split('?')[0] || 'cursala';
    
    console.log(`📊 Base de datos: ${dbName}`);
    console.log(`🔗 URL: ${dbUrl}\n`);
    
    // Crear directorio de backups en la carpeta dev (un nivel arriba de backend-private)
    const backupDir = path.resolve(process.cwd(), '..', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      console.log(`📁 Directorio de backups creado: ${backupDir}\n`);
    }
    
    // Nombre del archivo de backup con timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const backupPath = path.join(backupDir, `${dbName}-${timestamp}`);
    
    console.log('⏳ Exportando base de datos...');
    console.log(`📂 Destino: ${backupPath}\n`);
    
    // Ejecutar mongodump
    const command = `mongodump --uri="${dbUrl}" --out="${backupPath}"`;
    
    try {
      const { stdout, stderr } = await execAsync(command);
      
      if (stdout) console.log(stdout);
      if (stderr && !stderr.includes('writing')) console.error(stderr);
      
      console.log('\n✅ Base de datos exportada exitosamente!');
      console.log(`\n📦 Ubicación del backup:`);
      console.log(`   ${backupPath}`);
      console.log(`\n📋 Para compartir con otro PC:`);
      console.log(`   1. Copia la carpeta completa: dev/backups/`);
      console.log(`   2. Pégala en el otro PC en la misma ubicación (dev/backups/)`);
      console.log(`   3. En el otro PC, ejecuta: cd backend-private && npm run db:import\n`);
      
      // Crear archivo README en el backup
      const readmePath = path.join(backupPath, 'README.txt');
      const readmeContent = `
BACKUP DE BASE DE DATOS CURSALA
================================

Base de datos: ${dbName}
Fecha de exportación: ${new Date().toLocaleString('es-AR')}
Exportado desde: ${process.env.COMPUTERNAME || 'PC Local'}

INSTRUCCIONES PARA IMPORTAR:
-----------------------------

1. Asegúrate de tener MongoDB instalado en tu PC
2. Copia la carpeta completa 'backups' a la carpeta 'dev' del proyecto
3. Ejecuta desde backend-private/:
   
   npm run db:import

4. El script te pedirá confirmar la importación
5. ¡Listo! La base de datos estará disponible

NOTA: La importación sobrescribirá la base de datos actual.
Asegúrate de hacer un backup si tienes datos importantes.
`;
      
      fs.writeFileSync(readmePath, readmeContent);
      console.log(`📝 Instrucciones guardadas en: ${readmePath}\n`);
      
    } catch (error: any) {
      if (error.message.includes('mongodump')) {
        console.error('\n❌ Error: mongodump no está instalado o no está en el PATH');
        console.log('\n💡 Soluciones:');
        console.log('   1. Instala MongoDB Database Tools:');
        console.log('      https://www.mongodb.com/try/download/database-tools');
        console.log('   2. O usa MongoDB Compass para exportar/importar visualmente\n');
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error durante la exportación:', error);
    process.exit(1);
  }
}

exportDatabase();
