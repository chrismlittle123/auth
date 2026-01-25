import { verifyToken as clerkVerifyToken, type VerifyTokenOptions } from '@clerk/backend';
import type { JwtPayload } from '@clerk/types';
import type { FastifyRequest } from 'fastify';
import type { UserContext } from './context.js';
import { AuthError } from './errors.js';

/**
 * Options for token verification
 */
export interface TokenVerificationOptions {
  /** Clerk secret key */
  secretKey: string;
  /** Authorized parties (frontend URLs) */
  authorizedParties?: string[];
  /** JWT public key for networkless verification */
  jwtKey?: string;
}

/**
 * Extract token from request.
 * Priority: Authorization header > __session cookie
 */
export function extractToken(request: FastifyRequest): string | null {
  // 1. Check Authorization header
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // 2. Check session cookie (requires @fastify/cookie to be registered)
  // Cast to access cookies if available
  const req = request as FastifyRequest & { cookies?: Record<string, string> };
  const sessionCookie = req.cookies?.['__session'];
  if (sessionCookie) {
    return sessionCookie;
  }

  return null;
}

/**
 * Verify token with Clerk and return user context.
 */
export async function verifyToken(
  token: string,
  options: TokenVerificationOptions
): Promise<UserContext> {
  const verifyOptions: VerifyTokenOptions = {
    secretKey: options.secretKey,
    authorizedParties: options.authorizedParties,
    jwtKey: options.jwtKey,
  };

  try {
    const payload = await clerkVerifyToken(token, verifyOptions);
    return mapClerkPayloadToUserContext(payload);
  } catch (error) {
    // Determine specific error type
    if (error instanceof Error) {
      if (error.message.includes('expired')) {
        throw new AuthError('TOKEN_EXPIRED', 'Token has expired');
      }
    }
    throw new AuthError('INVALID_TOKEN', 'Invalid or malformed token');
  }
}

/**
 * Map Clerk JWT payload to UserContext
 */
function mapClerkPayloadToUserContext(payload: JwtPayload): UserContext {
  return {
    userId: payload.sub,
    sessionId: payload.sid ?? '',

    email: typeof payload['email'] === 'string' ? payload['email'] : null,
    firstName: typeof payload['first_name'] === 'string' ? payload['first_name'] : null,
    lastName: typeof payload['last_name'] === 'string' ? payload['last_name'] : null,
    imageUrl: typeof payload['image_url'] === 'string' ? payload['image_url'] : null,

    orgId: typeof payload['org_id'] === 'string' ? payload['org_id'] : null,
    orgRole: typeof payload['org_role'] === 'string' ? payload['org_role'] : null,
    orgSlug: typeof payload['org_slug'] === 'string' ? payload['org_slug'] : null,

    publicMetadata: (payload['public_metadata'] as Record<string, unknown>) ?? {},
    privateMetadata: (payload['private_metadata'] as Record<string, unknown>) ?? {},

    raw: payload,
  };
}
