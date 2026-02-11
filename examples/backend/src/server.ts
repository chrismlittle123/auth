import 'dotenv/config';
import { createApp } from '@progression-labs/fastify-api';
import cors from '@fastify/cors';
import auth, { getUser, requireRole } from '@progression-labs/auth';

const app = await createApp({
  name: 'auth-example',
  server: {
    port: 3001,
    host: '0.0.0.0',
  },
  logging: {
    level: 'info',
    pretty: true,
  },
  docs: {
    title: 'Auth Example API',
    description: 'Example API to test @progression-labs/auth',
    version: '0.1.0',
    path: '/docs',
  },
});

// Enable CORS for frontend
await app.register(cors, {
  origin: 'http://localhost:5173',
  credentials: true,
});

// Register auth plugin
await app.register(auth);

// Public route - no auth required (health is already registered by fastify-api)
app.get('/api/public', { config: { public: true } }, async () => {
  return { message: 'This is a public endpoint', timestamp: new Date().toISOString() };
});

// Protected route - requires valid Clerk token
app.get('/api/me', async (request) => {
  const user = getUser(request);
  return {
    userId: user.userId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    orgId: user.orgId,
  };
});

// Protected route with role check
app.get('/api/admin', { preHandler: [requireRole('admin')] }, async (request) => {
  const user = getUser(request);
  return {
    message: 'Welcome, admin!',
    userId: user.userId,
  };
});

// Protected route - returns full user context
app.get('/api/debug', async (request) => {
  const user = getUser(request);
  return {
    user,
    headers: {
      authorization: request.headers.authorization ? '[REDACTED]' : undefined,
    },
  };
});

await app.start();

console.log('\nRoutes:');
console.log('  GET /health      - Health check (from fastify-api)');
console.log('  GET /docs        - API documentation');
console.log('  GET /api/public  - Public endpoint');
console.log('  GET /api/me      - Get current user (requires auth)');
console.log('  GET /api/admin   - Admin only (requires admin role)');
console.log('  GET /api/debug   - Full user context (requires auth)\n');
