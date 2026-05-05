/// <reference types="jest" />
import path from 'path';

/* eslint-env jest */
process.env.NODE_ENV = 'test';
process.env.EMAIL_USE_ETHEREAL = 'false';
process.env.DIR_ERRORS = path.resolve(__dirname, 'src/config/errors/error.yml');

// Mock the database connection
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

afterAll(() => {});

jest.mock('uuid', () => ({
  v4: () => 'test-uuid',
}));