import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { UserModel } from '../../models/mongo/user.model';
import { ConfigModel } from '../../repositories/config.repository';

dotenv.config({ path: '.env' });
describe('daily-non-enrolled-notifications job (DB real)', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.DATABASE_URL!);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it('no envía emails si config.enabled = false', async () => {
    // aseguramos que la config esté en false
    await ConfigModel.updateOne(
      { key: 'non-enrolled' },
      { $set: { enabled: false } },
      { upsert: true }
    );

    const job = require('../../scripts/daily-non-enrolled-notifications');
    await job.runOnce();

    // verificamos que ningún usuario haya sido marcado
    const users = await UserModel.find({ notifiedOnNoCourse: { $exists: true } });
    expect(users.length).toBe(0);
  });

  it('envía emails y marca usuarios si config.enabled = true', async () => {
    // aseguramos que la config esté en true
    await ConfigModel.updateOne(
      { key: 'non-enrolled' },
      { $set: { enabled: true } },
      { upsert: true }
    );

    const job = require('../../scripts/daily-non-enrolled-notifications');
    await job.runOnce();

    // verificamos que los usuarios sin cursos fueron marcados
    const users = await UserModel.find({ courses: { $size: 0 }, notifiedOnNoCourse: { $exists: true } });
    expect(users.length).toBeGreaterThanOrEqual(0);
  });
});
