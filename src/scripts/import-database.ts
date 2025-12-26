import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import readline from 'readline';
import config from '@/config';

const execAsync = promisify(exec);

/**
 * Script para importar una base de datos MongoDB desde un backup
 */
async function importDatabase() {
  try {
    console.log('📥 Iniciando importación de base de datos...\n');
    
    // Buscar backups en la carpeta dev (un nivel arriba de backend-private)
    const backupDir = path.resolve(process.cwd(), '..', 'backups');
    
    // Verificar si existe el directorio de backups
    if (!fs.existsSync(backupDir)) {
      console.error('❌ No se encontró el directorio de backups');
      console.log('\n💡 Copia la carpeta de backups recibida a:');
      console.log(`   ${backupDir}\n`);
      process.exit(1);
    }
    
    // Listar backups disponibles
    const backups = fs.readdirSync(backupDir)
      .filter(file => fs.statSync(path.join(backupDir, file)).isDirectory())
      .sort()
      .reverse(); // Más recientes primero
    
    if (backups.length === 0) {
      console.error('❌ No se encontraron backups en el directorio');
      console.log(`\n📂 Directorio: ${backupDir}`);
      console.log('💡 Copia la carpeta de backup recibida a la carpeta dev/backups/ y vuelve a ejecutar\n');
      process.exit(1);
    }
    
    console.log('📋 Backups disponibles:\n');
    backups.forEach((backup, index) => {
      const backupPath = path.join(backupDir, backup);
      const stats = fs.statSync(backupPath);
      console.log(`   ${index + 1}. ${backup}`);
      console.log(`      Fecha: ${stats.mtime.toLocaleString('es-AR')}`);
      console.log('');
    });
    
    // Seleccionar backup
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const selectedBackup = await new Promise<string>((resolve) => {
      rl.question(`Selecciona el número del backup (1-${backups.length}) [1]: `, (answer) => {
        const index = parseInt(answer || '1') - 1;
        if (index >= 0 && index < backups.length) {
          resolve(backups[index]);
        } else {
          resolve(backups[0]);
        }
      });
    });
    
    const backupPath = path.join(backupDir, selectedBackup);
    
    // Parsear la URL de MongoDB
    const dbUrl = config.DATABASE_URL;
    const dbName = dbUrl.split('/').pop()?.split('?')[0] || 'cursala';
    
    console.log(`\n⚠️  ADVERTENCIA: Esta operación sobrescribirá la base de datos actual`);
    console.log(`   Base de datos: ${dbName}`);
    console.log(`   Backup: ${selectedBackup}\n`);
    
    const confirm = await new Promise<string>((resolve) => {
      rl.question('¿Continuar con la importación? (s/N): ', resolve);
    });
    
    rl.close();
    
    if (confirm.toLowerCase() !== 's' && confirm.toLowerCase() !== 'si') {
      console.log('\n❌ Importación cancelada\n');
      process.exit(0);
    }
    
    console.log('\n⏳ Importando base de datos...');
    console.log(`📂 Origen: ${backupPath}\n`);
    
    // Construir la ruta completa al dump de la base de datos
    const dbDumpPath = path.join(backupPath, dbName);
    
    // Verificar que existe el dump de la base de datos
    if (!fs.existsSync(dbDumpPath)) {
      console.error(`❌ No se encontró el dump de la base de datos en: ${dbDumpPath}`);
      console.log('\n💡 Verifica que la estructura del backup sea correcta\n');
      process.exit(1);
    }
    
    // Buscar mongorestore en ubicaciones comunes de Windows
    const possiblePaths = [
      'mongorestore', // En PATH
      'C:\\mongodb-database-tools-windows-x86_64-100.14.0\\mongodb-database-tools-windows-x86_64-100.14.0\\bin\\mongorestore.exe',
      'C:\\Program Files\\MongoDB\\Tools\\100\\bin\\mongorestore.exe',
      'C:\\Program Files\\MongoDB\\Tools\\bin\\mongorestore.exe',
      'C:\\Program Files (x86)\\MongoDB\\Tools\\100\\bin\\mongorestore.exe',
      'C:\\Program Files (x86)\\MongoDB\\Tools\\bin\\mongorestore.exe',
    ];
    
    let mongorestorePath = 'mongorestore';
    let foundMongorestore = false;
    
    // Intentar encontrar mongorestore
    for (const testPath of possiblePaths) {
      try {
        await execAsync(`"${testPath}" --version`);
        mongorestorePath = testPath;
        foundMongorestore = true;
        console.log(`✓ Encontrado: ${testPath}\n`);
        break;
      } catch (error) {
        // Continuar buscando
      }
    }
    
    if (!foundMongorestore) {
      console.error('\n❌ Error: mongorestore no está instalado o no está en el PATH');
      console.log('\n💡 Soluciones:');
      console.log('   1. Instala MongoDB Database Tools:');
      console.log('      https://www.mongodb.com/try/download/database-tools');
      console.log('   2. O agrega la ruta de instalación al PATH del sistema');
      console.log('   3. Busca la carpeta de instalación (ej: C:\\Program Files\\MongoDB\\Tools\\100\\bin)');
      console.log('      y agrégala a las variables de entorno PATH\n');
      process.exit(1);
    }
    
    // Ejecutar mongorestore
    const command = `"${mongorestorePath}" --uri="${dbUrl}" --drop "${dbDumpPath}"`;
    
    try {
      const { stdout, stderr } = await execAsync(command, { maxBuffer: 1024 * 1024 * 10 });
      
      if (stdout) console.log(stdout);
      if (stderr && !stderr.includes('writing')) console.error(stderr);
      
      console.log('\n✅ Base de datos importada exitosamente!');
      console.log('\n🎉 Puedes empezar a usar la aplicación con los datos importados\n');
      
    } catch (error: any) {
      if (error.message.includes('mongorestore')) {
        console.error('\n❌ Error: mongorestore no está instalado o no está en el PATH');
        console.log('\n💡 Soluciones:');
        console.log('   1. Instala MongoDB Database Tools:');
        console.log('      https://www.mongodb.com/try/download/database-tools');
        console.log('   2. O usa MongoDB Compass para exportar/importar visualmente\n');
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error durante la importación:', error);
    process.exit(1);
  }
}

importDatabase();
