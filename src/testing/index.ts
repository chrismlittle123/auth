import type { FastifyRequest } from 'fastify';
import type { JwtPayload } from '@clerk/types';
import type { UserContext } from '../context.js';

/**
 * Create a mock user context for testing.
 */
export function createMockUser(overrides: Partial<UserContext> = {}): UserContext {
  return {
    userId: 'user_test_123',
    sessionId: 'sess_test_123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    imageUrl: null,
    orgId: null,
    orgRole: null,
    orgSlug: null,
    publicMetadata: {},
    privateMetadata: {},
    raw: {} as JwtPayload,
    ...overrides,
  };
}

/**
 * Fastify preHandler that injects a mock user.
 * Use in tests to bypass actual Clerk verification.
 */
export function mockAuth(
  userOverrides: Partial<UserContext> = {}
): (request: FastifyRequest) => Promise<void> {
  return async (request: FastifyRequest) => {
    request.user = createMockUser(userOverrides);
  };
}

/**
 * Create a mock user with specific roles.
 */
export function createMockUserWithRoles(roles: string[]): UserContext {
  return createMockUser({
    publicMetadata: { roles },
  });
}

/**
 * Create a mock user with specific scopes.
 */
export function createMockUserWithScopes(scopes: string[]): UserContext {
  return createMockUser({
    publicMetadata: { scopes },
  });
}

/**
 * Create a mock user with organization context.
 */
export function createMockOrgUser(
  orgId: string,
  orgRole: string,
  orgSlug?: string
): UserContext {
  return createMockUser({
    orgId,
    orgRole,
    orgSlug: orgSlug ?? orgId.replace('org_', ''),
  });
}
