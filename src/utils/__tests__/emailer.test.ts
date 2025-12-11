import { sendEmail, EmailAttachment } from '../emailer';
import nodemailer from 'nodemailer';

// Mock nodemailer
jest.mock('nodemailer');

describe('emailer', () => {
    let mockSendMail: jest.Mock;
    let mockCreateTransport: jest.Mock;

    beforeEach(() => {
        mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-message-id' });
        mockCreateTransport = jest.fn().mockReturnValue({
            sendMail: mockSendMail,
        });
        (nodemailer.createTransport as jest.Mock) = mockCreateTransport;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('sendEmail', () => {
        test('should send email with basic parameters', async () => {
            await sendEmail({
                email: 'test@example.com',
                subject: 'Test Subject',
                html: '<p>Test content</p>',
            });

            expect(mockCreateTransport).toHaveBeenCalled();
            expect(mockSendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: 'test@example.com',
                    subject: 'Test Subject',
                    html: '<p>Test content</p>',
                })
            );
        });

        test('should send email with attachments', async () => {
            const attachments: EmailAttachment[] = [
                {
                    filename: 'test.pdf',
                    path: '/path/to/test.pdf',
                },
            ];

            await sendEmail({
                email: 'test@example.com',
                subject: 'Test with Attachment',
                html: '<p>Email with attachment</p>',
                attachments,
            });

            expect(mockSendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    attachments,
                })
            );
        });

        test('should send email with multiple attachments', async () => {
            const attachments: EmailAttachment[] = [
                { filename: 'file1.pdf', path: '/path/file1.pdf' },
                { filename: 'file2.jpg', content: Buffer.from('image'), contentType: 'image/jpeg' },
            ];

            await sendEmail({
                email: 'recipient@example.com',
                subject: 'Multiple Attachments',
                html: '<p>Multiple files</p>',
                attachments,
            });

            expect(mockSendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    attachments,
                })
            );
        });

        test('should not include attachments property when no attachments', async () => {
            await sendEmail({
                email: 'test@example.com',
                subject: 'No Attachments',
                html: '<p>Simple email</p>',
            });

            const callArgs = mockSendMail.mock.calls[0][0];
            expect(callArgs.attachments).toBeUndefined();
        });

        test('should not include attachments property when empty array', async () => {
            await sendEmail({
                email: 'test@example.com',
                subject: 'Empty Attachments',
                html: '<p>Email content</p>',
                attachments: [],
            });

            const callArgs = mockSendMail.mock.calls[0][0];
            expect(callArgs.attachments).toBeUndefined();
        });

        test('should configure transporter with correct settings', async () => {
            await sendEmail({
                email: 'test@example.com',
                subject: 'Test',
                html: '<p>Test</p>',
            });

            expect(mockCreateTransport).toHaveBeenCalledWith(
                expect.objectContaining({
                    secure: false,
                    tls: {
                        rejectUnauthorized: false,
                    },
                })
            );
        });

        test('should use config values for transporter', async () => {
            await sendEmail({
                email: 'test@example.com',
                subject: 'Test',
                html: '<p>Test</p>',
            });

            expect(mockCreateTransport).toHaveBeenCalledWith(
                expect.objectContaining({
                    auth: expect.any(Object),
                })
            );
        });

        test('should handle email sending errors', async () => {
            mockSendMail.mockRejectedValue(new Error('Send failed'));

            await expect(
                sendEmail({
                    email: 'test@example.com',
                    subject: 'Test',
                    html: '<p>Test</p>',
                })
            ).rejects.toThrow('Send failed');
        });

        test('should include from address in email', async () => {
            await sendEmail({
                email: 'recipient@example.com',
                subject: 'Test',
                html: '<p>Test</p>',
            });

            const callArgs = mockSendMail.mock.calls[0][0];
            expect(callArgs.from).toBeDefined();
            expect(callArgs.from).toContain('@');
        });

        test('should handle HTML with special characters', async () => {
            const htmlContent = '<p>Test with <strong>bold</strong> & special chars: é, ñ, ü</p>';

            await sendEmail({
                email: 'test@example.com',
                subject: 'Special Chars',
                html: htmlContent,
            });

            expect(mockSendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    html: htmlContent,
                })
            );
        });

        test('should handle long subject lines', async () => {
            const longSubject = 'A'.repeat(200);

            await sendEmail({
                email: 'test@example.com',
                subject: longSubject,
                html: '<p>Test</p>',
            });

            expect(mockSendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    subject: longSubject,
                })
            );
        });
    });

    describe('EmailAttachment interface', () => {
        test('should accept attachment with path', async () => {
            const attachment: EmailAttachment = {
                filename: 'document.pdf',
                path: '/path/to/document.pdf',
            };

            await sendEmail({
                email: 'test@example.com',
                subject: 'Test',
                html: '<p>Test</p>',
                attachments: [attachment],
            });

            expect(mockSendMail).toHaveBeenCalled();
        });

        test('should accept attachment with content buffer', async () => {
            const attachment: EmailAttachment = {
                filename: 'data.txt',
                content: Buffer.from('test data'),
                contentType: 'text/plain',
            };

            await sendEmail({
                email: 'test@example.com',
                subject: 'Test',
                html: '<p>Test</p>',
                attachments: [attachment],
            });

            expect(mockSendMail).toHaveBeenCalled();
        });

        test('should accept attachment with string content', async () => {
            const attachment: EmailAttachment = {
                filename: 'text.txt',
                content: 'Plain text content',
            };

            await sendEmail({
                email: 'test@example.com',
                subject: 'Test',
                html: '<p>Test</p>',
                attachments: [attachment],
            });

            expect(mockSendMail).toHaveBeenCalled();
        });
    });
});
