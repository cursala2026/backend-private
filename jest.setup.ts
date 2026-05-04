/// <reference types="jest" />

/* eslint-env jest */
// Setup file executed before test suites
// Mock the database connection to avoid opening real connections during unit/integration tests
jest.mock('@/config/databases', () => ({
  __esModule: true,
  default: {
    model: () => ({
      find: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findOneAndUpdate: jest.fn(),
      create: jest.fn(),
      aggregate: jest.fn(),
      countDocuments: jest.fn(),
    }),
  },
}));

afterAll(() => {
  // noop by default. Add explicit tear-down if your tests open connections.
});

jest.mock('uuid', () => ({
  v4: () => 'test-uuid',
}));
