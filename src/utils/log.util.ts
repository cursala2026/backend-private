/**
 * Mask sensitive fields in an object to avoid logging secrets.
 * Works recursively and will replace values for keys that match a sensitive list.
 */
export function maskSensitiveFields(data: unknown, fields?: string[], mask = '***'): any {
  const sensitive = new Set(
    (fields || [
      'password',
      'oldPassword',
      'newPassword',
      'token',
      'accessToken',
      'refreshToken',
      'resetPasswordToken',
      'jwt',
      'authorization',
      'secret',
      'ssn',
      'cardNumber',
      'cvv',
      'email',
    ]).map((f) => f.toLowerCase())
  );

  const emailMask = (value: string) => {
    try {
      const parts = value.split('@');
      if (parts.length !== 2) return mask;
      const [local, domain] = parts;
      if (local.length <= 2) return `${mask}@${domain}`;
      return `${local.slice(0, 2)}${mask}@${domain}`;
    } catch (_) {
      return mask;
    }
  };

  const isPlainObject = (v: unknown) => Object.prototype.toString.call(v) === '[object Object]';

  const recurse = (obj: unknown): unknown => {
    if (Array.isArray(obj)) return (obj as unknown[]).map((it) => recurse(it));
    if (obj == null) return obj;
    if (typeof obj === 'string') return obj;
    if (!isPlainObject(obj)) return obj;
    const out: Record<string, unknown> = {};
    const objAny = obj as Record<string, unknown>;
    Object.keys(objAny).forEach((key) => {
      try {
        const lower = key.toLowerCase();
        const val = objAny[key];
        if (sensitive.has(lower)) {
          if (typeof val === 'string' && lower === 'email') {
            out[key] = emailMask(val);
          } else {
            out[key] = mask;
          }
        } else if (Array.isArray(val)) {
          out[key] = (val as unknown[]).map((it) => (isPlainObject(it) ? recurse(it) : it));
        } else if (isPlainObject(val)) {
          out[key] = recurse(val);
        } else if (typeof val === 'string' && lower.includes('email')) {
          out[key] = emailMask(val);
        } else {
          out[key] = val;
        }
      } catch (err) {
        out[key] = '***';
      }
  });
    return out;
  };

  try {
    return recurse(data);
  } catch (error) {
    return '***';
  }
}

export default maskSensitiveFields;
