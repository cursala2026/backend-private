import { Request, Response, NextFunction } from 'express';
import { requireAdminOrQuestionnaireOwner } from '../questionnaire.middleware';
import QuestionnaireRepository from '@/repositories/questionnaire.repository';
import * as adminSecurityMiddleware from '../adminSecurity.middleware';

jest.mock('@/repositories/questionnaire.repository');
jest.mock('../adminSecurity.middleware');
jest.mock('@/models/mongo/course.model');

describe('requireAdminOrQuestionnaireOwner middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  let mockQuestionnaireRepo: jest.Mocked<QuestionnaireRepository>;

  beforeEach(() => {
    mockRequest = {
      params: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    nextFunction = jest.fn();
    mockQuestionnaireRepo = {
      findById: jest.fn(),
    } as any;

    (adminSecurityMiddleware.hasAdminRole as jest.Mock).mockResolvedValue(false);
  });

  it('should use req.params.questionnaireId if available', async () => {
    mockRequest.user = { _id: 'user1' } as any;
    mockRequest.params = { questionnaireId: 'q1' };
    
    mockQuestionnaireRepo.findById.mockResolvedValue({ createdBy: 'user1' } as any);

    const middleware = requireAdminOrQuestionnaireOwner(mockQuestionnaireRepo);
    await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockQuestionnaireRepo.findById).toHaveBeenCalledWith('q1');
    expect(nextFunction).toHaveBeenCalled();
  });

  it('should fallback to req.params.id if questionnaireId is not available', async () => {
    mockRequest.user = { _id: 'user1' } as any;
    mockRequest.params = { id: 'q2' }; // The case in update/delete
    
    mockQuestionnaireRepo.findById.mockResolvedValue({ createdBy: 'user1' } as any);

    const middleware = requireAdminOrQuestionnaireOwner(mockQuestionnaireRepo);
    await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockQuestionnaireRepo.findById).toHaveBeenCalledWith('q2');
    expect(nextFunction).toHaveBeenCalled();
  });
});
