import UserController from '@/controllers/user.controller';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockUserService = {
  getUsersPaginated: jest.fn(),
};

jest.mock('@/services/bunny.service', () => {
  const mockInstance = { deleteFile: jest.fn(), uploadFilePreserveOriginal: jest.fn() };
  return {
    __esModule: true,
    default: { getInstance: jest.fn().mockReturnValue(mockInstance) },
  };
});

const makeRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makeReq = (query = {}): any => ({ query, params: {}, body: {} });

// ── Tests ──────────────────────────────────────────────────────────────────

describe('UserController.getUsersPaginated', () => {
  let controller: UserController;
  const next = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new UserController(mockUserService as any);
    mockUserService.getUsersPaginated.mockResolvedValue({
      data: [],
      pagination: { page: 1, page_size: 10, total: 0, totalPages: 0 },
    });
  });

  test('should read page_size from query (not limit)', async () => {
    const req = makeReq({ page: '1', page_size: '20', sort: 'createdAt', sort_dir: 'ASC' });
    const res = makeRes();

    await controller.getUsersPaginated(req, res, next);

    expect(mockUserService.getUsersPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20 })
    );
  });

  test('should fallback to limit if page_size is not provided', async () => {
    const req = makeReq({ page: '1', limit: '15' });
    const res = makeRes();

    await controller.getUsersPaginated(req, res, next);

    expect(mockUserService.getUsersPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 15 })
    );
  });

  test('should default to limit=10 if neither page_size nor limit provided', async () => {
    const req = makeReq({ page: '1' });
    const res = makeRes();

    await controller.getUsersPaginated(req, res, next);

    expect(mockUserService.getUsersPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10 })
    );
  });

  test('should read sort_dir correctly (ASC -> 1)', async () => {
    const req = makeReq({ sort_dir: 'ASC' });
    const res = makeRes();

    await controller.getUsersPaginated(req, res, next);

    expect(mockUserService.getUsersPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ dir: 1 })
    );
  });

  test('should read sort_dir correctly (DESC -> -1)', async () => {
    const req = makeReq({ sort_dir: 'DESC' });
    const res = makeRes();

    await controller.getUsersPaginated(req, res, next);

    expect(mockUserService.getUsersPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ dir: -1 })
    );
  });

  test('should pass role filter to service', async () => {
    const req = makeReq({ role: 'ALUMNO' });
    const res = makeRes();

    await controller.getUsersPaginated(req, res, next);

    expect(mockUserService.getUsersPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'ALUMNO' })
    );
  });

  test('should pass courseId filter to service including "none"', async () => {
    const req = makeReq({ courseId: 'none' });
    const res = makeRes();

    await controller.getUsersPaginated(req, res, next);

    expect(mockUserService.getUsersPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ courseId: 'none' })
    );
  });

  test('should pass search term to service', async () => {
    const req = makeReq({ search: 'john' });
    const res = makeRes();

    await controller.getUsersPaginated(req, res, next);

    expect(mockUserService.getUsersPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'john' })
    );
  });

  test('should return 200 with paginated data', async () => {
    const mockData = { data: [{ _id: '1', email: 'a@b.com' }], pagination: { page: 1, page_size: 10, total: 1, totalPages: 1 } };
    mockUserService.getUsersPaginated.mockResolvedValue(mockData);

    const req = makeReq({ page: '1', page_size: '10' });
    const res = makeRes();

    await controller.getUsersPaginated(req, res, next);

    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('should call next(error) on service failure', async () => {
    mockUserService.getUsersPaginated.mockRejectedValue(new Error('DB error'));

    const req = makeReq({});
    const res = makeRes();

    await controller.getUsersPaginated(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
describe('UserController.getSignedContract', () => {
  let controller: UserController;
  const next = jest.fn();
  const mockUserService = { getSignedContract: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new UserController(mockUserService as any);
  });

  test('should return signed contract when service resolves', async () => {
    const req = { params: { userId: '507f1f77bcf86cd799439011' } } as any;
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() } as any;

    mockUserService.getSignedContract.mockResolvedValue({ url: 'http://cdn/contracts/abc.pdf' });

    await controller.getSignedContract(req, res, next);

    expect(mockUserService.getSignedContract).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
      success: true,
      data: { url: 'http://cdn/contracts/abc.pdf' }
    }));
  });
  
  test('should call next(error) when service throws', async () => {
    const req = { params: { userId: '507f1f77bcf86cd799439011' } } as any;
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() } as any;

    mockUserService.getSignedContract.mockRejectedValue(new Error('Contrato no disponible'));

    await controller.getSignedContract(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});