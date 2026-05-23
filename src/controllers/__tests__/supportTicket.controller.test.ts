import { Request, Response, NextFunction } from 'express';
import SupportTicketController from '../supportTicket.controller';
import SupportTicketService from '@/services/supportTicket.service';

jest.mock('@/services/bunny.service', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn().mockReturnValue({
      generateUniqueFileName: jest.fn().mockReturnValue('unique-ticket.jpg'),
      uploadFile: jest.fn().mockResolvedValue('https://cdn.example.com/ticket.jpg'),
    }),
  },
}));

jest.mock('@/services/supportTicket.service');
jest.mock('@/utils', () => ({
  logger: { error: jest.fn(), warn: jest.fn() },
  prepareResponse: (status: number, message: string, data?: any, pagination?: any) => ({ status, message, data, pagination }),
}));

describe('SupportTicketController', () => {
  let controller: SupportTicketController;
  let mockService: jest.Mocked<SupportTicketService>;
  let mockBunnyService: any;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  const mockTicket = { _id: 'ticket-1', subject: 'Test', message: 'Hello' };
  const mockUser = { _id: 'user-1', email: 'test@test.com', firstName: 'Juan', lastName: 'Perez' };

  beforeEach(() => {
    jest.clearAllMocks();

    // Capturar la instancia mockeada de BunnyService
    const BunnyServiceMock = jest.requireMock('@/services/bunny.service');
    mockBunnyService = BunnyServiceMock.default.getInstance();
    mockBunnyService.generateUniqueFileName.mockReturnValue('unique-ticket.jpg');
    mockBunnyService.uploadFile.mockResolvedValue('https://cdn.example.com/ticket.jpg');

    mockService = new SupportTicketService({} as any) as jest.Mocked<SupportTicketService>;
    controller = new SupportTicketController(mockService);
    req = { body: {}, params: {}, query: {}, user: mockUser as any };
    res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    next = jest.fn();
  });

  describe('createTicket', () => {
    it('should create a ticket without file', async () => {
      req.body = { subject: 'Test', message: 'Hello' };
      req.file = undefined;
      mockService.createTicket.mockResolvedValue(mockTicket as any);

      await controller.createTicket(req as Request, res as Response, next);

      expect(mockService.createTicket).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', subject: 'Test', message: 'Hello' })
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 201 }));
    });

    it('should upload file to Bunny before creating ticket', async () => {
      req.body = { subject: 'Test', message: 'Hello' };
      req.file = { buffer: Buffer.from('img'), originalname: 'image.jpg' } as Express.Multer.File;
      mockService.createTicket.mockResolvedValue(mockTicket as any);

      await controller.createTicket(req as Request, res as Response, next);

      expect(mockBunnyService.generateUniqueFileName).toHaveBeenCalledWith('image.jpg', 'ticket');
      expect(mockBunnyService.uploadFile).toHaveBeenCalled();
      expect(mockService.createTicket).toHaveBeenCalledWith(
        expect.objectContaining({ imageUrl: 'https://cdn.example.com/ticket.jpg' })
      );
    });

    it('should return 400 if subject or message is missing', async () => {
      req.body = { subject: 'Test' }; // missing message

      await controller.createTicket(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockService.createTicket).not.toHaveBeenCalled();
    });

    it('should call next on error', async () => {
      req.body = { subject: 'Test', message: 'Hello' };
      mockService.createTicket.mockRejectedValue(new Error('fail'));
      await controller.createTicket(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getMyTickets', () => {
    it('should return user tickets with pagination defaults', async () => {
      req.query = {};
      const result = { data: [mockTicket], pagination: { total: 1 } };
      mockService.getUserTickets.mockResolvedValue(result as any);

      await controller.getMyTickets(req as Request, res as Response, next);

      expect(mockService.getUserTickets).toHaveBeenCalledWith('user-1', { page: 1, limit: 20, status: undefined });
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should parse query params for pagination', async () => {
      req.query = { page: '2', limit: '10', status: 'open' };
      const result = { data: [], pagination: {} };
      mockService.getUserTickets.mockResolvedValue(result as any);

      await controller.getMyTickets(req as Request, res as Response, next);

      expect(mockService.getUserTickets).toHaveBeenCalledWith('user-1', { page: 2, limit: 10, status: 'open' });
    });

    it('should call next on error', async () => {
      mockService.getUserTickets.mockRejectedValue(new Error('fail'));
      await controller.getMyTickets(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getAllTickets', () => {
    it('should return all tickets', async () => {
      req.query = {};
      const result = { data: [mockTicket], pagination: {} };
      mockService.getAllTickets.mockResolvedValue(result as any);

      await controller.getAllTickets(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should call next on error', async () => {
      mockService.getAllTickets.mockRejectedValue(new Error('fail'));
      await controller.getAllTickets(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getTicketById', () => {
    it('should return ticket by id', async () => {
      req.params = { id: 'ticket-1' };
      mockService.getTicketById.mockResolvedValue(mockTicket as any);

      await controller.getTicketById(req as Request, res as Response, next);

      expect(mockService.getTicketById).toHaveBeenCalledWith('ticket-1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should return 404 if ticket not found', async () => {
      req.params = { id: 'no-existe' };
      mockService.getTicketById.mockResolvedValue(null as any);

      await controller.getTicketById(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should call next on error', async () => {
      req.params = { id: 'ticket-1' };
      mockService.getTicketById.mockRejectedValue(new Error('fail'));
      await controller.getTicketById(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('resolveTicket', () => {
    it('should resolve a ticket', async () => {
      req.params = { id: 'ticket-1' };
      req.body = { adminNotes: 'Solved!' };
      mockService.resolveTicket.mockResolvedValue({ ...mockTicket, status: 'resolved' } as any);

      await controller.resolveTicket(req as Request, res as Response, next);

      expect(mockService.resolveTicket).toHaveBeenCalledWith('ticket-1', 'user-1', 'Solved!');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should return 404 if ticket not found', async () => {
      req.params = { id: 'no-existe' };
      mockService.resolveTicket.mockResolvedValue(null as any);

      await controller.resolveTicket(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should call next on error', async () => {
      req.params = { id: 'ticket-1' };
      mockService.resolveTicket.mockRejectedValue(new Error('fail'));
      await controller.resolveTicket(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('updateStatus', () => {
    it('should update ticket status', async () => {
      req.params = { id: 'ticket-1' };
      req.body = { status: 'IN_PROGRESS' };
      mockService.updateTicketStatus.mockResolvedValue({ ...mockTicket, status: 'in_progress' } as any);

      await controller.updateStatus(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should return 400 for invalid status', async () => {
      req.params = { id: 'ticket-1' };
      req.body = { status: 'invalid_status' };

      await controller.updateStatus(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockService.updateTicketStatus).not.toHaveBeenCalled();
    });

    it('should return 404 if ticket not found', async () => {
      req.params = { id: 'no-existe' };
      req.body = { status: 'PENDING' };
      mockService.updateTicketStatus.mockResolvedValue(null as any);

      await controller.updateStatus(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('updateNotes', () => {
    it('should update admin notes', async () => {
      req.params = { id: 'ticket-1' };
      req.body = { adminNotes: 'Working on it' };
      mockService.updateAdminNotes.mockResolvedValue({ ...mockTicket } as any);

      await controller.updateNotes(req as Request, res as Response, next);

      expect(mockService.updateAdminNotes).toHaveBeenCalledWith('ticket-1', 'Working on it');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should return 400 if adminNotes is missing', async () => {
      req.params = { id: 'ticket-1' };
      req.body = {};

      await controller.updateNotes(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockService.updateAdminNotes).not.toHaveBeenCalled();
    });

    it('should return 404 if ticket not found', async () => {
      req.params = { id: 'no-existe' };
      req.body = { adminNotes: 'Note' };
      mockService.updateAdminNotes.mockResolvedValue(null as any);

      await controller.updateNotes(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getStats', () => {
    it('should return ticket stats', async () => {
      const stats = { open: 5, closed: 10 };
      mockService.getStats.mockResolvedValue(stats as any);

      await controller.getStats(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200, data: stats }));
    });

    it('should call next on error', async () => {
      mockService.getStats.mockRejectedValue(new Error('fail'));
      await controller.getStats(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('deleteTicket', () => {
    it('should delete a ticket', async () => {
      req.params = { id: 'ticket-1' };
      mockService.deleteTicket.mockResolvedValue(true as any);

      await controller.deleteTicket(req as Request, res as Response, next);

      expect(mockService.deleteTicket).toHaveBeenCalledWith('ticket-1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });

    it('should return 404 if ticket not found', async () => {
      req.params = { id: 'no-existe' };
      mockService.deleteTicket.mockResolvedValue(false as any);

      await controller.deleteTicket(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should call next on error', async () => {
      req.params = { id: 'ticket-1' };
      mockService.deleteTicket.mockRejectedValue(new Error('fail'));
      await controller.deleteTicket(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
