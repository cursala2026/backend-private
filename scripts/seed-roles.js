#!/usr/bin/env node
/*
  Script idempotente para asegurar roles fijos y asignar ALUMNO a usuarios sin roles.
  Uso: node scripts/seed-roles.js
  Lee `DATABASE_URL` desde `backend/.env` (usa dotenv).
*/
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/cursala';

async function main() {
  console.log('Connecting to', DATABASE_URL);
  try {
    await mongoose.connect(DATABASE_URL);
    const db = mongoose.connection.db;
    const rolesColl = db.collection('roles');
    const usersColl = db.collection('users');

    const rolesToEnsure = [
      { code: 'ADMIN', name: 'Administrador' },
      { code: 'PROFESOR', name: 'Profesor' },
      { code: 'ALUMNO', name: 'Alumno' }
    ];

    const created = [];
    const ensured = [];

    for (const r of rolesToEnsure) {
      const existing = await rolesColl.findOne({ code: r.code });
      if (!existing) {
        const now = new Date();
        const insertRes = await rolesColl.insertOne({ code: r.code, name: r.name, features: [], createdAt: now, updatedAt: now });
        created.push({ code: r.code, id: insertRes.insertedId.toString() });
        ensured.push({ code: r.code, id: insertRes.insertedId });
        console.log('Created role', r.code, insertRes.insertedId.toString());
      } else {
        ensured.push({ code: r.code, id: existing._id });
        console.log('Role exists', r.code, String(existing._id));
      }
    }

    // Find ALUMNO id
    const alumnoRole = await rolesColl.findOne({ code: 'ALUMNO' });
    if (!alumnoRole) {
      throw new Error('ALUMNO role not found after ensure step');
    }
    const alumnoId = alumnoRole._id;

    // Update users without roles: roles missing, null, or empty array
    const filter = { $or: [ { roles: { $exists: false } }, { roles: null }, { roles: { $size: 0 } } ] };
    const update = { $set: { roles: [alumnoId], updatedAt: new Date() } };

    const updateRes = await usersColl.updateMany(filter, update);
    console.log(`Assigned ALUMNO role to users without roles: matched=${updateRes.matchedCount}, modified=${updateRes.modifiedCount}`);

    console.log('Seed complete. Summary:');
    console.log('  Roles created:', created);
    console.log('  Roles ensured:', ensured.map(r => ({ code: r.code, id: String(r.id) })));

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error during seed:', err);
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(1);
  }
}

main();
