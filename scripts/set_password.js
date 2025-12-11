const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

// Load .env from backend
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('No DATABASE_URL found in env');
  process.exit(1);
}

const username = process.argv[2];
const newPassword = process.argv[3];
if (!username || !newPassword) {
  console.error('Usage: node scripts/set_password.js <username> <newPassword>');
  process.exit(1);
}

(async () => {
  try {
    await mongoose.connect(DATABASE_URL);
    const users = mongoose.connection.collection('users');
    const hash = await bcrypt.hash(newPassword, 10);
    const res = await users.findOneAndUpdate({ username: username }, { $set: { password: hash } }, { returnDocument: 'after' });
    console.log('Updated user:', res.value ? { _id: res.value._id, username: res.value.username } : null);
    await mongoose.disconnect();
  } catch (e) {
    console.error('Error', e);
    process.exit(1);
  }
})();
