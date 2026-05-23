import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import SupportTicketRepository from '../supportTicket.repository';
import { SupportTicketSchema, TicketStatus } from '@/models/mongo/supportTicket.model';
import { UserSchema } from '@/models';

describe('SupportTicketRepository (with mongodb-memory-server)', () => {
  let mongoServer: MongoMemoryServer;
  let repository: SupportTicketRepository;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    
    // Register schemas
    mongoose.connection.model('SupportTicket', SupportTicketSchema, 'supporttickets');
    mongoose.connection.model('User', UserSchema, 'users');
    
    repository = new SupportTicketRepository(mongoose.connection as any);
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

  describe('create and findById (populate test)', () => {
    it('should create a ticket and find it populated with user and resolvedBy', async () => {
      const UserModel = mongoose.connection.model('User');
      
      const user = await UserModel.create({
        firstName: 'John',
        lastName: 'Doe',
        username: 'johnny',
        password: 'pass',
        email: 'john@test.com'
      });

      const admin = await UserModel.create({
        firstName: 'Admin',
        lastName: 'Super',
        username: 'admin',
        password: 'pass',
        email: 'admin@test.com'
      });

      const ticket = await repository.create({
        userId: user._id,
        userName: 'John',
        userEmail: 'john@test.com',
        subject: 'Help',
        message: 'Need help',
        status: TicketStatus.RESOLVED,
        resolvedBy: admin._id
      } as any);

      const foundTicket = await repository.findById(ticket._id!.toString());
      
      expect(foundTicket).not.toBeNull();
      expect(foundTicket!.subject).toBe('Help');
      
      // Populate assertions
      expect(foundTicket!.userId).toBeDefined();
      expect((foundTicket!.userId as any).firstName).toBe('John');
      expect((foundTicket!.userId as any).email).toBe('john@test.com');
      
      expect(foundTicket!.resolvedBy).toBeDefined();
      expect((foundTicket!.resolvedBy as any).firstName).toBe('Admin');
    });
  });

  describe('findByUserId and findAll (pagination tests)', () => {
    it('should return paginated tickets for a user', async () => {
      const userId = new Types.ObjectId();
      
      // Create 3 tickets for this user
      await repository.create({ userId, userName: 'U', userEmail: 'u@test.com', subject: 'T1', message: 'M1' } as any);
      await repository.create({ userId, userName: 'U', userEmail: 'u@test.com', subject: 'T2', message: 'M2' } as any);
      await repository.create({ userId, userName: 'U', userEmail: 'u@test.com', subject: 'T3', message: 'M3' } as any);
      
      // Create a ticket for someone else
      await repository.create({ userId: new Types.ObjectId(), userName: 'O', userEmail: 'o@test.com', subject: 'Other', message: 'Other' } as any);

      // Get page 1, limit 2
      const res = await repository.findByUserId(userId.toString(), { page: 1, limit: 2 });
      
      expect(res.pagination.total).toBe(3);
      expect(res.pagination.totalPages).toBe(2);
      expect(res.pagination.page_size).toBe(2);
      expect(res.data.length).toBe(2);
    });

    it('should filter findAll by status', async () => {
      const userId = new Types.ObjectId();
      await repository.create({ userId, userName: 'U', userEmail: 'u@test.com', subject: 'Pending1', message: 'M', status: TicketStatus.PENDING } as any);
      await repository.create({ userId, userName: 'U', userEmail: 'u@test.com', subject: 'Resolved1', message: 'M', status: TicketStatus.RESOLVED } as any);

      const res = await repository.findAll({ page: 1, limit: 10, status: TicketStatus.PENDING });
      
      expect(res.pagination.total).toBe(1);
      expect(res.data[0].subject).toBe('Pending1');
      // Should also be populated
      expect(res.data[0].userId).toBeNull(); // Was not created in UserModel, so populate returns null, but it doesn't crash
    });
  });

  describe('markAsResolved and stats', () => {
    it('should mark ticket as resolved and update stats correctly', async () => {
      const userId = new Types.ObjectId();
      const adminId = new Types.ObjectId();
      
      const ticket = await repository.create({ userId, userName: 'U', userEmail: 'u@test.com', subject: 'To Resolve', message: 'M', status: TicketStatus.PENDING } as any);
      
      let stats = await repository.getStats();
      expect(stats.total).toBe(1);
      expect(stats.pending).toBe(1);
      expect(stats.resolved).toBe(0);

      const resolved = await repository.markAsResolved(ticket._id!.toString(), adminId.toString(), 'Fixed it');
      
      expect(resolved!.status).toBe(TicketStatus.RESOLVED);
      expect(resolved!.adminNotes).toBe('Fixed it');
      expect(resolved!.resolvedBy!.toString()).toBe(adminId.toString());

      stats = await repository.getStats();
      expect(stats.pending).toBe(0);
      expect(stats.resolved).toBe(1);
    });
  });

  describe('update operations', () => {
    it('should update status', async () => {
      const ticket = await repository.create({ userId: new Types.ObjectId(), userName: 'U', userEmail: 'u@test.com', subject: 'S', message: 'M' } as any);
      const updated = await repository.updateStatus(ticket._id!.toString(), TicketStatus.IN_PROGRESS);
      expect(updated!.status).toBe(TicketStatus.IN_PROGRESS);
    });

    it('should update admin notes', async () => {
      const ticket = await repository.create({ userId: new Types.ObjectId(), userName: 'U', userEmail: 'u@test.com', subject: 'S', message: 'M' } as any);
      const updated = await repository.updateAdminNotes(ticket._id!.toString(), 'Some notes');
      expect(updated!.adminNotes).toBe('Some notes');
    });

    it('should delete a ticket', async () => {
      const ticket = await repository.create({ userId: new Types.ObjectId(), userName: 'U', userEmail: 'u@test.com', subject: 'S', message: 'M' } as any);
      const deleted = await repository.delete(ticket._id!.toString());
      expect(deleted).toBe(true);

      const count = await repository.countByStatus(TicketStatus.PENDING);
      expect(count).toBe(0);
    });
  });
});
