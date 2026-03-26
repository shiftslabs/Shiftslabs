# Shiftslabs - AI Agent Documentation

**Project**: Shiftslabs (Google rival ecosystem with 50+ apps)
**Database**: Supabase (NOT Cloudflare D1 - important!)
**Last Updated**: 2026-03-26

---

## Project Overview

Shiftslabs is a comprehensive ecosystem of 50+ applications unified by a central SSO (Single Sign-On) infrastructure. The auth system allows users to sign in once and access all apps without re-authentication.

### What Already Works
- User registration with PBKDF2 password hashing
- User login with session management
- OAuth-style `/authorize` flow with consent UI
- Token exchange (`/token`) with one-time auth codes
- JWT verification (`/verify`)
- Token refresh with rotation (`/refresh`)
- Logout flow
- Whitelisted vs non-whitelisted app handling

### What Needs Work
- Auth client SDK (`packages/authclient` - currently empty package.json)
- Individual apps (chatbot, learnx, classroom)
- App-specific databases
- Global logout signal (broadcast to all apps)

---

## Architecture

```
shiftslabs/
├── apps/
│   ├── account/      # SSO Hub - login/signup/dashboard
│   ├── chatbot/       # AI Chatbot (to build)
│   ├── learnx/       # LearnX Education (to build)
│   └── classroom/    # Classroom LMS (to build)
├── packages/
│   ├── auth/         # @shiftslabs/auth - Auth server (Cloudflare Worker)
│   ├── authclient/   # @shiftslabs/authclient - Client SDK (to complete)
│   └── ui/           # @shiftslabs/ui - Shared UI components (to build)
└── infra/
    └── db/           # Supabase migrations & seeds
```

---

## Stack

| Component | Technology |
|-----------|-------------|
| Language | TypeScript |
| Runtime | Cloudflare Workers/Pages |
| Database | PostgreSQL via Supabase |
| JWT | jose library |
| UI | Tailwind CSS |

---

## Database (Supabase)

### Auth Database: `shiftslabs_auth_db`

**Tables:**

```sql
-- users: Main user table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  avatar_url TEXT DEFAULT '',
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- apps: Registered applications
CREATE TABLE apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  client_id TEXT UNIQUE NOT NULL,
  redirect_uri TEXT NOT NULL,
  is_whitelisted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- user_consents: User grants for apps
CREATE TABLE user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  app_id UUID REFERENCES apps(id),
  scope TEXT,
  granted_at TIMESTAMPTZ DEFAULT NOW()
);

-- sessions: Refresh token storage
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  refresh_token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### App-Specific Databases (to create)
- `shiftslabs_chatbot_db`
- `shiftslabs_learnx_db`
- `shiftslabs_classroom_db`

---

## Auth Server Endpoints

All endpoints are in [`packages/auth/src/index.ts`](packages/auth/src/index.ts)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/register` | POST | Create new user account |
| `/login` | POST | Authenticate user |
| `/authorize` | GET | OAuth authorization start |
| `/token` | POST | Exchange code for tokens |
| `/verify` | GET | Verify JWT token |
| `/refresh` | POST | Refresh access token |
| `/logout` | POST | Clear session |
| `/me` | GET | Get current user |
| `/create-code` | POST | Internal - create auth code |

### Environment Variables

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
AUTH_SECRET=your_jwt_secret_min_32_chars
AUTH_CODES=KV_NAMESPACE  # Cloudflare KV for temp auth codes
```

---

## Auth Flow

### 1. Registration
```
User → POST /register → Hash password → Create user → Return JWT + cookie
```

### 2. Login
```
User → POST /login → Verify password → Return JWT + cookie
```

### 3. Authorization
```
App → GET /authorize?client_id=xxx&redirect_uri=xxx
  → Check session cookie
  → If not logged in → Show login page
  → If logged in + whitelisted → Auto-generate code → Redirect
  → If logged in + non-whitelisted → Show consent → Generate code → Redirect
