#!/usr/bin/env node
/*
  migrate-roles-to-codes.js

  Convierte en los documentos `users` el campo `roles` de ObjectId[] a string[]
  con los `code` definidos en la colección `roles`.

  Uso:
    node migrate-roles-to-codes.js --dry-run   # solo informa, no modifica
    node migrate-roles-to-codes.js             # aplica los cambios

  Recomendado: hacer `mongodump` antes de ejecutar en modo real.
*/

require('dotenv').config();
const mongoose = require('mongoose');
const argv = require('yargs/yargs')(process.argv.slice(2)).argv;

(async function main(){
  const dryRun = Boolean(argv['dry-run'] || argv.dryrun);
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DB_URI || 'mongodb://localhost:27017/cursala';
  console.log((dryRun? 'DRY-RUN:':'RUN:'), 'Conectando a', mongoUri);

  try{
    await mongoose.connect(mongoUri, { dbName: (new URL(mongoUri)).pathname.replace(/^\//,'') || undefined });
    const db = mongoose.connection.db;

    const rolesColl = db.collection('roles');
    const usersColl = db.collection('users');

    const roles = await rolesColl.find({}).toArray();
    if(!roles || roles.length === 0){
      console.error('No se encontraron roles en la colección `roles`. Abortando.');
      process.exit(1);
    }

    const idToCode = new Map();
    const codesSet = new Set();
    roles.forEach(r => {
      const id = (r._id && r._id.toString && r._id.toString()) || String(r._id);
      const code = (r.code || r.name || '').toString();
      if(id && code){
        idToCode.set(id, code);
        codesSet.add(code);
      }
    });

    // Buscar usuarios que potencialmente tienen roles
    const cursor = usersColl.find({ roles: { $exists: true, $ne: [] } });

    let toUpdate = [];
    while(await cursor.hasNext()){
      const user = await cursor.next();
      if(!user) continue;
      const currentRoles = Array.isArray(user.roles) ? user.roles : [];
      let newRoles = [];

      for(const r of currentRoles){
        if(r && typeof r === 'object' && r.toString){
          const sid = r.toString();
          if(idToCode.has(sid)) newRoles.push(idToCode.get(sid));
        } else if(typeof r === 'string'){
          if(codesSet.has(r)){
            newRoles.push(r);
          } else if(/^([a-fA-F0-9]{24})$/.test(r) && idToCode.has(r)){
            newRoles.push(idToCode.get(r));
          } else {
            newRoles.push(r);
          }
        }
      }

      newRoles = Array.from(new Set(newRoles));

      const same = (currentRoles.length === newRoles.length) && currentRoles.every((v,i)=>{
        const a = (typeof v === 'object' && v.toString) ? v.toString() : String(v);
        return a === newRoles[i];
      });

      if(!same){
        toUpdate.push({ _id: user._id, before: currentRoles, after: newRoles });
      }
    }

    console.log('Usuarios a actualizar:', toUpdate.length);
    if(toUpdate.length > 0){
      console.log('Ejemplos (max 10):');
      toUpdate.slice(0,10).forEach(u => console.log('- ', String(u._id), '=>', JSON.stringify({ before:u.before, after:u.after }))); 
    }

    if(dryRun){
      console.log('DRY-RUN activado: no se aplicaron cambios. Revise los ejemplos y haga backup antes de ejecutar sin --dry-run.');
      await mongoose.disconnect();
      process.exit(0);
    }

    if(toUpdate.length === 0){
      console.log('No hay cambios necesarios.');
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log('Aplicando cambios...');
    const bulkOps = toUpdate.map(u => ({
      updateOne: {
        filter: { _id: u._id },
        update: { $set: { roles: u.after } }
      }
    }));

    const res = await usersColl.bulkWrite(bulkOps, { ordered: false });
    console.log('bulkWrite result:', JSON.stringify({ matchedCount: res.matchedCount, modifiedCount: res.modifiedCount, upsertedCount: res.upsertedCount }));

    await mongoose.disconnect();
    console.log('Migración completa. Haz backup antes de ejecutar en staging/producción.');
    process.exit(0);

  }catch(err){
    console.error('Error:', err && err.stack ? err.stack : err);
    try{ await mongoose.disconnect(); }catch(e){}
    process.exit(2);
  }
})();
