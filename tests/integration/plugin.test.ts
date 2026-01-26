import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import auth from '../../src/plugin.js';
import { mockAuth, createMockUser } from '../helpers/mocks.js';

// Mock the Clerk verifyToken
vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
}));

import { verifyToken as mockVerifyToken } from '@clerk/backend';

describe('auth plugin', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('registration', () => {
    it('registers successfully with secret key', async () => {
      await expect(
        app.register(auth, { secretKey: 'sk_test_123456789012345678901234567890' })
      ).resolves.not.toThrow();
    });

    it('throws error when no secret key provided', async () => {
      // Clear any env var
      const originalEnv = process.env['CLERK_SECRET_KEY'];
      delete process.env['CLERK_SECRET_KEY'];

      await expect(app.register(auth)).rejects.toThrow('CLERK_SECRET_KEY is required');

      // Restore
      if (originalEnv) {
        process.env['CLERK_SECRET_KEY'] = originalEnv;
      }
    });

    it('uses CLERK_SECRET_KEY from environment', async () => {
      process.env['CLERK_SECRET_KEY'] = 'sk_test_from_env';

      await expect(app.register(auth)).resolves.not.toThrow();

      delete process.env['CLERK_SECRET_KEY'];
    });
  });

  describe('public routes', () => {
    beforeEach(async () => {
      await app.register(auth, { secretKey: 'sk_test_123' });
    });

    it('allows public routes without authentication', async () => {
      app.get('/public', { config: { public: true } }, async () => {
        return { message: 'public' };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/public',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ message: 'public' });
    });

    it('allows public routes when respectPublicRoutes is true', async () => {
      const app2 = Fastify();
      await app2.register(auth, { secretKey: 'sk_test_123', respectPublicRoutes: true });

      app2.get('/public', { config: { public: true } }, async () => {
        return { message: 'public' };
      });

      const response = await app2.inject({
        method: 'GET',
        url: '/public',
      });

      expect(response.statusCode).toBe(200);
      await app2.close();
    });
  });

  describe('protected routes', () => {
    beforeEach(async () => {
      await app.register(auth, { secretKey: 'sk_test_123' });
    });

    it('returns 401 when no token provided', async () => {
      app.get('/protected', async (request) => {
        return { userId: request.user?.userId };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    });

    it('returns 401 when token is invalid', async () => {
      vi.mocked(mockVerifyToken).mockRejectedValue(new Error('Invalid token'));

      app.get('/protected', async (request) => {
        return { userId: request.user?.userId };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or malformed token',
        },
      });
    });

    it('returns 401 when token is expired', async () => {
      vi.mocked(mockVerifyToken).mockRejectedValue(new Error('Token expired'));

      app.get('/protected', async (request) => {
        return { userId: request.user?.userId };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'Bearer expired-token',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token has expired',
        },
      });
    });

    it('populates request.user on successful auth', async () => {
      vi.mocked(mockVerifyToken).mockResolvedValue({
        sub: 'user_123',
        sid: 'sess_456',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        __raw: 'raw_token',
        iss: 'https://clerk.example.com',
        nbf: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      } as never);

      app.get('/protected', async (request) => {
        return {
          userId: request.user?.userId,
          email: request.user?.email,
        };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        userId: 'user_123',
        email: 'test@example.com',
      });
    });
  });

  describe('onAuthFailure callback', () => {
    it('calls onAuthFailure when authentication fails', async () => {
      const onAuthFailure = vi.fn();

      await app.register(auth, {
        secretKey: 'sk_test_123',
        onAuthFailure,
      });

      app.get('/protected', async () => ({ ok: true }));

      await app.inject({
        method: 'GET',
        url: '/protected',
      });

      expect(onAuthFailure).toHaveBeenCalledTimes(1);
      expect(onAuthFailure).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'UNAUTHORIZED' }),
        expect.anything()
      );
    });

    it('does not call onAuthFailure on public routes', async () => {
      const onAuthFailure = vi.fn();

      await app.register(auth, {
        secretKey: 'sk_test_123',
        onAuthFailure,
      });

      app.get('/public', { config: { public: true } }, async () => ({ ok: true }));

      await app.inject({
        method: 'GET',
        url: '/public',
      });

      expect(onAuthFailure).not.toHaveBeenCalled();
    });
  });

  describe('respectPublicRoutes option', () => {
    it('ignores public config when respectPublicRoutes is false', async () => {
      await app.register(auth, {
        secretKey: 'sk_test_123',
        respectPublicRoutes: false,
      });

      app.get('/public', { config: { public: true } }, async () => {
        return { message: 'should require auth' };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/public',
      });

      expect(response.statusCode).toBe(401);
    });
  });
});

describe('mockAuth helper', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = Fastify();
  });

  afterEach(async () => {
    await app.close();
  });

  it('injects mock user into request', async () => {
    // Use mockAuth instead of real auth plugin
    app.decorateRequest('user', null);
    app.addHook('preHandler', mockAuth({ userId: 'mock_user_123' }));

    app.get('/test', async (request) => {
      return { userId: request.user?.userId };
    });

    const response = await app.inject({
      method: 'GET',
      url: '/test',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ userId: 'mock_user_123' });
  });

  it('allows customizing mock user properties', async () => {
    app.decorateRequest('user', null);
    app.addHook('preHandler', mockAuth({
      userId: 'custom_user',
      email: 'custom@example.com',
      orgId: 'org_789',
      publicMetadata: { roles: ['admin'] },
    }));

    app.get('/test', async (request) => {
      return {
        userId: request.user?.userId,
        email: request.user?.email,
        orgId: request.user?.orgId,
        roles: request.user?.publicMetadata['roles'],
      };
    });

    const response = await app.inject({
      method: 'GET',
      url: '/test',
    });

    expect(response.json()).toEqual({
      userId: 'custom_user',
      email: 'custom@example.com',
      orgId: 'org_789',
      roles: ['admin'],
    });
  });
});
