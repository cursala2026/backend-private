import { maskSensitiveFields } from '../log.util';

describe('maskSensitiveFields', () => {
    test('should mask password field', () => {
        const data = { username: 'john', password: 'secret123' };
        const result = maskSensitiveFields(data);

        expect(result.username).toBe('john');
        expect(result.password).toBe('***');
    });

    test('should mask multiple sensitive fields', () => {
        const data = {
            username: 'jane',
            password: 'pass123',
            token: 'abc-token',
            accessToken: 'xyz-access',
            email: 'test@example.com',
        };
        const result = maskSensitiveFields(data);

        expect(result.username).toBe('jane');
        expect(result.password).toBe('***');
        expect(result.token).toBe('***');
        expect(result.accessToken).toBe('***');
        expect(result.email).toMatch(/te\*\*\*@example\.com/);
    });

    test('should partially mask email addresses', () => {
        const data = { email: 'john.doe@example.com' };
        const result = maskSensitiveFields(data);

        expect(result.email).toBe('jo***@example.com');
    });

    test('should handle short email addresses', () => {
        const data = { email: 'ab@test.com' };
        const result = maskSensitiveFields(data);

        expect(result.email).toBe('***@test.com');
    });

    test('should handle nested objects', () => {
        const data = {
            user: {
                name: 'John',
                password: 'secret',
                credentials: {
                    token: 'abc123',
                },
            },
        };
        const result = maskSensitiveFields(data);

        expect(result.user.name).toBe('John');
        expect(result.user.password).toBe('***');
        expect(result.user.credentials.token).toBe('***');
    });

    test('should handle arrays', () => {
        const data = {
            users: [
                { name: 'John', password: 'pass1' },
                { name: 'Jane', password: 'pass2' },
            ],
        };
        const result = maskSensitiveFields(data);

        expect(result.users[0].name).toBe('John');
        expect(result.users[0].password).toBe('***');
        expect(result.users[1].name).toBe('Jane');
        expect(result.users[1].password).toBe('***');
    });

    test('should handle custom sensitive fields', () => {
        const data = { apiKey: 'secret-key', publicData: 'visible' };
        const result = maskSensitiveFields(data, ['apiKey']);

        expect(result.apiKey).toBe('***');
        expect(result.publicData).toBe('visible');
    });

    test('should handle null and undefined values', () => {
        const data = { password: null, token: undefined, name: 'John' };
        const result = maskSensitiveFields(data);

        expect(result.password).toBe('***'); // null gets masked
        expect(result.token).toBe('***'); // undefined also gets masked for sensitive fields
        expect(result.name).toBe('John');
    });

    test('should handle custom mask string', () => {
        const data = { password: 'secret' };
        const result = maskSensitiveFields(data, undefined, '[REDACTED]');

        expect(result.password).toBe('[REDACTED]');
    });

    test('should be case insensitive for field names', () => {
        const data = { Password: 'secret1', PASSWORD: 'secret2', PaSsWoRd: 'secret3' };
        const result = maskSensitiveFields(data);

        expect(result.Password).toBe('***');
        expect(result.PASSWORD).toBe('***');
        expect(result.PaSsWoRd).toBe('***');
    });

    test('should handle arrays of primitives', () => {
        const data = { tags: ['tag1', 'tag2'], password: 'secret' };
        const result = maskSensitiveFields(data);

        expect(result.tags).toEqual(['tag1', 'tag2']);
        expect(result.password).toBe('***');
    });

    test('should mask fields containing "email" in the name', () => {
        const data = { userEmail: 'test@example.com', contactEmail: 'contact@example.com' };
        const result = maskSensitiveFields(data);

        expect(result.userEmail).toMatch(/te\*\*\*@example\.com/);
        expect(result.contactEmail).toMatch(/co\*\*\*@example\.com/);
    });

    test('should handle deeply nested structures', () => {
        const data = {
            level1: {
                level2: {
                    level3: {
                        password: 'deep-secret',
                        name: 'value',
                    },
                },
            },
        };
        const result = maskSensitiveFields(data);

        expect(result.level1.level2.level3.password).toBe('***');
        expect(result.level1.level2.level3.name).toBe('value');
    });

    test('should handle non-object inputs gracefully', () => {
        expect(maskSensitiveFields('string')).toBe('string');
        expect(maskSensitiveFields(123)).toBe(123);
        expect(maskSensitiveFields(null)).toBeNull();
    });

    test('should mask all default sensitive fields', () => {
        const data = {
            password: 'p1',
            oldPassword: 'p2',
            newPassword: 'p3',
            token: 't1',
            accessToken: 't2',
            refreshToken: 't3',
            resetPasswordToken: 't4',
            jwt: 'j1',
            authorization: 'a1',
            secret: 's1',
            ssn: 'ssn1',
            cardNumber: 'c1',
            cvv: 'cvv1',
            email: 'test@example.com',
        };
        const result = maskSensitiveFields(data);

        expect(result.password).toBe('***');
        expect(result.oldPassword).toBe('***');
        expect(result.newPassword).toBe('***');
        expect(result.token).toBe('***');
        expect(result.accessToken).toBe('***');
        expect(result.refreshToken).toBe('***');
        expect(result.resetPasswordToken).toBe('***');
        expect(result.jwt).toBe('***');
        expect(result.authorization).toBe('***');
        expect(result.secret).toBe('***');
        expect(result.ssn).toBe('***');
        expect(result.cardNumber).toBe('***');
        expect(result.cvv).toBe('***');
        expect(result.email).toMatch(/\*\*\*@example\.com/);
    });
});
