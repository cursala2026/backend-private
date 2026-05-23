import SupportTicketService from '../supportTicket.service';
import SupportTicketRepository from '@/repositories/supportTicket.repository';
import { TicketStatus } from '@/models/mongo/supportTicket.model';
import { logger } from '@/utils';

// Mock logger
jest.mock('@/utils', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('SupportTicketService', () => {
  let supportTicketService: SupportTicketService;
  let mockRepository: jest.Mocked<SupportTicketRepository>;

  const mockTicketId = 'ticket_123';
  const mockUserId = 'user_123';
  const mockTicket = {
    _id: mockTicketId,
    userId: mockUserId,
    userEmail: 'test@example.com',
    userName: 'Test User',
    subject: 'Test Subject',
    message: 'Test Message',
    status: TicketStatus.PENDING,
  } as any;

  beforeEach(() => {
    // Setup repository mock
    mockRepository = {
      create: jest.fn(),
      findByUserId: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      markAsResolved: jest.fn(),
      updateStatus: jest.fn(),
      updateAdminNotes: jest.fn(),
      getStats: jest.fn(),
      delete: jest.fn(),
    } as any;

    supportTicketService = new SupportTicketService(mockRepository);
    jest.clearAllMocks();
  });

  describe('createTicket', () => {
    it('should create a support ticket successfully', async () => {
      mockRepository.create.mockResolvedValue(mockTicket);

      const payload = {
        userId: mockUserId,
        userEmail: 'test@example.com',
        userName: 'Test User',
        subject: 'Test Subject',
        message: 'Test Message',
      };

      const result = await supportTicketService.createTicket(payload);

      expect(mockRepository.create).toHaveBeenCalledWith({
        ...payload,
        status: TicketStatus.PENDING,
      });
      expect(result).toEqual(mockTicket);
      expect(logger.debug).toHaveBeenCalledWith(`Ticket de soporte creado: ${mockTicketId} por usuario ${mockUserId}`);
    });

    it('should throw an error if repository fails', async () => {
      const error = new Error('Database error');
      mockRepository.create.mockRejectedValue(error);

      const payload = {
        userId: mockUserId,
        userEmail: 'test@example.com',
        userName: 'Test User',
        subject: 'Test Subject',
        message: 'Test Message',
      };

      await expect(supportTicketService.createTicket(payload)).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith(`Error creando ticket de soporte: Database error`);
    });
  });

  describe('getUserTickets', () => {
    it('should call findByUserId on repository', async () => {
      const params = { page: 1, limit: 10 };
      const mockResult = { docs: [mockTicket], totalDocs: 1, limit: 10, page: 1, totalPages: 1 } as any;
      mockRepository.findByUserId.mockResolvedValue(mockResult);

      const result = await supportTicketService.getUserTickets(mockUserId, params);

      expect(mockRepository.findByUserId).toHaveBeenCalledWith(mockUserId, params);
      expect(result).toEqual(mockResult);
    });
  });

  describe('resolveTicket', () => {
    it('should mark ticket as resolved and return it', async () => {
      mockRepository.markAsResolved.mockResolvedValue(mockTicket);
      
      const adminId = 'admin_123';
      const result = await supportTicketService.resolveTicket(mockTicketId, adminId, 'Fixed');

      expect(mockRepository.markAsResolved).toHaveBeenCalledWith(mockTicketId, adminId, 'Fixed');
      expect(logger.debug).toHaveBeenCalledWith(`Ticket ${mockTicketId} marcado como resuelto por admin ${adminId}`);
      expect(result).toEqual(mockTicket);
    });
  });
  
  describe('deleteTicket', () => {
    it('should delete ticket and return true', async () => {
      mockRepository.delete.mockResolvedValue(true);
      
      const result = await supportTicketService.deleteTicket(mockTicketId);

      expect(mockRepository.delete).toHaveBeenCalledWith(mockTicketId);
      expect(logger.debug).toHaveBeenCalledWith(`Ticket ${mockTicketId} eliminado`);
      expect(result).toBe(true);
    });
  });
});
