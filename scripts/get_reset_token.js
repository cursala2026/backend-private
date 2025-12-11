const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
// Load .env from backend folder
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('No DATABASE_URL found in env');
  process.exit(1);
}

const userEmail = process.argv[2];
if (!userEmail) {
  console.error('Usage: node scripts/get_reset_token.js <email>');
  process.exit(1);
}

(async () => {
  try {
    await mongoose.connect(DATABASE_URL);
    const User = mongoose.connection.collection('users');
    const u = await User.findOne({ email: userEmail });
    console.log(JSON.stringify(u || null, null, 2));
    await mongoose.disconnect();
  } catch (e) {
    console.error('Error', e);
    process.exit(1);
  }
})();
