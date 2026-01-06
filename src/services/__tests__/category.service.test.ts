/* eslint-env jest */
import CategoryService from '@/services/category.service';
import { ICategory } from '@/models';

describe('CategoryService - CRUD', () => {
    const mockRepo: any = {
        findOneById: jest.fn(),
        findById: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        findAll: jest.fn(),
    };

    let service: CategoryService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new CategoryService(mockRepo);
    });

    test('create calls repository and returns created category', async () => {
        const payload: Partial<ICategory> = { name: 'New', description: 'D' };
        const created = { _id: '1', ...payload } as unknown as ICategory;
        mockRepo.create.mockResolvedValue(created);

        const res = await service.create(payload);

        expect(mockRepo.create).toHaveBeenCalledWith(payload);
        expect(res).toBe(created);
    });

    test('findAll returns repository list', async () => {
        const list = [{ _id: '1', name: 'A' }];
        mockRepo.findAll.mockResolvedValue(list);
        const res = await service.findAll();
        expect(mockRepo.findAll).toHaveBeenCalled();
        expect(res).toBe(list);
    });

    test('findOneById proxies to repository', async () => {
        const item = { _id: '2', name: 'B' } as unknown as ICategory;
        mockRepo.findOneById.mockResolvedValue(item);
        const res = await service.findOneById('2');
        expect(mockRepo.findOneById).toHaveBeenCalledWith('2');
        expect(res).toBe(item);
    });

    test('findById proxies to repository', async () => {
        const item = { _id: '3', name: 'C' } as unknown as ICategory;
        mockRepo.findById.mockResolvedValue(item);
        const res = await service.findById('3');
        expect(mockRepo.findById).toHaveBeenCalledWith('3');
        expect(res).toBe(item);
    });

    test('update proxies to repository', async () => {
        const updated = { _id: '4', name: 'U' } as unknown as ICategory;
        mockRepo.update.mockResolvedValue(updated);
        const res = await service.update('4', { name: 'U' });
        expect(mockRepo.update).toHaveBeenCalledWith('4', { name: 'U' });
        expect(res).toBe(updated);
    });

    test('delete proxies to repository', async () => {
        const deleted = { _id: '5', name: 'D' } as unknown as ICategory;
        mockRepo.delete.mockResolvedValue(deleted);
        const res = await service.delete('5');
        expect(mockRepo.delete).toHaveBeenCalledWith('5');
        expect(res).toBe(deleted);
    });
});
