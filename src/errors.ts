/**
 * Authentication error codes
 */
export type AuthErrorCode =
  | 'UNAUTHORIZED' // No token provided
  | 'INVALID_TOKEN' // Token malformed or signature invalid
  | 'TOKEN_EXPIRED' // Token was valid but expired
  | 'FORBIDDEN'; // Valid token but insufficient permissions

/**
 * Standard auth error response format
 */
export interface AuthErrorResponse {
  error: {
    code: AuthErrorCode;
    message: string;
  };
}

/**
 * Authentication error class
 */
export class AuthError extends Error {
  public readonly code: AuthErrorCode;
  public readonly statusCode: 401 | 403;

  constructor(
    code: AuthErrorCode,
    message: string,
    statusCode?: 401 | 403
  ) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.statusCode = statusCode ?? (code === 'FORBIDDEN' ? 403 : 401);
  }

  /**
   * Convert to standard error response format
   */
  toResponse(): AuthErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
      },
    };
  }
}

/**
 * Type guard to check if an error is an AuthError
 */
export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}
