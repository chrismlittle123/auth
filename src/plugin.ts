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
   * Log auth failures using request.log (integrates with OpenTelemetry)
   * @default true
   */
  logFailures?: boolean;

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

function logAuthFailure(
  error: AuthError,
  request: FastifyRequest,
  options: AuthPluginOptions
): void {
  if (options.logFailures !== false) {
    request.log.warn({
      event: 'auth_failure',
      errorCode: error.code,
      errorMessage: error.message,
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    }, `Auth failure: ${error.code}`);
  }
  options.onAuthFailure?.(error, request);
}

function createAuthPreHandler(
  options: AuthPluginOptions,
  verifyOptions: TokenVerificationOptions
) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    if (options.respectPublicRoutes !== false) {
      const routeConfig = request.routeOptions.config as RouteConfig | undefined;
      if (routeConfig?.public) {
        return;
      }
    }

    const token = extractToken(request);
    if (!token) {
      const error = new AuthError('UNAUTHORIZED', 'Authentication required');
      logAuthFailure(error, request, options);
      throw error;
    }

    try {
      request.user = await verifyToken(token, verifyOptions);
    } catch (error) {
      if (isAuthError(error)) {
        logAuthFailure(error, request, options);
      }
      throw error;
    }
  };
}

function authErrorHandler(
  error: Error,
  _request: FastifyRequest,
  reply: FastifyReply
): FastifyReply {
  if (isAuthError(error)) {
    return reply.status(error.statusCode).send(error.toResponse());
  }
  throw error;
}

async function authPluginImpl(
  fastify: FastifyInstance,
  options: AuthPluginOptions
): Promise<void> {
  const secretKey = options.secretKey ?? process.env['CLERK_SECRET_KEY'];
  if (!secretKey) {
    const msg = 'CLERK_SECRET_KEY is required. Set it via options.secretKey or CLERK_SECRET_KEY environment variable.';
    throw new Error(msg);
  }

  const verifyOptions: TokenVerificationOptions = {
    secretKey,
    authorizedParties: options.authorizedParties,
    jwtKey: options.jwtKey,
  };

  fastify.decorateRequest('user', null);
  fastify.addHook('preHandler', createAuthPreHandler(options, verifyOptions));
  fastify.setErrorHandler(authErrorHandler);
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
