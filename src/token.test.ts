import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyRequest } from 'fastify';
import { extractToken } from './token.js';

// Mock FastifyRequest factory
function createMockRequest(options: {
  authorization?: string;
  cookies?: Record<string, string>;
} = {}): FastifyRequest {
  return {
    headers: {
      authorization: options.authorization,
    },
    cookies: options.cookies,
  } as unknown as FastifyRequest;
}

describe('extractToken', () => {
  describe('from Authorization header', () => {
    it('extracts token from Bearer header', () => {
      const request = createMockRequest({
        authorization: 'Bearer my-jwt-token',
      });

      const token = extractToken(request);

      expect(token).toBe('my-jwt-token');
    });

    it('handles token with special characters', () => {
      const complexToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEyMyJ9.signature';
      const request = createMockRequest({
        authorization: `Bearer ${complexToken}`,
      });

      const token = extractToken(request);

      expect(token).toBe(complexToken);
    });

    it('returns null for non-Bearer authorization', () => {
      const request = createMockRequest({
        authorization: 'Basic dXNlcjpwYXNz',
      });

      const token = extractToken(request);

      expect(token).toBeNull();
    });

    it('returns null for malformed Bearer header', () => {
      const request = createMockRequest({
        authorization: 'Bearertoken-without-space',
      });

      const token = extractToken(request);

      expect(token).toBeNull();
    });

    it('returns null for empty Bearer token', () => {
      const request = createMockRequest({
        authorization: 'Bearer ',
      });

      const token = extractToken(request);

      expect(token).toBe('');
    });
  });

  describe('from session cookie', () => {
    it('extracts token from __session cookie', () => {
      const request = createMockRequest({
        cookies: { __session: 'cookie-jwt-token' },
      });

      const token = extractToken(request);

      expect(token).toBe('cookie-jwt-token');
    });

    it('returns null when no __session cookie exists', () => {
      const request = createMockRequest({
        cookies: { other_cookie: 'value' },
      });

      const token = extractToken(request);

      expect(token).toBeNull();
    });

    it('returns null when cookies object is undefined', () => {
      const request = createMockRequest({});

      const token = extractToken(request);

      expect(token).toBeNull();
    });
  });

  describe('priority', () => {
    it('prefers Authorization header over cookie', () => {
      const request = createMockRequest({
        authorization: 'Bearer header-token',
        cookies: { __session: 'cookie-token' },
      });

      const token = extractToken(request);

      expect(token).toBe('header-token');
    });

    it('falls back to cookie when no Authorization header', () => {
      const request = createMockRequest({
        cookies: { __session: 'cookie-token' },
      });

      const token = extractToken(request);

      expect(token).toBe('cookie-token');
    });

    it('falls back to cookie when Authorization is not Bearer', () => {
      const request = createMockRequest({
        authorization: 'Basic credentials',
        cookies: { __session: 'cookie-token' },
      });

      const token = extractToken(request);

      expect(token).toBe('cookie-token');
    });
  });

  describe('edge cases', () => {
    it('returns null for completely empty request', () => {
      const request = createMockRequest({});

      const token = extractToken(request);

      expect(token).toBeNull();
    });

    it('handles undefined authorization header', () => {
      const request = {
        headers: {},
        cookies: undefined,
      } as unknown as FastifyRequest;

      const token = extractToken(request);

      expect(token).toBeNull();
    });
  });
});
