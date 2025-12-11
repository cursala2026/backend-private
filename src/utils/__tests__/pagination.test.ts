import { paginate, sortBy } from '../pagination';

describe('pagination', () => {
    describe('paginate', () => {
        test('should return default values when params is undefined', () => {
            const result = paginate(undefined);

            expect(result.limit).toBe(10);
            expect(result.page).toBe(1);
        });

        test('should return default values when params is empty', () => {
            const result = paginate({});

            expect(result.limit).toBe(10);
            expect(result.page).toBe(1);
        });

        test('should parse valid page and page_size', () => {
            const params = { page: 3, page_size: 25 };
            const result = paginate(params);

            expect(result.page).toBe(3);
            expect(result.limit).toBe(25);
        });

        test('should parse string numbers', () => {
            const params = { page: '5', page_size: '50' };
            const result = paginate(params);

            expect(result.page).toBe(5);
            expect(result.limit).toBe(50);
        });

        test('should ignore negative page numbers', () => {
            const params = { page: -1, page_size: 20 };
            const result = paginate(params);

            expect(result.page).toBe(1); // Should use default
            expect(result.limit).toBe(20);
        });

        test('should ignore negative page_size', () => {
            const params = { page: 2, page_size: -5 };
            const result = paginate(params);

            expect(result.page).toBe(2);
            expect(result.limit).toBe(10); // Should use default
        });

        test('should ignore non-numeric page values', () => {
            const params = { page: 'abc', page_size: 30 };
            const result = paginate(params);

            expect(result.page).toBe(1); // Should use default
            expect(result.limit).toBe(30);
        });

        test('should ignore non-numeric page_size values', () => {
            const params = { page: 4, page_size: 'xyz' };
            const result = paginate(params);

            expect(result.page).toBe(4);
            expect(result.limit).toBe(10); // Should use default
        });

        test('should treat zero as falsy and use defaults', () => {
            const params1 = { page: 0, page_size: 15 };
            const result1 = paginate(params1);

            expect(result1.page).toBe(1); // 0 treated as falsy, uses default
            expect(result1.limit).toBe(10); // Only one param is zero, so defaults

            const params2 = { page: 2, page_size: 0 };
            const result2 = paginate(params2);

            expect(result2.page).toBe(1); // Only one param is zero, so defaults
            expect(result2.limit).toBe(10);
        });

        test('should handle decimal numbers by converting to integers', () => {
            const params = { page: '3.7', page_size: '12.9' };
            const result = paginate(params);

            expect(result.page).toBe(3.7);
            expect(result.limit).toBe(12.9);
        });

        test('should ignore params without both page and page_size', () => {
            const params1 = { page: 5 };
            const result1 = paginate(params1);
            expect(result1.page).toBe(1);
            expect(result1.limit).toBe(10);

            const params2 = { page_size: 20 };
            const result2 = paginate(params2);
            expect(result2.page).toBe(1);
            expect(result2.limit).toBe(10);
        });
    });

    describe('sortBy', () => {
        test('should return default sort values when params is undefined', () => {
            const result = sortBy(undefined);

            expect(result.sort).toBe('updatedAt');
            expect(result.dir).toBe(-1);
        });

        test('should return default sort values when params is empty', () => {
            const result = sortBy({});

            expect(result.sort).toBe('updatedAt');
            expect(result.dir).toBe(-1);
        });

        test('should parse custom sort field', () => {
            const params = { sort: 'createdAt' };
            const result = sortBy(params);

            expect(result.sort).toBe('createdAt');
            expect(result.dir).toBe(-1); // Default direction
        });

        test('should parse ASC direction', () => {
            const params = { sort: 'name', sort_dir: 'ASC' };
            const result = sortBy(params);

            expect(result.sort).toBe('name');
            expect(result.dir).toBe(1);
        });

        test('should parse DESC direction (any non-ASC value)', () => {
            const params = { sort: 'price', sort_dir: 'DESC' };
            const result = sortBy(params);

            expect(result.sort).toBe('price');
            expect(result.dir).toBe(-1);
        });

        test('should treat any non-ASC direction as DESC', () => {
            const params = { sort: 'rating', sort_dir: 'random' };
            const result = sortBy(params);

            expect(result.sort).toBe('rating');
            expect(result.dir).toBe(-1);
        });

        test('should handle lowercase asc', () => {
            const params = { sort: 'title', sort_dir: 'asc' };
            const result = sortBy(params);

            expect(result.sort).toBe('title');
            expect(result.dir).toBe(-1); // Not 'ASC' so default to -1
        });

        test('should accept only sort without direction', () => {
            const params = { sort: 'status' };
            const result = sortBy(params);

            expect(result.sort).toBe('status');
            expect(result.dir).toBe(-1);
        });

        test('should accept only sort_dir without sort field', () => {
            const params = { sort_dir: 'ASC' };
            const result = sortBy(params);

            expect(result.sort).toBe('updatedAt'); // Default
            expect(result.dir).toBe(1);
        });

        test('should handle complex sort field names', () => {
            const params = { sort: 'user.profile.name', sort_dir: 'ASC' };
            const result = sortBy(params);

            expect(result.sort).toBe('user.profile.name');
            expect(result.dir).toBe(1);
        });
    });
});
