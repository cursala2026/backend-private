# 📦 Compartir Base de Datos entre PCs

Esta guía explica cómo compartir tu base de datos MongoDB local con otro PC.

## 🚀 Método 1: Usando los Scripts Automáticos (Recomendado)

### En el PC Original (donde tienes los datos)

1. **Exportar la base de datos:**
   ```bash
   cd backend-private
   npm run db:export
   ```

2. **Comprimir el backup:**
   - Ve a la carpeta `backend-private/backups/`
   - Encontrarás una carpeta con el nombre: `cursala-2025-12-19` (con la fecha actual)
   - Comprime esa carpeta en un archivo `.zip`

3. **Compartir el archivo:**
   - Envía el archivo `.zip` al otro PC (por correo, USB, Google Drive, etc.)

### En el PC Destino (donde quieres los datos)

1. **Descomprimir el backup:**
   - Descomprime el archivo `.zip` recibido
   - Copia la carpeta extraída a `backend-private/backups/`

2. **Importar la base de datos:**
   ```bash
   cd backend-private
   npm run db:import
   ```

3. **Seguir las instrucciones:**
   - El script te mostrará los backups disponibles
   - Selecciona el que quieres importar
   - Confirma la importación (escribiendo 's' o 'si')
   - ¡Listo! Los datos estarán disponibles

---

## 🔧 Método 2: Usando MongoDB Compass (Visual)

Si prefieres una interfaz gráfica:

1. **Descargar MongoDB Compass:**
   - https://www.mongodb.com/try/download/compass

2. **Exportar en el PC Original:**
   - Abre MongoDB Compass
   - Conéctate a tu base de datos local
   - Selecciona la base de datos "cursala"
   - Para cada colección:
     - Click derecho → Export Collection
     - Elige formato JSON o CSV
     - Guarda el archivo

3. **Importar en el PC Destino:**
   - Abre MongoDB Compass
   - Conéctate a tu base de datos local
   - Crea la base de datos "cursala"
   - Para cada colección:
     - Click en "ADD DATA" → Import File
     - Selecciona el archivo exportado

---

## 🌐 Método 3: Base de Datos Compartida en la Nube (Mejor para trabajo en equipo)

En lugar de compartir archivos, puedes usar una base de datos en la nube que ambos PCs puedan acceder:

### Opción A: MongoDB Atlas (Gratis hasta 512MB)

1. **Crear cuenta en MongoDB Atlas:**
   - https://www.mongodb.com/cloud/atlas/register

2. **Crear un cluster gratuito:**
   - Sigue el wizard de configuración
   - Elige la región más cercana

3. **Configurar acceso:**
   - Database Access → Add New Database User
   - Network Access → Add IP Address (0.0.0.0/0 para permitir cualquier IP)

4. **Obtener la connection string:**
   - Click en "Connect" → "Connect your application"
   - Copia la URL de conexión

5. **Actualizar en ambos PCs:**
   - Edita el archivo `.env` en `backend-private/`
   - Cambia `DATABASE_URL` por la nueva URL de Atlas
   - Ejemplo:
     ```
     DATABASE_URL=mongodb+srv://usuario:password@cluster.xxxxx.mongodb.net/cursala?retryWrites=true&w=majority
     ```

6. **Migrar datos existentes:**
   ```bash
   cd backend-private
   npm run db:export
   # Cambia DATABASE_URL en .env a Atlas
   npm run db:import
   ```

---

## 📋 Requisitos

Para usar los scripts automáticos necesitas:

### Windows:
1. **MongoDB Database Tools:**
   - Descarga: https://www.mongodb.com/try/download/database-tools
   - Instala y asegúrate de que `mongodump` y `mongorestore` estén en el PATH

2. **Verificar instalación:**
   ```bash
   mongodump --version
   mongorestore --version
   ```

### Linux/Mac:
```bash
# Ubuntu/Debian
sudo apt-get install mongodb-database-tools

# Mac
brew install mongodb-database-tools
```

---

## ⚠️ Notas Importantes

1. **Backup antes de importar:**
   - La importación **sobrescribe** la base de datos actual
   - Haz un backup antes si tienes datos importantes

2. **Tamaño de los datos:**
   - Los backups pueden ser grandes si tienes muchas imágenes/videos
   - Considera usar MongoDB Atlas para bases de datos grandes

3. **Seguridad:**
   - No compartas backups que contengan información sensible sin cifrar
   - Las contraseñas en la base de datos están hasheadas, pero otros datos no

4. **Sincronización:**
   - Si varios PCs trabajan en la misma base de datos local, pueden tener conflictos
   - Para trabajo en equipo, mejor usar MongoDB Atlas (Método 3)

---

## 🆘 Problemas Comunes

### Error: "mongodump no está instalado"
- Instala MongoDB Database Tools (ver Requisitos arriba)
- Asegúrate de que esté en el PATH del sistema

### Error: "No se encontraron backups"
- Verifica que la carpeta `backups/` exista en `backend-private/`
- Asegúrate de haber descomprimido correctamente el archivo

### Error de conexión a MongoDB
- Verifica que MongoDB esté corriendo: `mongod --version`
- Revisa que el `DATABASE_URL` en `.env` sea correcto

---

## 📞 Ayuda Adicional

Si tienes problemas, consulta:
- Documentación de MongoDB: https://docs.mongodb.com/
- MongoDB Community Forums: https://community.mongodb.com/
