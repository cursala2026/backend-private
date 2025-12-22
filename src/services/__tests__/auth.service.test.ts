
/* eslint-env jest */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import config from '@/config';
import AuthService from '@/services/auth.service';
import errors from '@/config/errors';
// Mock nodemailer
jest.mock('nodemailer');
// Mocks para repositorios
const mockUserRepository: any = {
  findOne: jest.fn(),
  findOneByEmail: jest.fn(),
  findOneById: jest.fn(),
  updatePasswordResetToken: jest.fn(),
  createUser: jest.fn(),
  getUserById: jest.fn(),
  save: jest.fn(),
};
const mockRoleRepository: any = {
  getRoleByCode: jest.fn(),
};
let authService: AuthService;
let mockSendMail: jest.Mock;
let mockCreateTransport: jest.Mock;
beforeEach(() => {
  jest.clearAllMocks();
  mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
  mockCreateTransport = jest.fn().mockReturnValue({
    sendMail: mockSendMail,
  });
  (nodemailer.createTransport as jest.Mock) = mockCreateTransport;
  authService = new AuthService(mockUserRepository);
  // Default mocks used by multiple tests
  mockUserRepository.save.mockResolvedValue(true);
  mockRoleRepository.getRoleByCode.mockResolvedValue({ _id: 'default-role-id' });
});
describe('AuthService - login and validateUser', () => {
  test('login returns token and userInfo for valid credentials', async () => {
    const password = 'secret123';
    const hashed = await bcrypt.hash(password, 10);
    const userDoc: any = {
      _id: '507f1f77bcf86cd799439011',
      email: 'test@example.com',
      username: 'tester',
      password: hashed,
      roles: ['ROLE_USER'],
      firstName: 'Test',
      lastName: 'User',
    };
    mockUserRepository.findOne.mockResolvedValue(userDoc);
    const result = await authService.login('tester', password);
    expect(result).toHaveProperty('token');
    expect(typeof result.token).toBe('string');
    expect(result).toHaveProperty('userInfo');
    expect(result.userInfo.email).toBe('test@example.com');
    // Verify token is a valid JWT
    const decoded = jwt.verify(result.token, config.JWT_SECRET) as jwt.JwtPayload;
    expect(decoded._id).toBe(userDoc._id);
  });

  test('validateUser throws not_found if user is missing', async () => {
    mockUserRepository.findOne.mockResolvedValue(null);
    await expect(authService.validateUser('nonexistent', 'any')).rejects.toEqual(errors.login.users.not_found);
  });

  test('validateUser throws unauthorized for wrong password', async () => {
    const hashed = await bcrypt.hash('another', 10);
    const userDoc: any = {
      _id: '507f1f77bcf86cd799439011',
      email: 'test@example.com',
      username: 'tester',
      password: hashed,
      roles: [],
    };
    mockUserRepository.findOne.mockResolvedValue(userDoc);
    await expect(authService.validateUser('tester', 'wrong')).rejects.toEqual(errors.login.accounts.unauthorized);
  });

  test('validateUser returns user for valid credentials', async () => {
    const password = 'validpass';
    const hashed = await bcrypt.hash(password, 10);
    const userDoc: any = {
      _id: '507f1f77bcf86cd799439011',
      email: 'test@example.com',
      username: 'tester',
      password: hashed,
      roles: [],
    };
    mockUserRepository.findOne.mockResolvedValue(userDoc);
    const result = await authService.validateUser('tester', password);
    expect(result).toEqual(userDoc);
  });
});

