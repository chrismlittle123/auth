import { describe, it, expect } from 'vitest';
import type { FastifyRequest } from 'fastify';
import {
  createMockUser,
  mockAuth,
  createMockUserWithRoles,
  createMockUserWithScopes,
  createMockOrgUser,
} from '../helpers/mocks.js';

describe('createMockUser', () => {
  it('creates a user with default values', () => {
    const user = createMockUser();

    expect(user.userId).toBe('user_test_123');
    expect(user.sessionId).toBe('sess_test_123');
    expect(user.email).toBe('test@example.com');
    expect(user.firstName).toBe('Test');
    expect(user.lastName).toBe('User');
    expect(user.imageUrl).toBeNull();
    expect(user.orgId).toBeNull();
    expect(user.orgRole).toBeNull();
    expect(user.orgSlug).toBeNull();
    expect(user.publicMetadata).toEqual({});
    expect(user.privateMetadata).toEqual({});
    expect(user.raw).toBeDefined();
  });

  it('allows overriding userId', () => {
    const user = createMockUser({ userId: 'custom_user_id' });

    expect(user.userId).toBe('custom_user_id');
    expect(user.email).toBe('test@example.com'); // Other defaults unchanged
  });

  it('allows overriding email', () => {
    const user = createMockUser({ email: 'custom@example.com' });

    expect(user.email).toBe('custom@example.com');
  });

  it('allows overriding organization fields', () => {
    const user = createMockUser({
      orgId: 'org_123',
      orgRole: 'admin',
      orgSlug: 'my-org',
    });

    expect(user.orgId).toBe('org_123');
    expect(user.orgRole).toBe('admin');
    expect(user.orgSlug).toBe('my-org');
  });

  it('allows overriding metadata', () => {
    const user = createMockUser({
      publicMetadata: { roles: ['admin'] },
      privateMetadata: { secret: 'value' },
    });

    expect(user.publicMetadata).toEqual({ roles: ['admin'] });
    expect(user.privateMetadata).toEqual({ secret: 'value' });
  });

  it('allows setting null values', () => {
    const user = createMockUser({
      email: null,
      firstName: null,
      lastName: null,
    });

    expect(user.email).toBeNull();
    expect(user.firstName).toBeNull();
    expect(user.lastName).toBeNull();
  });

  it('allows multiple overrides at once', () => {
    const user = createMockUser({
      userId: 'user_456',
      email: 'other@test.com',
      firstName: 'John',
      lastName: 'Doe',
      orgId: 'org_789',
    });

    expect(user.userId).toBe('user_456');
    expect(user.email).toBe('other@test.com');
    expect(user.firstName).toBe('John');
    expect(user.lastName).toBe('Doe');
    expect(user.orgId).toBe('org_789');
  });
});

describe('mockAuth', () => {
  it('returns a function', () => {
    const middleware = mockAuth();

    expect(typeof middleware).toBe('function');
  });

  it('sets user on request', async () => {
    const middleware = mockAuth();
    const request = { user: null } as unknown as FastifyRequest;

    await middleware(request);

    expect(request.user).not.toBeNull();
    expect(request.user?.userId).toBe('user_test_123');
  });

  it('applies user overrides', async () => {
    const middleware = mockAuth({ userId: 'custom_id', email: 'custom@test.com' });
    const request = { user: null } as unknown as FastifyRequest;

    await middleware(request);

    expect(request.user?.userId).toBe('custom_id');
    expect(request.user?.email).toBe('custom@test.com');
  });

  it('returns a promise', () => {
    const middleware = mockAuth();
    const request = { user: null } as unknown as FastifyRequest;

    const result = middleware(request);

    expect(result).toBeInstanceOf(Promise);
  });
});

describe('createMockUserWithRoles', () => {
  it('creates user with roles in publicMetadata', () => {
    const user = createMockUserWithRoles(['admin', 'editor']);

    expect(user.publicMetadata).toEqual({ roles: ['admin', 'editor'] });
  });

  it('creates user with single role', () => {
    const user = createMockUserWithRoles(['viewer']);

    expect(user.publicMetadata).toEqual({ roles: ['viewer'] });
  });

  it('creates user with empty roles array', () => {
    const user = createMockUserWithRoles([]);

    expect(user.publicMetadata).toEqual({ roles: [] });
  });

  it('includes default user properties', () => {
    const user = createMockUserWithRoles(['admin']);

    expect(user.userId).toBe('user_test_123');
    expect(user.email).toBe('test@example.com');
  });
});

describe('createMockUserWithScopes', () => {
  it('creates user with scopes in publicMetadata', () => {
    const user = createMockUserWithScopes(['read', 'write', 'delete']);

    expect(user.publicMetadata).toEqual({ scopes: ['read', 'write', 'delete'] });
  });

  it('creates user with single scope', () => {
    const user = createMockUserWithScopes(['read']);

    expect(user.publicMetadata).toEqual({ scopes: ['read'] });
  });

  it('creates user with empty scopes array', () => {
    const user = createMockUserWithScopes([]);

    expect(user.publicMetadata).toEqual({ scopes: [] });
  });
});

describe('createMockOrgUser', () => {
  it('creates user with organization context', () => {
    const user = createMockOrgUser('org_123', 'admin');

    expect(user.orgId).toBe('org_123');
    expect(user.orgRole).toBe('admin');
  });

  it('generates orgSlug from orgId by default', () => {
    const user = createMockOrgUser('org_mycompany', 'member');

    expect(user.orgSlug).toBe('mycompany');
  });

  it('allows custom orgSlug', () => {
    const user = createMockOrgUser('org_123', 'admin', 'custom-slug');

    expect(user.orgSlug).toBe('custom-slug');
  });

  it('includes default user properties', () => {
    const user = createMockOrgUser('org_123', 'admin');

    expect(user.userId).toBe('user_test_123');
    expect(user.email).toBe('test@example.com');
  });

  it('handles org roles like member, admin, owner', () => {
    const member = createMockOrgUser('org_1', 'member');
    const admin = createMockOrgUser('org_2', 'admin');
    const owner = createMockOrgUser('org_3', 'owner');

    expect(member.orgRole).toBe('member');
    expect(admin.orgRole).toBe('admin');
    expect(owner.orgRole).toBe('owner');
  });
});
