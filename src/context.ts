import type { JwtPayload } from '@clerk/types';

/**
 * User context populated after successful authentication.
 * Available on request.user in route handlers.
 */
export interface UserContext {
  /** Clerk user ID */
  userId: string;
  /** Clerk session ID */
  sessionId: string;

  /** User's primary email address */
  email: string | null;
  /** User's first name */
  firstName: string | null;
  /** User's last name */
  lastName: string | null;
  /** URL to user's profile image */
  imageUrl: string | null;

  /** Organization ID (if using Clerk organizations) */
  orgId: string | null;
  /** User's role in the organization */
  orgRole: string | null;
  /** Organization slug */
  orgSlug: string | null;

  /** Custom public metadata (apps store their own data here) */
  publicMetadata: Record<string, unknown>;
  /** Custom private metadata */
  privateMetadata: Record<string, unknown>;

  /** Raw Clerk JWT payload for advanced use cases */
  raw: JwtPayload;
}
