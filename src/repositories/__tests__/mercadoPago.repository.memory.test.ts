import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import MercadoPagoRepository from '../mercadoPago.repository';
import { MercadoPagoPaymentSchema, MercadoPagoPaymentStatus } from '@/models/mongo/mercadoPago.model';

describe('MercadoPagoRepository (with mongodb-memory-server)', () => {
  let mongoServer: MongoMemoryServer;
  let repository: MercadoPagoRepository;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    
    mongoose.connection.model('MercadoPagoPayment', MercadoPagoPaymentSchema, 'mercadoPagoPayments');
    
    repository = new MercadoPagoRepository(mongoose.connection as any);
  }, 30000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  describe('createPayment and finders', () => {
    it('should create and find payment by paymentId, externalReference, or AnyId', async () => {
      const data = {
        paymentId: 'PAY-123',
        externalReference: 'EXT-123',
        courseId: new Types.ObjectId(),
        courseName: 'Course 1',
        studentEmail: 'student@test.com',
        transactionAmount: 1500,
        status: MercadoPagoPaymentStatus.PENDING,
        paymentType: 'credit_card'
      };

      const created = await repository.createPayment(data as any);
      expect(created.paymentId).toBe('PAY-123');
      expect(created._id).toBeDefined();

      const byPayId = await repository.findByPaymentId('PAY-123');
      expect(byPayId).not.toBeNull();
      
      const byExtRef = await repository.findByExternalReference('EXT-123');
      expect(byExtRef).not.toBeNull();

      // AnyId
      const byAnyId1 = await repository.findPaymentByAnyId('PAY-123');
      expect(byAnyId1).not.toBeNull();

      const byAnyId2 = await repository.findPaymentByAnyId(created._id!.toString());
      expect(byAnyId2).not.toBeNull();
    });
  });

  describe('update methods', () => {
    let paymentId = 'PAY-UPD';
    let mongoId: string;

    beforeEach(async () => {
      const created = await repository.createPayment({
        paymentId,
        externalReference: 'EXT-UPD',
        courseId: new Types.ObjectId(),
        courseName: 'Course',
        studentEmail: 'stu@test.com',
        transactionAmount: 100,
        status: MercadoPagoPaymentStatus.PENDING,
        isProcessed: false,
        accessGranted: false,
      } as any);
      mongoId = created._id!.toString();
    });

    it('should update payment status to APPROVED and set dateApproved', async () => {
      const updated = await repository.updatePaymentStatus(paymentId, MercadoPagoPaymentStatus.APPROVED);
      expect(updated!.status).toBe(MercadoPagoPaymentStatus.APPROVED);
      expect(updated!.dateApproved).toBeDefined();
    });

    it('should mark as processed', async () => {
      const updated = await repository.markAsProcessed(paymentId);
      expect(updated!.isProcessed).toBe(true);
      expect(updated!.dateProcessed).toBeDefined();
    });

    it('should grant access', async () => {
      const updated = await repository.grantAccess(paymentId);
      expect(updated!.accessGranted).toBe(true);
      expect(updated!.accessGrantedAt).toBeDefined();
    });
  });

  describe('queries: getPaymentsByStudent, Course, Pending, All', () => {
    it('should retrieve correctly', async () => {
      const courseId = new Types.ObjectId();
      
      await repository.createPayment({
        paymentId: 'P1',
        externalReference: 'E1',
        courseId,
        courseName: 'Course',
        studentEmail: 'a@test.com',
        transactionAmount: 10,
        status: MercadoPagoPaymentStatus.APPROVED,
        isProcessed: false,
      } as any);

      await repository.createPayment({
        paymentId: 'P2',
        externalReference: 'E2',
        courseId,
        courseName: 'Course',
        studentEmail: 'b@test.com',
        transactionAmount: 10,
        status: MercadoPagoPaymentStatus.PENDING,
        isProcessed: false,
      } as any);

      const byStu = await repository.getPaymentsByStudent('a@test.com');
      expect(byStu).toHaveLength(1);

      const byCou = await repository.getPaymentsByCourse(courseId.toString());
      expect(byCou).toHaveLength(2);

      const pend = await repository.getPendingPayments();
      // Only APPROVED AND not processed
      expect(pend).toHaveLength(1);
      expect(pend[0].paymentId).toBe('P1');

      const all = await repository.getAllPayments(10);
      expect(all).toHaveLength(2);
    });
  });

  describe('getPaymentStats (Aggregation)', () => {
    it('should calculate stats using $cond', async () => {
      await repository.createPayment({
        paymentId: 'S1', externalReference: 'S1', courseName: 'C', courseId: new Types.ObjectId(), studentEmail: 'e@e.com',
        status: MercadoPagoPaymentStatus.APPROVED, transactionAmount: 100
      } as any);

      await repository.createPayment({
        paymentId: 'S2', externalReference: 'S2', courseName: 'C', courseId: new Types.ObjectId(), studentEmail: 'e@e.com',
        status: MercadoPagoPaymentStatus.APPROVED, transactionAmount: 200
      } as any);

      await repository.createPayment({
        paymentId: 'S3', externalReference: 'S3', courseName: 'C', courseId: new Types.ObjectId(), studentEmail: 'e@e.com',
        status: MercadoPagoPaymentStatus.PENDING, transactionAmount: 50
      } as any);

      await repository.createPayment({
        paymentId: 'S4', externalReference: 'S4', courseName: 'C', courseId: new Types.ObjectId(), studentEmail: 'e@e.com',
        status: MercadoPagoPaymentStatus.REJECTED, transactionAmount: 500
      } as any);

      const stats = await repository.getPaymentStats();

      expect(stats.total).toBe(4);
      expect(stats.approved).toBe(2);
      expect(stats.pending).toBe(1);
      expect(stats.rejected).toBe(1);
      // Only approved amount is summed
      expect(stats.totalAmount).toBe(300);
    });

    it('should return empty stats if no records', async () => {
      const stats = await repository.getPaymentStats();
      expect(stats.total).toBe(0);
      expect(stats.totalAmount).toBe(0);
    });
  });

  describe('deletePayment', () => {
    it('should delete a payment by AnyId', async () => {
      const p = await repository.createPayment({ paymentId: 'DEL-1', externalReference: 'D', courseId: new Types.ObjectId(), courseName: 'C', studentEmail: 'e@test.com', status: MercadoPagoPaymentStatus.PENDING, transactionAmount: 10 } as any);
      
      const res = await repository.deletePayment('DEL-1');
      expect(res.deletedCount).toBe(1);
      
      const res2 = await repository.deletePayment(p._id!.toString());
      expect(res2.deletedCount).toBe(0); // already deleted
    });
  });
});