```

### 4. Token Exchange
```
App → POST /token { code, client_id }
  → Validate code (10 min expiry)
  → Generate access_token (JWT, 15 min)
  → Generate refresh_token (30 days)
  → Store refresh_token in sessions table
```

### 5. Token Refresh
```
App → POST /refresh { refresh_token }
  → Validate refresh_token in DB
  → Generate new access_token
  → Rotate refresh_token (delete old, create new)
```

---

## JWT Rules

- **Library**: jose
- **Algorithm**: HS256
- **Access Token Expiry**: 15 minutes
- **Refresh Token Expiry**: 30 days
- **DO NOT create long-lived JWTs** - use refresh tokens

---

## Cross-Platform Compatibility

| Platform | Method |
|----------|--------|
| Pages.dev subdomains | URL-based handshake with code |
| Safari (iOS) | Full redirect fallback |
| PWA | LocalStorage primary |
| APK | LocalStorage + native storage |

---

## Auth Client SDK (packages/authclient)

**Status**: Empty - needs implementation

Required features:
- `init()`: Check localStorage, detect `?code` in URL, exchange code for token
- `getUser()`: Get current user
- `getToken()`: Get current JWT
- `login()`: Redirect to `/authorize`
- `logout()`: Clear storage + call `/logout`
- `auto refresh`: If token near expiry → try iframe, if fails → redirect

---

## App Behavior

All apps (chatbot, learnx, classroom, etc.) must:

1. **NOT build login forms** - use authclient
2. On load: call `authclient.init()`
3. If NOT authenticated: show "Sign in with Shiftslabs" button
4. On click: redirect to `/authorize`

---

## Whitelist vs Non-Whitelist Apps

| App Type | Behavior |
|----------|----------|
| **Whitelisted** | Auto-login, no consent needed |
| **Non-Whitelisted** | Show consent: "App X wants username + avatar" |

---

## Security Requirements

1. Validate `client_id` and `redirect_uri` strictly
2. Verify JWT on protected routes
3. Sanitize all inputs
4. Do not trust frontend data
5. Rate limiting
6. CORS headers
7. One-time auth codes (10 min expiry)
8. Token rotation on refresh

---

## Testing Checklist

- [ ] Registration Flow: User creates account → password hashed → auto-login
- [ ] SSO Flow: Login once → access all apps without re-auth
- [ ] Token Refresh: JWT auto-refreshes after 15 min
- [ ] Logout Flow: Logout clears all apps
- [ ] Classroom Flow: Teacher creates course → Student enrolls → Submit → Grade

---

## File Reference

| File | Description |
|------|-------------|
| [`prompt.md`](prompt.md) | Original project specification |
| [`packages/auth/src/index.ts`](packages/auth/src/index.ts) | Auth server (838 lines) |
| [`infra/db/migrations/001_auth_schema.sql`](infra/db/migrations/001_auth_schema.sql) | Database schema |
| [`infra/db/seeds/001_apps.sql`](infra/db/seeds/001_apps.sql) | Seed data for default apps |
| [`packages/auth/wrangler.toml`](packages/auth/wrangler.toml) | Cloudflare Worker config |

---

## Next Steps for AI Agent

1. **Complete authclient SDK**: Implement the client-side library in `packages/authclient`
2. **Build account app**: Create the SSO hub UI at `apps/account/`
3. **Build chatbot app**: Create first actual app using the auth system
4. **Create additional migrations**: Add app-specific database schemas
5. **Implement global logout**: Broadcast logout signal to all apps
6. **Add rate limiting**: Protect auth endpoints from abuse

---

## Key Reminders

- **Database is Supabase** - NOT Cloudflare D1 (this was a previous mistake)
- Use `createClient` from `@supabase/supabase-js` for database access
- Auth codes stored in Cloudflare KV (`env.AUTH_CODES`) - expires in 10 min
- Always use PBKDF2 for password hashing (100,000 iterations, SHA-256)
- Token rotation is REQUIRED on refresh
