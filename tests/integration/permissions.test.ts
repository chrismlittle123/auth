import { describe, it, expect } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  requirePermission,
  requireRole,
  requireScopes,
  requireOrgMembership,
  requireOrgRole,
  getUser,
} from '../../src/permissions.js';
import { AuthError } from '../../src/errors.js';
import { createMockUser } from '../../src/testing/index.js';

// Mock FastifyRequest factory
function createMockRequest(user: ReturnType<typeof createMockUser> | null): FastifyRequest {
  return { user } as unknown as FastifyRequest;
}

const mockReply = {} as FastifyReply;

describe('requirePermission', () => {
  it('allows request when check passes', async () => {
    const user = createMockUser();
    const request = createMockRequest(user);
    const middleware = requirePermission(() => true);

    await expect(middleware(request, mockReply)).resolves.toBeUndefined();
  });

  it('throws FORBIDDEN when check fails', async () => {
    const user = createMockUser();
    const request = createMockRequest(user);
    const middleware = requirePermission(() => false);

    await expect(middleware(request, mockReply)).rejects.toThrow(AuthError);
    await expect(middleware(request, mockReply)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    });
  });

  it('throws UNAUTHORIZED when user is null', async () => {
    const request = createMockRequest(null);
    const middleware = requirePermission(() => true);

    await expect(middleware(request, mockReply)).rejects.toThrow(AuthError);
    await expect(middleware(request, mockReply)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      statusCode: 401,
    });
  });

  it('uses custom error message', async () => {
    const user = createMockUser();
    const request = createMockRequest(user);
    const middleware = requirePermission(() => false, 'Custom error message');

    await expect(middleware(request, mockReply)).rejects.toMatchObject({
      message: 'Custom error message',
    });
  });

  it('receives user context in check function', async () => {
    const user = createMockUser({ userId: 'user_123' });
    const request = createMockRequest(user);

    let receivedUser: unknown;
    const middleware = requirePermission((u) => {
      receivedUser = u;
      return true;
    });

    await middleware(request, mockReply);

    expect(receivedUser).toBe(user);
  });
});

