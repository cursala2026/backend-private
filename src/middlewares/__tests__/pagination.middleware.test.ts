import { Request, Response, NextFunction } from 'express';
import pagination from '../pagination.middleware';
import * as utils from '@/utils';

jest.mock('@/utils', () => {
  const originalUtils = jest.requireActual('@/utils');
  return {
    ...originalUtils,
    paginate: jest.fn(),
    sortBy: jest.fn(),
  };
});

describe('pagination.middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction = jest.fn();

  beforeEach(() => {
    mockRequest = {
      query: {},
    };
    mockResponse = {};
    nextFunction = jest.fn();
    jest.clearAllMocks();
  });

  it('should call paginate and sortBy and assign results to req.query', () => {
    (utils.paginate as jest.Mock).mockReturnValue({ page: 2, limit: 20 });
    (utils.sortBy as jest.Mock).mockReturnValue({ sort: 'name', dir: 1 });

    mockRequest.query = { customParam: 'value' };

    pagination(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(utils.paginate).toHaveBeenCalledWith(mockRequest.query);
    expect(utils.sortBy).toHaveBeenCalledWith(mockRequest.query);
    
    expect(mockRequest.query).toEqual({
      customParam: 'value',
      page: 2,
      limit: 20,
      sort: 'name',
      dir: 1,
    });
    
    expect(nextFunction).toHaveBeenCalledTimes(1);
  });
});
