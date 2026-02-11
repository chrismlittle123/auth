# @progression-labs/auth

Clerk authentication plugin for Fastify services.

## Installation

```bash
pnpm add @progression-labs/auth
```

Or link locally:
```json
{
  "dependencies": {
    "@progression-labs/auth": "file:../path/to/auth"
  }
}
```

## Quick Start

```typescript
import Fastify from 'fastify'
import auth from '@progression-labs/auth'

const app = Fastify()

// Register plugin (reads CLERK_SECRET_KEY from env)
await app.register(auth)

// All routes are protected by default
app.get('/api/me', async (request) => {
  return { userId: request.user.userId }
})

// Mark routes as public
app.get('/health', { config: { public: true } }, async () => {
  return { status: 'ok' }
})

await app.listen({ port: 3000 })
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CLERK_SECRET_KEY` | Yes | Clerk secret key (starts with `sk_test_` or `sk_live_`) |

## Plugin Options

```typescript
await app.register(auth, {
  // Clerk secret key (defaults to CLERK_SECRET_KEY env var)
  secretKey: 'sk_test_...',

  // Authorized frontend origins
  authorizedParties: ['https://app.example.com'],

  // JWT public key for networkless verification
  jwtKey: process.env.CLERK_JWT_KEY,

  // Skip auth for routes with { config: { public: true } }
  respectPublicRoutes: true, // default

  // Callback for auth failures (logging, metrics)
  onAuthFailure: (error, request) => {
    console.error('Auth failed:', error.code)
  },
})
```

## User Context

After authentication, `request.user` contains:

```typescript
interface UserContext {
  userId: string
  sessionId: string
  email: string | null
  firstName: string | null
  lastName: string | null
  imageUrl: string | null
  orgId: string | null
  orgRole: string | null
  orgSlug: string | null
  publicMetadata: Record<string, unknown>
  privateMetadata: Record<string, unknown>
  raw: JwtPayload // Raw Clerk JWT
}
```

## Permission Helpers

### requireRole

```typescript
import { requireRole } from '@progression-labs/auth'

app.get('/admin', {
  preHandler: [requireRole('admin')]
}, async (request) => {
  return { message: 'Admin only' }
})
```

Checks `request.user.publicMetadata.roles` array.

### requireScopes

```typescript
import { requireScopes } from '@progression-labs/auth'

app.delete('/api/users/:id', {
  preHandler: [requireScopes(['users:read', 'users:delete'])]
}, async (request) => {
  // User has both scopes
})
```

### requireOrgMembership

```typescript
import { requireOrgMembership } from '@progression-labs/auth'

app.get('/org/settings', {
  preHandler: [requireOrgMembership()]
}, async (request) => {
  return { orgId: request.user.orgId }
})
```

### requireOrgRole

```typescript
import { requireOrgRole } from '@progression-labs/auth'

app.put('/org/settings', {
  preHandler: [requireOrgRole('admin')]
}, async (request) => {
  // User is org admin
})
```

### requirePermission (custom)

```typescript
import { requirePermission } from '@progression-labs/auth'

app.get('/premium', {
  preHandler: [requirePermission(
    (user) => user.publicMetadata.plan === 'premium',
    'Premium plan required'
  )]
}, async (request) => {
  // Custom permission logic
})
```

### getUser

```typescript
import { getUser } from '@progression-labs/auth'

app.get('/api/me', async (request) => {
  const user = getUser(request) // Throws if not authenticated
  return { userId: user.userId }
})
```

## Error Responses

All auth errors return a consistent format:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | No token provided |
| `INVALID_TOKEN` | 401 | Token malformed or invalid |
| `TOKEN_EXPIRED` | 401 | Token has expired |
| `FORBIDDEN` | 403 | Valid token but insufficient permissions |

## Frontend Integration

Your frontend should use Clerk's SDK to get a token and pass it in the `Authorization` header:

```typescript
// React example with @clerk/clerk-react
import { useAuth } from '@clerk/clerk-react'

function MyComponent() {
  const { getToken } = useAuth()

  const callApi = async () => {
    const token = await getToken()

    const response = await fetch('https://api.example.com/api/me', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
  }
}
```

## License

MIT
