import { ICertificate, CertificateSchema, CertificateDoc } from '@/models/mongo/certificate.model';
import { Connection, Model, Types } from '@/models';
import mongoose from 'mongoose';

class CertificateRepository {
  private readonly model: Model<ICertificate>;
  private anyModel: import('@/models/mongo/genericMongo.model').AnyModel<ICertificate>;

  constructor(private readonly connection: Connection) {
    this.model = this.connection.model<ICertificate>('Certificate', CertificateSchema, 'certificates');
    this.anyModel = this.model as import('@/models/mongo/genericMongo.model').AnyModel<ICertificate>;
  }

  /**
   * Finds a single certificate by verification code.
   * @param verificationCode - The certificate's verification code.
   * @returns A promise that resolves to the certificate object if found, or null.
   */
  async findOneByVerificationCode(verificationCode: string): Promise<CertificateDoc | null> {
    return this.model.findOne({ verificationCode, isActive: true }).exec() as Promise<CertificateDoc | null>;
  }

  /**
   * Finds a single certificate by ID.
   * @param id - The certificate's unique identifier.
   * @returns A promise that resolves to the certificate object if found, or null.
   */
  async findOneById(id: string): Promise<CertificateDoc | null> {
    return this.model.findById(id).exec() as Promise<CertificateDoc | null>;
  }

  /**
   * Finds an existing certificate for a student-course combination.
   * @param studentId - The student's ID.
   * @param courseId - The course's ID.
   * @returns A promise that resolves to the certificate object if found, or null.
   */
  async findExistingCertificate(studentId: string, courseId: string): Promise<CertificateDoc | null> {
    const rawFilter = {
      studentId: studentId,
      courseId: courseId,
      isActive: true,
    };
    const filter = rawFilter as unknown as import('mongoose').QueryFilter<ICertificate>;
    return this.model.findOne(filter).sort({ generatedAt: -1 }).exec() as Promise<CertificateDoc | null>;
  }

  /**
   * Creates and saves a new certificate.
   * @param certificateData - The certificate data to save.
   * @returns A promise that resolves to the saved certificate.
   */
  async create(certificateData: Omit<ICertificate, 'certificateId'>): Promise<CertificateDoc> {
    // Ensure any string IDs are converted to ObjectId (Mongoose accepts strings too, but normalize here)
    const data: Partial<ICertificate> = { ...certificateData };
    // Dejar los IDs como strings para que Mongoose los casteé al crear; evitar conflictos de tipos
    // con múltiples definiciones de ObjectId en el tipado durante la migración.
    return (await this.anyModel.create(data as Partial<ICertificate>) as unknown) as CertificateDoc;
  }

  /**
   * Updates an existing certificate by ID.
   * @param certificateId - The certificate's ID.
   * @param updateData - The data to update.
   * @returns A promise that resolves to the updated certificate or null.
   */
  async update(certificateId: string, updateData: Partial<ICertificate>): Promise<CertificateDoc | null> {
    return (await this.model.findByIdAndUpdate(certificateId, updateData, { new: true }).exec()) as CertificateDoc | null;
  }

  /**
   * Finds all certificates for a specific course.
   * @param courseId - The course's ID.
   * @returns A promise that resolves to an array of certificates.
   */
  findByCourse(courseId: string): Promise<CertificateDoc[]> {
    const filter = ({ courseId: courseId, isActive: true } as unknown) as import('mongoose').QueryFilter<ICertificate>;
    return this.model
      .find(filter)
      .populate('studentId', 'firstName lastName email')
      .populate('generatedBy', 'firstName lastName')
      .sort({ generatedAt: -1 })
      .exec() as Promise<CertificateDoc[]>;
  }

  /**
   * Finds all certificates for a specific student.
   * @param studentId - The student's ID.
   * @returns A promise that resolves to an array of certificates.
   */
  findByStudent(studentId: string): Promise<CertificateDoc[]> {
    const filter2 = ({ studentId: studentId, isActive: true } as unknown) as import('mongoose').QueryFilter<ICertificate>;
    return this.model
      .find(filter2)
      .populate('courseId', 'name description')
      .populate('teacherId', 'firstName lastName')
      .populate('generatedBy', 'firstName lastName')
      .sort({ generatedAt: -1 })
      .exec() as Promise<CertificateDoc[]>;
  }

  /**
   * Finds all certificates (for debug purposes).
   * @returns A promise that resolves to all certificates.
   */
  findAll(): Promise<CertificateDoc[]> {
    return this.model
      .find({})
      .populate('studentId', 'firstName lastName email')
      .populate('courseId', 'name')
      .populate('teacherId', 'firstName lastName')
      .populate('generatedBy', 'firstName lastName')
      .sort({ generatedAt: -1 })
      .exec() as Promise<CertificateDoc[]>;
  }

  /**
   * Validates a certificate with populated data.
   * @param verificationCode - The certificate's verification code.
   * @returns A promise that resolves to the certificate with populated data or null.
   */
  async validateCertificate(verificationCode: string): Promise<CertificateDoc | null> {
    const filter3 = ({ verificationCode, isActive: true } as unknown) as import('mongoose').QueryFilter<ICertificate>;
    return this.model.findOne(filter3).populate('generatedBy', 'firstName lastName').exec() as Promise<CertificateDoc | null>;
  }

  /**
   * Soft deletes a certificate by setting isActive to false.
   * @param certificateId - The certificate's ID.
   * @returns A promise that resolves to the updated certificate or null.
   */
  async softDelete(certificateId: string): Promise<CertificateDoc | null> {
    return (await this.model.findByIdAndUpdate(certificateId, { isActive: false }, { new: true }).exec()) as CertificateDoc | null;
  }
}

export default CertificateRepository;
