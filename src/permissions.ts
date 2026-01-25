import type { FastifyRequest, FastifyReply } from 'fastify';
import { AuthError } from './errors.js';
import type { UserContext } from './context.js';

/**
 * Middleware factory for custom permission checks.
 */
export function requirePermission(
  check: (user: UserContext) => boolean,
  errorMessage = 'Insufficient permissions'
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!request.user) {
      throw new AuthError('UNAUTHORIZED', 'Authentication required');
    }
    if (!check(request.user)) {
      throw new AuthError('FORBIDDEN', errorMessage);
    }
  };
}

/**
 * Require user to have a specific role in publicMetadata.roles
 */
export function requireRole(role: string): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return requirePermission(
    (user) => {
      const roles = user.publicMetadata['roles'] as string[] | undefined;
      return roles?.includes(role) ?? false;
    },
    `Role '${role}' required`
  );
}

/**
 * Require user to have all specified scopes in publicMetadata.scopes
 */
export function requireScopes(scopes: string[]): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return requirePermission(
    (user) => {
      const userScopes = user.publicMetadata['scopes'] as string[] | undefined;
      return scopes.every((s) => userScopes?.includes(s));
    },
    `Scopes required: ${scopes.join(', ')}`
  );
}

/**
 * Require user to be a member of any organization.
 */
export function requireOrgMembership(): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return requirePermission(
    (user) => user.orgId !== null,
    'Organization membership required'
  );
}

/**
 * Require user to have a specific role in their organization.
 */
export function requireOrgRole(role: string): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return requirePermission(
    (user) => user.orgRole === role,
    `Organization role '${role}' required`
  );
}

/**
 * Get authenticated user, throwing if not authenticated.
 * Useful when you need the user in a route handler.
 */
export function getUser(request: FastifyRequest): UserContext {
  if (!request.user) {
    throw new AuthError('UNAUTHORIZED', 'Authentication required');
  }
  return request.user;
}