describe('AuthService - Password Reset', () => {
  test('generateResetPasswordToken creates token and sends email', async () => {
    const userDoc: any = {
      _id: '507f1f77bcf86cd799439011',
      email: 'test@example.com',
      username: 'tester',
    };
    mockUserRepository.findOneByEmail.mockResolvedValue(userDoc);
    mockUserRepository.updatePasswordResetToken.mockResolvedValue(userDoc);
    const result = await authService.generateResetPasswordToken('test@example.com');
    expect(result).toHaveProperty('expiresIn');
    expect(typeof result.expiresIn).toBe('number');
    expect(mockUserRepository.findOneByEmail).toHaveBeenCalledWith('test@example.com');
    expect(mockUserRepository.updatePasswordResetToken).toHaveBeenCalled();
    expect(mockSendMail).toHaveBeenCalled();
  });

  test('generateResetPasswordToken throws error for unregistered email', async () => {
    mockUserRepository.findOneByEmail.mockResolvedValue(null);
    await expect(
      authService.generateResetPasswordToken('notfound@example.com')
    ).rejects.toEqual(errors.login.users.unregistered);
  });

  test('resetPassword updates user password with valid token', async () => {
    const userId = '507f1f77bcf86cd799439011';
    const token = jwt.sign({ userId }, config.JWT_SECRET, { expiresIn: '15m' });
    const newPassword = 'NewPassword123!';
    const userDoc: any = {
      _id: userId,
      password: 'old-password',
      save: jest.fn().mockResolvedValue(true),
    };
    // Ensure the token matches the user's stored reset token
    userDoc.resetPasswordToken = token;
    mockUserRepository.findOneById.mockResolvedValue(userDoc);
    const result = await authService.resetPassword(token, newPassword);
    expect(mockUserRepository.save).toHaveBeenCalled();
    // Password should be hashed in saved object
    const savedArg = mockUserRepository.save.mock.calls[0][0];
    const isHashed = await bcrypt.compare(newPassword, savedArg.password);
    expect(isHashed).toBe(true);
  });

  test('resetPassword throws error for invalid token', async () => {
    const invalidToken = 'invalid-token';
    const newPassword = 'NewPassword123!';
    await expect(
      authService.resetPassword(invalidToken, newPassword)
    ).rejects.toEqual(errors.password_reset.token_invalid);
  });

  test('resetPassword throws error for user not found', async () => {
    const userId = '507f1f77bcf86cd799439011';
    const token = jwt.sign({ userId }, config.JWT_SECRET, { expiresIn: '15m' });
    const newPassword = 'NewPassword123!';
    mockUserRepository.findOneById.mockResolvedValue(null);
    try {
      await authService.resetPassword(token, newPassword);
      throw new Error('Expected resetPassword to throw');
    } catch (err: any) {
      // Log the error for debugging in CI logs
      // eslint-disable-next-line no-console
      console.error('resetPassword threw:', err);
      expect(err).toEqual(errors.login.users.not_found);
    }
  });
});

describe('AuthService - getUserInfo', () => {
  test('getUserInfo extracts user info without password', () => {
    const user: any = {
      _id: '507f1f77bcf86cd799439011',
      email: 'john@example.com',
      username: 'johndoe',
      password: 'hashed-password',
      firstName: 'John',
      lastName: 'Doe',
    };
    mockUserRepository.getUserById.mockResolvedValue(user);
    return authService.getUserInfo(user).then((info) => {
      expect(info).toHaveProperty('_id');
      expect(info).toHaveProperty('email');
      expect(info).toHaveProperty('username');
      expect(info).not.toHaveProperty('password');
    });
  });
});

describe('AuthService - register', () => {
  test('register creates new user with hashed password', async () => {
    const newUser = {
      email: 'newuser@example.com',
      username: 'newuser',
      password: 'ValidPassword123!',
      firstName: 'New',
      lastName: 'User',
    };
    const createdUser: any = {
      ...newUser,
      _id: '507f1f77bcf86cd799439012',
    };
    mockUserRepository.findOneByEmail.mockResolvedValue(null);
    mockUserRepository.findOne.mockResolvedValue(null);
    mockUserRepository.createUser.mockResolvedValue(createdUser);
    const result = await authService.register(newUser);
    expect(result).toEqual(createdUser);
    expect(mockUserRepository.createUser).toHaveBeenCalled();
    // Check that password was hashed
    const createCall = mockUserRepository.createUser.mock.calls[0][0];
    expect(createCall.password).not.toBe(newUser.password);
  });

  test('register throws error for existing email', async () => {
    const newUser = {
      email: 'existing@example.com',
      username: 'newuser',
      password: 'ValidPassword123!',
      firstName: 'New',
      lastName: 'User',
    };
    mockUserRepository.findOneByEmail.mockResolvedValue({ _id: 'existing-id' });
    await expect(authService.register(newUser)).rejects.toEqual(errors.register.users.already_exists);
  });

  test('register throws error for existing username', async () => {
    const newUser = {
      email: 'new@example.com',
      username: 'existinguser',
      password: 'ValidPassword123!',
      firstName: 'New',
      lastName: 'User',
    };
    mockUserRepository.findOneByEmail.mockResolvedValue(null);
    mockUserRepository.findOne.mockResolvedValue({ _id: 'existing-id' });
    await expect(authService.register(newUser)).rejects.toEqual(errors.register.users.already_exists);
  });
});
