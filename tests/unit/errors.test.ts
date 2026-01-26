import { describe, it, expect } from 'vitest';
import { AuthError, isAuthError } from '../../src/errors.js';

describe('AuthError', () => {
  describe('constructor', () => {
    it('creates an UNAUTHORIZED error with 401 status', () => {
      const error = new AuthError('UNAUTHORIZED', 'No token provided');

      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.message).toBe('No token provided');
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe('AuthError');
    });

    it('creates an INVALID_TOKEN error with 401 status', () => {
      const error = new AuthError('INVALID_TOKEN', 'Token is malformed');

      expect(error.code).toBe('INVALID_TOKEN');
      expect(error.message).toBe('Token is malformed');
      expect(error.statusCode).toBe(401);
    });

    it('creates a TOKEN_EXPIRED error with 401 status', () => {
      const error = new AuthError('TOKEN_EXPIRED', 'Token has expired');

      expect(error.code).toBe('TOKEN_EXPIRED');
      expect(error.message).toBe('Token has expired');
      expect(error.statusCode).toBe(401);
    });

    it('creates a FORBIDDEN error with 403 status', () => {
      const error = new AuthError('FORBIDDEN', 'Insufficient permissions');

      expect(error.code).toBe('FORBIDDEN');
      expect(error.message).toBe('Insufficient permissions');
      expect(error.statusCode).toBe(403);
    });

    it('allows overriding status code', () => {
      const error = new AuthError('UNAUTHORIZED', 'Custom', 403);

      expect(error.statusCode).toBe(403);
    });
  });

  describe('toResponse', () => {
    it('returns a properly formatted error response', () => {
      const error = new AuthError('UNAUTHORIZED', 'Authentication required');
      const response = error.toResponse();

      expect(response).toEqual({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    });

    it('works for all error codes', () => {
      const codes = ['UNAUTHORIZED', 'INVALID_TOKEN', 'TOKEN_EXPIRED', 'FORBIDDEN'] as const;

      for (const code of codes) {
        const error = new AuthError(code, `Test message for ${code}`);
        const response = error.toResponse();

        expect(response.error.code).toBe(code);
        expect(response.error.message).toBe(`Test message for ${code}`);
      }
    });
  });

  describe('inheritance', () => {
    it('is an instance of Error', () => {
      const error = new AuthError('UNAUTHORIZED', 'Test');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AuthError);
    });

    it('has a stack trace', () => {
      const error = new AuthError('UNAUTHORIZED', 'Test');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AuthError');
    });
  });
});

describe('isAuthError', () => {
  it('returns true for AuthError instances', () => {
    const error = new AuthError('UNAUTHORIZED', 'Test');

    expect(isAuthError(error)).toBe(true);
  });

  it('returns false for regular Error instances', () => {
    const error = new Error('Regular error');

    expect(isAuthError(error)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isAuthError(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isAuthError(undefined)).toBe(false);
  });

  it('returns false for plain objects', () => {
    const obj = { code: 'UNAUTHORIZED', message: 'Test' };

    expect(isAuthError(obj)).toBe(false);
  });

  it('returns false for strings', () => {
    expect(isAuthError('UNAUTHORIZED')).toBe(false);
  });
});
