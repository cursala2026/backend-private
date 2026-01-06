import express from 'express';
import request from 'supertest';
import CategoryController from '../category.controller';

// Mock CategoryService minimal
const mockService: any = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOneById: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const app = express();
app.use(express.json());
const controller = new CategoryController(mockService);

app.post('/category', (req, res, next) => controller.create(req, res, next));
app.get('/categories', (req, res, next) => controller.findAll(req, res, next));
app.get('/category/:categoryId', (req, res, next) => controller.findOneById(req, res, next));
app.patch('/category/:id', (req, res, next) => controller.update(req, res, next));
app.delete('/category/:categoryId/delete', (req, res, next) => controller.delete(req, res, next));

describe('CategoryController (CRUD)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a category and returns 201', async () => {
    const fakeCategory = { _id: '1', name: 'Test', description: 'Desc' };
    mockService.create.mockResolvedValue(fakeCategory);

    const res = await request(app).post('/category').send({ name: 'Test', description: 'Desc' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toMatchObject({ name: 'Test', description: 'Desc' });
    expect(mockService.create).toHaveBeenCalledWith({ name: 'Test', description: 'Desc' });
  });

  it('returns all categories', async () => {
    const cats = [{ _id: '1', name: 'A' }, { _id: '2', name: 'B' }];
    mockService.findAll.mockResolvedValue(cats);

    const res = await request(app).get('/categories');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(mockService.findAll).toHaveBeenCalled();
  });

  it('returns one category by id', async () => {
    const cat = { _id: '1', name: 'A' };
    mockService.findOneById.mockResolvedValue(cat);

    const res = await request(app).get('/category/1');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'A' });
    expect(mockService.findOneById).toHaveBeenCalledWith('1');
  });

  it('updates a category', async () => {
    const updated = { _id: '1', name: 'Updated', description: 'New' };
    mockService.findById.mockResolvedValue({ _id: '1' });
    mockService.update.mockResolvedValue(updated);

    const res = await request(app).patch('/category/1').send({ name: 'Updated', description: 'New' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'Updated' });
    expect(mockService.update).toHaveBeenCalledWith('1', { name: 'Updated', description: 'New' });
  });

  it('deletes a category', async () => {
    const deleted = { _id: '1', name: 'ToDelete' };
    mockService.delete.mockResolvedValue(deleted);

    const res = await request(app).delete('/category/1/delete');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'ToDelete' });
    expect(mockService.delete).toHaveBeenCalledWith('1');
  });
});
