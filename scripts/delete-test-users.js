#!/usr/bin/env node
/* Delete last two users with firstName 'Test' from MongoDB
   Usage: node delete-test-users.js
   It reads DATABASE_URL from .env in the repo root.
*/

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load .env if present
// Try several common .env locations used in this repo
const possibleEnvPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend', '.env'),
  path.resolve(process.cwd(), 'config', 'files', '.env'),
  path.resolve(process.cwd(), 'config', 'cli', 'conect', '.env'),
  path.resolve(process.cwd(), 'config', 'conect', '.env')
];

let loaded = false;
for (const p of possibleEnvPaths) {
  try {
    if (require('fs').existsSync(p)) {
      dotenv.config({ path: p });
      console.log('Loaded env from', p);
      loaded = true;
      break;
    }
  } catch (e) {
    // ignore
  }
}
if (!loaded) {
  // fallback: try default dotenv
  dotenv.config();
}

const mongoUrl = process.env.DATABASE_URL || process.env.MONGO_URL || process.env.MONGO_URI;
if (!mongoUrl) {
  console.error('DATABASE_URL (or MONGO_URL/MONGO_URI) not found in environment. Aborting.');
  process.exit(1);
}

// Safety: refuse to connect to remote databases. Only allow local MongoDB.
// Allowed patterns: connection string contains 'localhost' or '127.0.0.1'.
// Disallow mongodb+srv and hostnames that are not explicit local addresses.
const lower = String(mongoUrl).toLowerCase();
if (!lower.includes('localhost') && !lower.includes('127.0.0.1')) {
  console.error('\nRefusing to run: detected non-local DATABASE_URL.');
  console.error('This script only runs against a local MongoDB (localhost or 127.0.0.1).');
  console.error('Detected DATABASE_URL:', mongoUrl);
  console.error('If you really want to run this against a non-local DB, edit the script explicitly. Aborting.\n');
  process.exit(1);
}

async function run() {
  try {
    await mongoose.connect(mongoUrl);
    console.log('Connected to MongoDB');

    // Define minimal User model for deletion
    const userSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
    const User = mongoose.model('UserForCleanup', userSchema);

    // CLI flags
    const args = process.argv.slice(2);
    const deleteAll = args.includes('--all');
    const autoYes = args.includes('--yes') || args.includes('-y');

    // Find users with username 'test' (case-insensitive) ordered by createdAt desc (fallback to _id if no createdAt)
    // Keep fallback to firstName 'Test' for compatibility.
    let q = User.find({
      $or: [
        { username: { $regex: '^test$', $options: 'i' } },
        { firstName: { $regex: '^Test$', $options: 'i' } }
      ]
    }).sort({ createdAt: -1, _id: -1 });
    if (!deleteAll) q = q.limit(2);
    const docs = await q.exec();
    if (!docs || docs.length === 0) {
      console.log('No users with firstName "Test" found.');
      await mongoose.disconnect();
      return;
    }

    console.log(`Found ${docs.length} user(s) to delete:`);
    docs.forEach(d => console.log(` - ${d._id} | ${d.email || d.username || '<no-email>'}`));

    // Ask for confirmation before deleting (unless autoYes)
    let answer = 'no';
    if (autoYes) {
      answer = 'yes';
    } else {
      const readline = require('readline');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      answer = await new Promise(resolve => {
        rl.question('Proceed to delete these users? (yes/no) ', ans => { rl.close(); resolve(String(ans).trim().toLowerCase()); });
      });
    }
    if (answer !== 'yes' && answer !== 'y') {
      console.log('Aborted by user. No changes made.');
      await mongoose.disconnect();
      return;
    }

    const ids = docs.map(d => d._id);
    const res = await User.deleteMany({ _id: { $in: ids } });
    console.log('Delete result:', res);

    await mongoose.disconnect();
    console.log('Disconnected. Done.');
  } catch (err) {
    console.error('Error:', err);
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(1);
  }
}

run();
