import { Schema, model } from 'mongoose';

const BaseConfigSchema = new Schema({
  key: { type: String, required: true, unique: true },
}, {discriminatorKey: 'kind', collection: 'configs'});

export const ConfigModel = model('Config', BaseConfigSchema);

const NonEnrolledConfigSchema = new Schema({
  enabled: { type: Boolean, default: false },
  senderEmail: { type: String },
  ctaUrl: { type: String, default: 'https://cursala.com.ar/cursos' },
  interestLink: { type: String, default: 'https://app.cursala.com.ar/alumno/profile' },
  unsubscribeLink: { type: String, default: 'https://app.cursala.com.ar/alumno/profile' },
});

const CourseStartConfigSchema = new Schema({
  enabled: { type: Boolean, default: false },
  senderEmail: { type: String },
  timeWindow: {
    start: { type: String },
    end: { type: String },
  }
});

export const NonEnrolledConfigModel = ConfigModel.discriminator('non-enrolled', NonEnrolledConfigSchema);
export const CourseStartConfigModel = ConfigModel.discriminator('course-start', CourseStartConfigSchema);

/**
 * Obtiene la configuración por clave
 */
export async function getConfig(key: string): Promise<any> {
  let Model;
  if (key === 'non-enrolled') {
    Model = NonEnrolledConfigModel;
  } else if (key === 'course-start') {
    Model = CourseStartConfigModel;
  } else {
    Model = ConfigModel;
  }

  const config = await Model.findOne({ key }).lean().exec();
  if (!config) {
    if (key === 'non-enrolled') {
      return {
        key,
        enabled: false,
        senderEmail: '',
        ctaUrl: 'https://cursala.com.ar/cursos',
        interestLink: 'https://app.cursala.com.ar/alumno/profile',
        unsubscribeLink: 'https://app.cursala.com.ar/alumno/profile',
      };
    }
    if (key === 'course-start') {
      return {
        key,
        enabled: false,
        senderEmail: '',
        timeWindow: {
          start: '08:00',
          end: '20:00',
        }
      };
    }
  }
  return config;
}

/**
 * Actualiza la configuración por clave
 */
export async function updateConfig(key: string, data: any): Promise<any | null> {
  let Model;
  let kind;
  if (key === 'non-enrolled') {
    Model = NonEnrolledConfigModel;
    kind = 'non-enrolled';
  } else if (key === 'course-start') {
    Model = CourseStartConfigModel;
    kind = 'course-start';
  } else {
    Model = ConfigModel;
    kind = undefined;
  }

  const updated = await Model.findOneAndUpdate(
    { key },
    { $set: { ...data, key, kind } },
    { new: true, upsert: true }
  ).lean().exec();
  return updated;
}