describe('requireRole', () => {
  it('allows user with matching role', async () => {
    const user = createMockUser({ publicMetadata: { roles: ['admin', 'user'] } });
    const request = createMockRequest(user);
    const middleware = requireRole('admin');

    await expect(middleware(request, mockReply)).resolves.toBeUndefined();
  });

  it('allows user with role among multiple roles', async () => {
    const user = createMockUser({ publicMetadata: { roles: ['viewer', 'editor', 'admin'] } });
    const request = createMockRequest(user);
    const middleware = requireRole('editor');

    await expect(middleware(request, mockReply)).resolves.toBeUndefined();
  });

  it('rejects user without the required role', async () => {
    const user = createMockUser({ publicMetadata: { roles: ['user'] } });
    const request = createMockRequest(user);
    const middleware = requireRole('admin');

    await expect(middleware(request, mockReply)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: "Role 'admin' required",
    });
  });

  it('rejects user with no roles', async () => {
    const user = createMockUser({ publicMetadata: {} });
    const request = createMockRequest(user);
    const middleware = requireRole('admin');

    await expect(middleware(request, mockReply)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('rejects user with empty roles array', async () => {
    const user = createMockUser({ publicMetadata: { roles: [] } });
    const request = createMockRequest(user);
    const middleware = requireRole('admin');

    await expect(middleware(request, mockReply)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('throws UNAUTHORIZED when user is null', async () => {
    const request = createMockRequest(null);
    const middleware = requireRole('admin');

    await expect(middleware(request, mockReply)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});

describe('requireScopes', () => {
  it('allows user with all required scopes', async () => {
    const user = createMockUser({ publicMetadata: { scopes: ['read', 'write', 'delete'] } });
    const request = createMockRequest(user);
    const middleware = requireScopes(['read', 'write']);

    await expect(middleware(request, mockReply)).resolves.toBeUndefined();
  });

  it('allows user with exact scopes', async () => {
    const user = createMockUser({ publicMetadata: { scopes: ['read', 'write'] } });
    const request = createMockRequest(user);
    const middleware = requireScopes(['read', 'write']);

    await expect(middleware(request, mockReply)).resolves.toBeUndefined();
  });

  it('rejects user missing one scope', async () => {
    const user = createMockUser({ publicMetadata: { scopes: ['read'] } });
    const request = createMockRequest(user);
    const middleware = requireScopes(['read', 'write']);

    await expect(middleware(request, mockReply)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Scopes required: read, write',
    });
  });

  it('rejects user with no scopes', async () => {
    const user = createMockUser({ publicMetadata: {} });
    const request = createMockRequest(user);
    const middleware = requireScopes(['read']);

    await expect(middleware(request, mockReply)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('allows empty scopes requirement', async () => {
    const user = createMockUser({ publicMetadata: {} });
    const request = createMockRequest(user);
    const middleware = requireScopes([]);

    await expect(middleware(request, mockReply)).resolves.toBeUndefined();
  });
});

describe('requireOrgMembership', () => {
  it('allows user with organization', async () => {
    const user = createMockUser({ orgId: 'org_123', orgRole: 'member' });
    const request = createMockRequest(user);
    const middleware = requireOrgMembership();

    await expect(middleware(request, mockReply)).resolves.toBeUndefined();
  });

  it('rejects user without organization', async () => {
    const user = createMockUser({ orgId: null });
    const request = createMockRequest(user);
    const middleware = requireOrgMembership();

    await expect(middleware(request, mockReply)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Organization membership required',
    });
  });

  it('throws UNAUTHORIZED when user is null', async () => {
    const request = createMockRequest(null);
    const middleware = requireOrgMembership();

    await expect(middleware(request, mockReply)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});

describe('requireOrgRole', () => {
  it('allows user with matching org role', async () => {
    const user = createMockUser({ orgId: 'org_123', orgRole: 'admin' });
    const request = createMockRequest(user);
    const middleware = requireOrgRole('admin');

    await expect(middleware(request, mockReply)).resolves.toBeUndefined();
  });

  it('rejects user with different org role', async () => {
    const user = createMockUser({ orgId: 'org_123', orgRole: 'member' });
    const request = createMockRequest(user);
    const middleware = requireOrgRole('admin');

    await expect(middleware(request, mockReply)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: "Organization role 'admin' required",
    });
  });

  it('rejects user with null org role', async () => {
    const user = createMockUser({ orgId: 'org_123', orgRole: null });
    const request = createMockRequest(user);
    const middleware = requireOrgRole('admin');

    await expect(middleware(request, mockReply)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('getUser', () => {
  it('returns user when authenticated', () => {
    const user = createMockUser({ userId: 'user_123' });
    const request = createMockRequest(user);

    const result = getUser(request);

    expect(result).toBe(user);
    expect(result.userId).toBe('user_123');
  });

  it('throws UNAUTHORIZED when user is null', () => {
    const request = createMockRequest(null);

    expect(() => getUser(request)).toThrow(AuthError);
    expect(() => getUser(request)).toThrow('Authentication required');
  });

  it('returns complete user context', () => {
    const user = createMockUser({
      userId: 'user_123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      orgId: 'org_456',
      orgRole: 'admin',
      publicMetadata: { roles: ['admin'] },
    });
    const request = createMockRequest(user);

    const result = getUser(request);

    expect(result.userId).toBe('user_123');
    expect(result.email).toBe('test@example.com');
    expect(result.firstName).toBe('Test');
    expect(result.lastName).toBe('User');
    expect(result.orgId).toBe('org_456');
    expect(result.orgRole).toBe('admin');
    expect(result.publicMetadata).toEqual({ roles: ['admin'] });
  });
});
