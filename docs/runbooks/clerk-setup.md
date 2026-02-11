# Clerk Setup Runbook

Complete guide for setting up Clerk authentication for Progression Labs services.

**Last Updated:** 2026-01-25

---

## Current Status

| Item | Status | Details |
|------|--------|---------|
| Clerk Account | ✅ Done | Personal workspace |
| Application | ✅ Done | "Progression Labs Development" |
| Google OAuth | ✅ Done | Using Clerk shared credentials |
| Microsoft OAuth | ❌ Pending | Toggle in dashboard |
| GitHub OAuth | ❌ Pending | Toggle in dashboard |
| Allowed Origins | ❌ Pending | Add localhost |
| API Keys | ❌ Pending | Retrieve from dashboard |

### Quick Links

- **Dashboard:** https://dashboard.clerk.com/apps/app_38jezfweuNVnpMVDKtxRcQxdiX8/instances/ins_38jezaTk6mbxlfet3N7upF2tt2r
- **SSO Connections:** https://dashboard.clerk.com/apps/app_38jezfweuNVnpMVDKtxRcQxdiX8/instances/ins_38jezaTk6mbxlfet3N7upF2tt2r/user-authentication/sso-connections

---

## Development vs Production

Clerk provides **shared OAuth credentials** for development that work immediately — no OAuth app configuration needed.

| Environment | OAuth Credentials | Keys | Setup Effort |
|-------------|-------------------|------|--------------|
| Development | Clerk's shared credentials | `sk_test_*`, `pk_test_*` | Minimal (toggle switches) |
| Production | Your own OAuth apps | `sk_live_*`, `pk_live_*` | Full OAuth setup required |

**For now, we're setting up Development only.**

---

## Part 1: Development Setup (Simple)

### Step 1: Enable Microsoft OAuth

1. Go to [SSO Connections](https://dashboard.clerk.com/apps/app_38jezfweuNVnpMVDKtxRcQxdiX8/instances/ins_38jezaTk6mbxlfet3N7upF2tt2r/user-authentication/sso-connections)
2. Find "Microsoft" in the list
3. Toggle it **ON**
4. Done — Clerk's shared credentials handle the rest

### Step 2: Enable GitHub OAuth

1. Same page as above
2. Find "GitHub" in the list
3. Toggle it **ON**
4. Done

### Step 3: Configure Allowed Origins

1. Go to Dashboard → Developers → API Keys
2. Scroll to "Allowed Origins"
3. Add: `http://localhost:3000`
4. Add any other local dev URLs you use

### Step 4: Retrieve API Keys

1. Go to Dashboard → Developers → API Keys
2. Copy these values:

```bash
# Development keys (for .env.local)
CLERK_SECRET_KEY=sk_test_xxxxx
CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
```

3. Store in your local `.env` file (never commit!)

### Step 5: Verify Setup

1. Create a test app with Clerk React SDK
2. Try signing in with:
   - [ ] Google
   - [ ] Microsoft
   - [ ] GitHub
   - [ ] Email/Password

**Development setup complete!**

---

## Part 2: Production Setup (Later)

When you're ready for production, you'll need to:

1. Create a new Clerk application "Progression Labs Production"
2. Configure your own OAuth apps (detailed below)
3. Store production keys in AWS Secrets Manager via Pulumi

### Step 1: Create Production Application

1. In Clerk dashboard, click "Create Application"
2. Name: `Progression Labs Production`
3. Select sign-in methods (Google, Microsoft, GitHub, Email)
4. This creates a separate production environment

### Step 2: Create Google OAuth App

**Why:** Production requires your own OAuth credentials for branding, analytics, and control.

1. Go to https://console.cloud.google.com
2. Create project: `progression-labs-auth` (or use existing)
3. Go to APIs & Services → Credentials
4. Create OAuth 2.0 Client ID:
   - Type: Web application
   - Name: `Progression Labs Production`
   - Authorized redirect URIs: Copy from Clerk dashboard
5. Copy Client ID and Client Secret
6. Paste into Clerk → Social Connections → Google
7. Toggle "Use custom credentials"

### Step 3: Create Microsoft OAuth App

1. Go to https://portal.azure.com
2. Azure Active Directory → App registrations → New registration
3. Configure:
   - Name: `Progression Labs Auth Production`
   - Account types: "Accounts in any organizational directory and personal Microsoft accounts"
   - Redirect URI: Copy from Clerk dashboard
4. Create client secret (Certificates & secrets → New client secret)
5. Copy Application ID and Client Secret
6. Paste into Clerk → Social Connections → Microsoft

### Step 4: Create GitHub OAuth App

1. Go to GitHub → Settings → Developer settings → OAuth Apps
2. New OAuth App:
   - Name: `Progression Labs Production`
   - Homepage: `https://progression-labs.ai`
   - Callback URL: Copy from Clerk dashboard
3. Copy Client ID, generate Client Secret
4. Paste into Clerk → Social Connections → GitHub

### Step 5: Store Secrets with Pulumi

```bash
cd infra/pulumi

# Set production secrets
pulumi config set --secret clerk:secretKey "sk_live_xxxx" --stack prod
pulumi config set --secret clerk:publishableKey "pk_live_xxxx" --stack prod

# Deploy
pulumi up --stack prod
```

---

## Environment Summary

### Development (Current)

```
Application: Progression Labs Development
Instance: ins_38jezaTk6mbxlfet3N7upF2tt2r
Keys: sk_test_*, pk_test_*
OAuth: Clerk shared credentials
```

### Staging (Future)

```
Application: Progression Labs Staging
Instance: (to be created)
Keys: sk_test_*, pk_test_*
OAuth: Clerk shared credentials (or own)
```

### Production (Future)

```
Application: Progression Labs Production
Instance: (to be created)
Keys: sk_live_*, pk_live_*
OAuth: Your own OAuth apps (required)
```

---

## Troubleshooting

### "Invalid API Key" Error

- Check you're using `sk_test_*` for development
- Ensure no extra whitespace when copying
- Verify the key matches the application instance

### OAuth Sign-in Fails

- For development: Ensure the provider is toggled ON in SSO Connections
- For production: Verify redirect URIs match exactly

### "Origin Not Allowed" Error

- Add your origin to Allowed Origins in API Keys settings
- Include protocol: `http://localhost:3000` not `localhost:3000`

---

## Security Checklist

### Development
- [ ] API keys are in `.env.local` (gitignored)
- [ ] Never commit `.env` files

### Production
- [ ] Keys stored in AWS Secrets Manager
- [ ] Using `sk_live_*` keys only
- [ ] Own OAuth credentials configured
- [ ] Allowed origins restricted to production domains

---

## Next Steps After Setup

1. **Build the auth package** — Implement `@progression-labs/auth`
2. **Integrate with frontend** — Add Clerk React SDK to your app
3. **Test end-to-end** — Verify frontend → backend auth flow
4. **Production setup** — When ready to launch
