// Main plugin export
export { default as authPlugin, default } from './plugin.js';
export type { AuthPluginOptions } from './plugin.js';

// User context
export type { UserContext } from './context.js';

// Errors
export { AuthError, isAuthError } from './errors.js';
export type { AuthErrorCode, AuthErrorResponse } from './errors.js';

// Permission helpers
export {
  requirePermission,
  requireRole,
  requireScopes,
  requireOrgMembership,
  requireOrgRole,
  getUser,
} from './permissions.js';

// Token utilities (for advanced use cases)
export { extractToken, verifyToken } from './token.js';
export type { TokenVerificationOptions } from './token.js';
