# @palindrom-ai/auth Implementation Plan

## Overview

A shared authentication package wrapping Clerk for consistent token validation across all Palindrom services.

**Linear Ticket:** [PAL-521](https://linear.app/palindrom/issue/PAL-521/build-auth-package)
**Git Branch:** `chris/pal-521-build-auth-package`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
│  (React app with Clerk's React SDK)                                         │
│                                                                              │
│  1. User clicks "Sign in with Google/Microsoft/GitHub/Email"                │
│  2. Clerk handles OAuth flow                                                 │
│  3. Clerk sets session cookie OR provides JWT                               │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  │ HTTP Request + Token (cookie or header)
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND                                         │
│  (Fastify service using @palindrom-ai/auth)                                 │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  @palindrom-ai/auth                                                  │    │
│  │                                                                      │    │
│  │  1. Extract token from Authorization header OR __session cookie     │    │
│  │  2. Verify token with Clerk                                         │    │
│  │  3. Populate request.user with UserContext                          │    │
│  │  4. Route handler runs with authenticated user                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Token sources | Bearer header + session cookie | Supports SPAs, mobile, and same-domain web |
| Public routes | Opt-out (protected by default) | Secure by default, explicit public routes |
| User context access | `request.user` | Simple, follows fastify-api patterns |
| Permissions | Library-agnostic with helpers | Apps define their own permission models |
| Configuration | Environment variables | Zero-config for consuming apps |
| Error format | `{ error: { code, message } }` | Consistent across Palindrom APIs |
| Organizations | Supported via Clerk | Multi-tenancy built-in |

---

## Package Structure

```
auth/
├── docs/
│   ├── plans/
│   │   └── implementation-plan.md     # This file
│   └── runbooks/
│       └── clerk-setup.md             # Manual Clerk setup guide
├── scripts/
│   └── clerk/
│       └── configure.sh               # Clerk API configuration script
├── src/
│   ├── index.ts                       # Main exports
│   ├── plugin.ts                      # Fastify plugin
│   ├── middleware.ts                  # Auth middleware
│   ├── token.ts                       # Token extraction & verification
│   ├── context.ts                     # UserContext types & helpers
│   ├── errors.ts                      # Auth error types
│   ├── permissions.ts                 # Permission checking helpers
│   └── testing/
│       └── index.ts                   # Test utilities
├── tests/
│   ├── plugin.test.ts
│   ├── middleware.test.ts
│   ├── token.test.ts
│   └── permissions.test.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .env.example
└── README.md
```

---

## Implementation Phases

### Phase 1: Project Setup

**Files to create:**
- `package.json` — Package configuration
- `tsconfig.json` — TypeScript configuration (matching fastify-api patterns)
- `vitest.config.ts` — Test configuration
- `.env.example` — Environment variable template
- `.gitignore` — Git ignore patterns
- `.github/workflows/ci.yml` — CI pipeline

**Dependencies:**
```json
{
  "dependencies": {
    "@clerk/backend": "^1.x",
    "fastify": "^5.2.1",
    "@fastify/cookie": "^11.x"
  },
  "devDependencies": {
    "@types/node": "^22.x",
    "typescript": "^5.7.x",
    "vitest": "^3.x"
  },
  "peerDependencies": {
    "fastify": "^5.0.0"
  }
}
```

---

### Phase 2: Core Types

**File: `src/context.ts`**

```typescript
/**
 * User context populated after successful authentication.
 * Available on request.user in route handlers.
 */
export interface UserContext {
  // Core identifiers
  userId: string
  sessionId: string

  // User info
  email: string | null
  firstName: string | null
  lastName: string | null
  imageUrl: string | null

  // Organization context (if using Clerk organizations)
  orgId: string | null
  orgRole: string | null
  orgSlug: string | null

  // Custom metadata (apps store their own data here)
  publicMetadata: Record<string, unknown>
  privateMetadata: Record<string, unknown>

  // Raw Clerk session for advanced use cases
  raw: ClerkSessionClaims
}
```

**File: `src/errors.ts`**

```typescript
export type AuthErrorCode =
  | 'UNAUTHORIZED'      // No token provided
  | 'INVALID_TOKEN'     // Token malformed or signature invalid
  | 'TOKEN_EXPIRED'     // Token was valid but expired
  | 'FORBIDDEN'         // Valid token but insufficient permissions

export interface AuthErrorResponse {
  error: {
    code: AuthErrorCode
    message: string
  }
}

export class AuthError extends Error {
  constructor(
    public code: AuthErrorCode,
    message: string,
    public statusCode: 401 | 403 = code === 'FORBIDDEN' ? 403 : 401
  ) {
    super(message)
    this.name = 'AuthError'
  }
}
```

---

### Phase 3: Token Extraction & Verification

**File: `src/token.ts`**

```typescript
import { createClerkClient } from '@clerk/backend'

/**
 * Extract token from request.
 * Priority: Authorization header > __session cookie
 */
export function extractToken(request: FastifyRequest): string | null {
  // 1. Check Authorization header
  const authHeader = request.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  // 2. Check session cookie
  const sessionCookie = request.cookies?.['__session']
  if (sessionCookie) {
    return sessionCookie
  }

  return null
}

/**
 * Verify token with Clerk and return user context.
 */
export async function verifyToken(
  token: string,
  clerk: ClerkClient
): Promise<UserContext> {
  // Clerk verification logic
  // Maps Clerk session to UserContext
}
```

---

### Phase 4: Fastify Plugin

**File: `src/plugin.ts`**

```typescript
import fp from 'fastify-plugin'
import cookie from '@fastify/cookie'

export interface AuthPluginOptions {
  /**
   * Clerk secret key. Defaults to CLERK_SECRET_KEY env var.
   */
  secretKey?: string

  /**
   * Skip authentication for routes marked with { config: { public: true } }
   * @default true
   */
  respectPublicRoutes?: boolean

  /**
   * Custom handler for auth failures (logging, metrics, etc.)
   */
  onAuthFailure?: (error: AuthError, request: FastifyRequest) => void
}

async function authPlugin(
  fastify: FastifyInstance,
  options: AuthPluginOptions
) {
  // Register cookie plugin for session cookie support
  await fastify.register(cookie)

  // Create Clerk client
  const clerk = createClerkClient({
    secretKey: options.secretKey ?? process.env.CLERK_SECRET_KEY
  })

  // Decorate request with user
  fastify.decorateRequest('user', null)

  // Add auth hook
  fastify.addHook('preHandler', async (request, reply) => {
    // Check if route is public
    if (options.respectPublicRoutes !== false) {
      const routeConfig = request.routeOptions.config as { public?: boolean }
      if (routeConfig?.public) {
        return // Skip auth for public routes
      }
    }

    // Extract and verify token
    const token = extractToken(request)
    if (!token) {
      throw new AuthError('UNAUTHORIZED', 'Authentication required')
    }

    try {
      request.user = await verifyToken(token, clerk)
    } catch (error) {
      options.onAuthFailure?.(error as AuthError, request)
      throw error
    }
  })

  // Error handler for auth errors
  fastify.setErrorHandler((error, request, reply) => {
    if (error instanceof AuthError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message
        }
      })
    }
    throw error // Re-throw non-auth errors
  })
}

export default fp(authPlugin, {
  name: '@palindrom-ai/auth',
  fastify: '5.x'
})
```

**Fastify type augmentation:**

```typescript
declare module 'fastify' {
  interface FastifyRequest {
    user: UserContext | null
  }

  interface FastifyContextConfig {
    public?: boolean
    auth?: {
      roles?: string[]
      scopes?: string[]
    }
  }
}
```

---

### Phase 5: Permission Helpers

**File: `src/permissions.ts`**

```typescript
import type { FastifyRequest, FastifyReply } from 'fastify'
import { AuthError } from './errors.js'
import type { UserContext } from './context.js'

/**
 * Middleware factory for custom permission checks.
 */
export function requirePermission(
  check: (user: UserContext) => boolean,
  errorMessage = 'Insufficient permissions'
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      throw new AuthError('UNAUTHORIZED', 'Authentication required')
    }
    if (!check(request.user)) {
      throw new AuthError('FORBIDDEN', errorMessage)
    }
  }
}

/**
 * Require user to have a specific role in publicMetadata.roles
 */
export function requireRole(role: string) {
  return requirePermission(
    (user) => {
      const roles = user.publicMetadata['roles'] as string[] | undefined
      return roles?.includes(role) ?? false
    },
    `Role '${role}' required`
  )
}

/**
 * Require user to have all specified scopes in publicMetadata.scopes
 */
export function requireScopes(scopes: string[]) {
  return requirePermission(
    (user) => {
      const userScopes = user.publicMetadata['scopes'] as string[] | undefined
      return scopes.every(s => userScopes?.includes(s))
    },
    `Scopes required: ${scopes.join(', ')}`
  )
}

/**
 * Require user to be a member of any organization.
 */
export function requireOrgMembership() {
  return requirePermission(
    (user) => user.orgId !== null,
    'Organization membership required'
  )
}

/**
 * Require user to have a specific role in their organization.
 */
export function requireOrgRole(role: string) {
  return requirePermission(
    (user) => user.orgRole === role,
    `Organization role '${role}' required`
  )
}

/**
 * Get authenticated user, throwing if not authenticated.
 * Useful when you need the user in a route handler.
 */
export function getUser(request: FastifyRequest): UserContext {
  if (!request.user) {
    throw new AuthError('UNAUTHORIZED', 'Authentication required')
  }
  return request.user
}
```

---

### Phase 6: Test Utilities

**File: `src/testing/index.ts`**

```typescript
import type { FastifyRequest } from 'fastify'
import type { UserContext } from '../context.js'

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
    raw: {} as any,
    ...overrides
  }
}

/**
 * Fastify preHandler that injects a mock user.
 * Use in tests to bypass actual Clerk verification.
 */
export function mockAuth(userOverrides: Partial<UserContext> = {}) {
  return async (request: FastifyRequest) => {
    request.user = createMockUser(userOverrides)
  }
}

/**
 * Create a mock user with specific roles.
 */
export function createMockUserWithRoles(roles: string[]): UserContext {
  return createMockUser({
    publicMetadata: { roles }
  })
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
    orgSlug: orgSlug ?? orgId.replace('org_', '')
  })
}
```

---

### Phase 7: Documentation

**File: `README.md`**

```markdown
# @palindrom-ai/auth

Clerk authentication wrapper for Fastify services.

## Installation

npm install @palindrom-ai/auth

## Quick Start

// Register the plugin
import auth from '@palindrom-ai/auth'

await app.register(auth)

// All routes are now protected by default
app.get('/api/me', async (request) => {
  return { userId: request.user.userId }
})

// Mark routes as public
app.get('/health', { config: { public: true } }, async () => {
  return { status: 'ok' }
})

// Require specific roles
import { requireRole } from '@palindrom-ai/auth'

app.get('/admin', {
  preHandler: [requireRole('admin')]
}, async (request) => {
  return { admin: true }
})

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| CLERK_SECRET_KEY | Yes | Clerk backend API key |

## Testing

import { mockAuth, createMockUser } from '@palindrom-ai/auth/testing'

// In your test setup
app.addHook('preHandler', mockAuth({ userId: 'test_user' }))
```

---

### Phase 8: Clerk Setup Runbook

**File: `docs/runbooks/clerk-setup.md`**

```markdown
# Clerk Setup Runbook

This guide documents the manual steps required to set up Clerk authentication.

## Prerequisites

- Access to create accounts on clerk.com
- Google Cloud Console access (for Google OAuth)
- Azure AD access (for Microsoft OAuth)
- GitHub organization admin access (for GitHub OAuth)

---

## Step 1: Create Clerk Account

1. Go to https://clerk.com
2. Sign up with your work email
3. Verify your email

---

## Step 2: Create Applications

Create three applications for environment isolation:

| Application Name | Environment | Purpose |
|-----------------|-------------|---------|
| Palindrom Production | Production | Live services |
| Palindrom Staging | Staging | Pre-production testing |
| Palindrom Development | Development | Local development |

For each application:
1. Click "Create Application"
2. Enter the name
3. Select authentication methods:
   - [x] Email
   - [x] Google
   - [x] Microsoft
   - [x] GitHub

---

## Step 3: Configure Google OAuth

1. Go to Google Cloud Console → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID
   - Application type: Web application
   - Authorized redirect URIs: (get from Clerk dashboard)
3. Copy Client ID and Client Secret
4. Paste into Clerk dashboard → Social Connections → Google

---

## Step 4: Configure Microsoft OAuth

1. Go to Azure Portal → Azure Active Directory → App registrations
2. New registration
   - Redirect URI: (get from Clerk dashboard)
3. Create client secret
4. Copy Application (client) ID and client secret
5. Paste into Clerk dashboard → Social Connections → Microsoft

---

## Step 5: Configure GitHub OAuth

1. Go to GitHub → Settings → Developer settings → OAuth Apps
2. New OAuth App
   - Authorization callback URL: (get from Clerk dashboard)
3. Copy Client ID and generate Client Secret
4. Paste into Clerk dashboard → Social Connections → GitHub

---

## Step 6: Get API Keys

For each application, go to:
Clerk Dashboard → Developers → API Keys

Copy:
- `CLERK_SECRET_KEY` (starts with `sk_live_` or `sk_test_`)
- `CLERK_PUBLISHABLE_KEY` (starts with `pk_live_` or `pk_test_`)

---

## Step 7: Store Keys in Secrets Manager

See infrastructure documentation for storing keys in AWS Secrets Manager via Pulumi.

---

## Troubleshooting

### "Invalid API Key" Error
- Ensure CLERK_SECRET_KEY is set correctly
- Check you're using the right key for the environment

### OAuth Redirect Errors
- Verify redirect URIs match exactly in both Clerk and OAuth provider
- Check for trailing slashes

### Token Verification Failures
- Ensure clocks are synchronized (NTP)
- Check token hasn't expired
```

---

### Phase 9: Clerk Configuration Script

**File: `scripts/clerk/configure.sh`**

```bash
#!/bin/bash
set -euo pipefail

# Clerk Configuration Script
# Configures Clerk instance settings via API

CLERK_SECRET_KEY="${CLERK_SECRET_KEY:?CLERK_SECRET_KEY is required}"

echo "Configuring Clerk instance..."

# Configure allowed origins
curl -s -X PATCH "https://api.clerk.com/v1/instance" \
  -H "Authorization: Bearer ${CLERK_SECRET_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "allowed_origins": [
      "https://app.palindrom.ai",
      "https://staging.palindrom.ai",
      "http://localhost:3000"
    ]
  }' | jq .

echo "Clerk configuration complete."
```

---

## Usage Examples

### Basic Usage

```typescript
import Fastify from 'fastify'
import auth from '@palindrom-ai/auth'

const app = Fastify()

// Register auth - all routes protected by default
await app.register(auth)

// Protected route - requires authentication
app.get('/api/profile', async (request) => {
  return {
    userId: request.user.userId,
    email: request.user.email
  }
})

// Public route - no authentication required
app.get('/api/health', { config: { public: true } }, async () => {
  return { status: 'healthy' }
})

await app.listen({ port: 3000 })
```

### With Role-Based Access

```typescript
import auth, { requireRole, requireScopes } from '@palindrom-ai/auth'

await app.register(auth)

// Admin only
app.get('/api/admin/users', {
  preHandler: [requireRole('admin')]
}, async (request) => {
  return { users: [] }
})

// Requires specific scopes
app.delete('/api/users/:id', {
  preHandler: [requireScopes(['users:delete'])]
}, async (request) => {
  // Delete user
})
```

### With Organization Context

```typescript
import auth, { requireOrgMembership, requireOrgRole } from '@palindrom-ai/auth'

await app.register(auth)

// Requires user to be in an organization
app.get('/api/org/settings', {
  preHandler: [requireOrgMembership()]
}, async (request) => {
  return { orgId: request.user.orgId }
})

// Requires org admin role
app.put('/api/org/settings', {
  preHandler: [requireOrgRole('admin')]
}, async (request) => {
  // Update org settings
})
```

### Integration with fastify-api

```typescript
import { createApp } from '@palindrom/fastify-api'
import auth from '@palindrom-ai/auth'

const app = await createApp({
  name: 'my-service',
  server: { port: 3000 }
})

// Register auth plugin
await app.register(auth)

// Now all routes are protected
```

---

## Testing Strategy

### Unit Tests

```typescript
// tests/permissions.test.ts
import { describe, it, expect } from 'vitest'
import { createMockUser, requireRole } from '../src/index.js'

describe('requireRole', () => {
  it('allows user with matching role', async () => {
    const user = createMockUser({
      publicMetadata: { roles: ['admin', 'user'] }
    })
    const middleware = requireRole('admin')
    const request = { user } as any

    await expect(middleware(request, {} as any)).resolves.toBeUndefined()
  })

  it('rejects user without role', async () => {
    const user = createMockUser({
      publicMetadata: { roles: ['user'] }
    })
    const middleware = requireRole('admin')
    const request = { user } as any

    await expect(middleware(request, {} as any)).rejects.toThrow('FORBIDDEN')
  })
})
```

### Integration Tests

```typescript
// tests/plugin.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import auth from '../src/index.js'
import { mockAuth } from '../src/testing/index.js'

describe('auth plugin', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = Fastify()
    // Use mock auth for testing
    app.addHook('preHandler', mockAuth())
    await app.register(auth)
  })

  afterEach(async () => {
    await app.close()
  })

  it('populates request.user', async () => {
    app.get('/test', async (request) => {
      return { userId: request.user?.userId }
    })

    const response = await app.inject({ method: 'GET', url: '/test' })
    expect(response.json()).toEqual({ userId: 'user_test_123' })
  })
})
```

---

## IaC Integration

### Pulumi Secrets (Example)

```typescript
// infra/secrets/clerk.ts
import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'

const config = new pulumi.Config('clerk')

export const clerkSecret = new aws.secretsmanager.Secret('clerk-api-keys', {
  name: 'palindrom/clerk/${pulumi.getStack()}'
})

export const clerkSecretVersion = new aws.secretsmanager.SecretVersion('clerk-api-keys-version', {
  secretId: clerkSecret.id,
  secretString: pulumi.secret(JSON.stringify({
    CLERK_SECRET_KEY: config.requireSecret('secretKey'),
    CLERK_PUBLISHABLE_KEY: config.requireSecret('publishableKey')
  }))
})

// Export for ECS task definitions
export const clerkSecretArn = clerkSecret.arn
```

---

## Implementation Checklist

### Phase 1: Project Setup
- [ ] Initialize npm package
- [ ] Configure TypeScript
- [ ] Set up Vitest
- [ ] Create .env.example
- [ ] Set up GitHub Actions CI

### Phase 2: Core Types
- [ ] Define UserContext interface
- [ ] Define AuthError types
- [ ] Add Fastify type augmentations

### Phase 3: Token Handling
- [ ] Implement token extraction
- [ ] Implement Clerk verification
- [ ] Map Clerk session to UserContext

### Phase 4: Fastify Plugin
- [ ] Create plugin with cookie support
- [ ] Implement preHandler hook
- [ ] Handle public routes
- [ ] Set up error handler

### Phase 5: Permission Helpers
- [ ] Implement requirePermission
- [ ] Implement requireRole
- [ ] Implement requireScopes
- [ ] Implement requireOrgMembership
- [ ] Implement requireOrgRole
- [ ] Implement getUser helper

### Phase 6: Test Utilities
- [ ] Create createMockUser
- [ ] Create mockAuth middleware
- [ ] Create role/org mock helpers

### Phase 7: Documentation
- [ ] Write README.md
- [ ] Add JSDoc comments
- [ ] Create usage examples

### Phase 8: Runbook
- [ ] Document Clerk account setup
- [ ] Document OAuth provider setup
- [ ] Document API key retrieval
- [ ] Document secrets management

### Phase 9: Scripts
- [ ] Create Clerk configuration script

### Phase 10: Final
- [ ] Run full test suite
- [ ] Test with real Clerk instance
- [ ] Publish to npm
- [ ] Update Linear ticket

---

## Dependencies on Other Work

| Dependency | Status | Notes |
|------------|--------|-------|
| Clerk account created | ✅ Done | Personal workspace, "Palindrom Development" app |
| Google OAuth | ✅ Done | Using Clerk's shared credentials (dev) |
| Microsoft OAuth | ❌ Pending | Toggle in Clerk dashboard (shared credentials for dev) |
| GitHub OAuth | ❌ Pending | Toggle in Clerk dashboard (shared credentials for dev) |
| Allowed origins | ❌ Pending | Add `http://localhost:3000` in Clerk dashboard |
| API keys retrieved | ❌ Pending | Get `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY` |
| Pulumi secrets setup | ❌ Pending | For production only |
| @palindrom-ai/monitoring | ❌ Pending | Can add logging integration later |

### Clerk Dashboard URLs

- **Dashboard:** https://dashboard.clerk.com/apps/app_38jezfweuNVnpMVDKtxRcQxdiX8/instances/ins_38jezaTk6mbxlfet3N7upF2tt2r
- **SSO Connections:** https://dashboard.clerk.com/apps/app_38jezfweuNVnpMVDKtxRcQxdiX8/instances/ins_38jezaTk6mbxlfet3N7upF2tt2r/user-authentication/sso-connections

---

## Open Questions

1. **Cookie settings** — Should we configure cookie domain for cross-subdomain auth?
2. **Token refresh** — Should the package handle token refresh, or leave to frontend?
3. **Rate limiting** — Should auth failures be rate-limited?
4. **Metrics** — Should we emit metrics for auth success/failure rates?

These can be addressed in v1.1 after initial implementation.

---

## Success Criteria

1. Package published to npm as `@palindrom-ai/auth`
2. Can authenticate requests using Clerk JWT
3. Can authenticate requests using Clerk session cookies
4. Public routes work without authentication
5. Permission helpers work correctly
6. Test utilities enable easy testing
7. Documentation is clear and complete
8. Runbook enables anyone to set up Clerk
