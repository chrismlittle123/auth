# Auth Package Example

A simple frontend + backend setup to test the `@palindrom-ai/auth` package.

## Setup

### 1. Get Clerk API Keys

Go to your Clerk Dashboard → **Developers** → **API Keys**:
https://dashboard.clerk.com/apps/app_38jezfweuNVnpMVDKtxRcQxdiX8/instances/ins_38jezaTk6mbxlfet3N7upF2tt2r

Copy:
- `CLERK_SECRET_KEY` (starts with `sk_test_`)
- `CLERK_PUBLISHABLE_KEY` (starts with `pk_test_`)

### 2. Configure Environment

```bash
# Backend
echo "CLERK_SECRET_KEY=sk_test_YOUR_KEY" > examples/backend/.env

# Frontend
echo "VITE_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_KEY" > examples/frontend/.env
```

### 3. Install Dependencies

From the repo root:

```bash
pnpm install
```

### 4. Run the Apps

Open two terminals:

**Terminal 1 - Backend (port 3001):**
```bash
cd examples/backend
pnpm dev
```

**Terminal 2 - Frontend (port 5173):**
```bash
cd examples/frontend
pnpm dev
```

### 5. Test It

1. Open http://localhost:5173
2. Click "Sign In" and authenticate with Google (or other enabled provider)
3. Click the API test buttons:
   - `/health` - Should work without auth
   - `/api/me` - Returns your user info
   - `/api/admin` - Will fail (you don't have admin role)
   - `/api/debug` - Full user context

## Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| GET /health | Public | Health check (from fastify-api) |
| GET /docs | Public | API documentation (Scalar) |
| GET /api/public | Public | Public test endpoint |
| GET /api/me | Required | Current user info |
| GET /api/admin | Required + admin role | Admin only |
| GET /api/debug | Required | Full user context |

## Stack

- **Backend:** `@palindrom/fastify-api` + `@palindrom-ai/auth`
- **Frontend:** Vite + React + `@clerk/clerk-react`
