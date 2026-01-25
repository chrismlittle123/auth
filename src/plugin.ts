import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import type { UserContext } from './context.js';
import { AuthError, isAuthError } from './errors.js';
import { extractToken, verifyToken, type TokenVerificationOptions } from './token.js';

/**
 * Auth plugin options
 */
export interface AuthPluginOptions {
  /**
   * Clerk secret key. Defaults to CLERK_SECRET_KEY env var.
   */
  secretKey?: string;

  /**
   * Authorized parties (frontend URLs that are allowed to use tokens)
   */
  authorizedParties?: string[];

  /**
   * JWT public key for networkless verification
   */
  jwtKey?: string;

  /**
   * Skip authentication for routes marked with { config: { public: true } }
   * @default true
   */
  respectPublicRoutes?: boolean;

  /**
   * Custom handler for auth failures (logging, metrics, etc.)
   */
  onAuthFailure?: (error: AuthError, request: FastifyRequest) => void;
}

/**
 * Route configuration for auth
 */
interface RouteConfig {
  public?: boolean;
}

async function authPluginImpl(
  fastify: FastifyInstance,
  options: AuthPluginOptions
): Promise<void> {
  // Validate secret key
  const secretKey = options.secretKey ?? process.env['CLERK_SECRET_KEY'];
  if (!secretKey) {
    throw new Error('CLERK_SECRET_KEY is required. Set it via options.secretKey or CLERK_SECRET_KEY environment variable.');
  }

  // Token verification options
  const verifyOptions: TokenVerificationOptions = {
    secretKey,
    authorizedParties: options.authorizedParties,
    jwtKey: options.jwtKey,
  };

  // Decorate request with user (initially null)
  fastify.decorateRequest('user', null);

  // Add auth hook
  fastify.addHook('preHandler', async (request: FastifyRequest, _reply: FastifyReply) => {
    // Check if route is public
    if (options.respectPublicRoutes !== false) {
      const routeConfig = request.routeOptions.config as RouteConfig | undefined;
      if (routeConfig?.public) {
        return; // Skip auth for public routes
      }
    }

    // Extract token
    const token = extractToken(request);
    if (!token) {
      const error = new AuthError('UNAUTHORIZED', 'Authentication required');
      options.onAuthFailure?.(error, request);
      throw error;
    }

    // Verify token
    try {
      request.user = await verifyToken(token, verifyOptions);
    } catch (error) {
      if (isAuthError(error)) {
        options.onAuthFailure?.(error, request);
      }
      throw error;
    }
  });

  // Error handler for auth errors
  fastify.setErrorHandler((error, _request, reply) => {
    if (isAuthError(error)) {
      return reply.status(error.statusCode).send(error.toResponse());
    }

    // Re-throw non-auth errors to default handler
    throw error;
  });
}

/**
 * Fastify auth plugin wrapping Clerk
 */
const authPlugin = fp(authPluginImpl, {
  name: '@palindrom-ai/auth',
  fastify: '5.x',
});

export default authPlugin;

// Fastify type augmentation
declare module 'fastify' {
  interface FastifyRequest {
    user: UserContext | null;
  }

  interface FastifyContextConfig {
    public?: boolean;
  }
}
