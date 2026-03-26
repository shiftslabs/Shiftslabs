# Shiftslabs SSO System Rules

## Project Overview
Shiftslabs is a Google rival ecosystem with 50+ apps. Core SSO (Single Sign-On) infrastructure powers all apps.

## Stack
- TypeScript
- Cloudflare Pages + Workers (deployment target)
- PostgreSQL (Supabase, NOT Cloudflare D1)
- Tailwind CSS
- jose (JWT handling)

---

## MONOREPO STRUCTURE

```
shiftslabs/
├── apps/
│   ├── account/      # SSO Hub - login/signup/dashboard
│   ├── chatbot/       # AI Chatbot
│   ├── learnx/       # LearnX Education
│   └── classroom/    # Classroom LMS
├── packages/
│   ├── auth/         # @shiftslabs/auth - Auth server
│   ├── authclient/   # @shiftslabs/authclient - Client SDK
│   └── ui/           # @shiftslabs/ui - Shared UI components
└── infra/
    └── db/           # Supabase migrations
```

---

## DATABASE (SUPABASE)

### Auth Database: shiftslabs_auth_db

Tables:
- **users**: id (uuid), username (unique), email (unique), avatar_url, password_hash, created_at
- **apps**: id (uuid), name, client_id (unique), redirect_uri, is_whitelisted, created_at
- **user_consents**: id (uuid), user_id (fk), app_id (fk), scope, granted_at
- **sessions**: id (uuid), user_id (fk), refresh_token (unique), expires_at, created_at

### App-Specific Databases
- shiftslabs_chatbot_db
- shiftslabs_learnx_db
- shiftslabs_classroom_db

---

## AUTH SERVER ENDPOINTS (packages/auth)

### POST /register
- Accept: { username, email, password, avatar_url? }
- Validate uniqueness
- Hash password (PBKDF2)
- Create user, create session
- Return 201 with user info

### GET/POST /authorize
- Accept: client_id, redirect_uri, scope
- Validate client_id + redirect_uri
- Check user session
- If not logged in → show login UI
- After login → show consent UI
- On approve → generate one-time auth_code
- Redirect: redirect_uri?code=AUTH_CODE

### POST /token
- Accept: auth_code, client_id
- Verify auth_code (expires in 10 min)
- Generate: access_token (JWT, 15 min) + refresh_token (30 days)
- Return: { access_token, refresh_token, user }

### GET /verify
- Accept: Authorization header with token
- Return current user if valid
- Used for hidden iframe authentication

### POST /refresh
- Accept: { refresh_token }
- Validate refresh token exists and not expired
- Generate new access_token + rotate refresh_token
- Return: { access_token, refresh_token, user }

### POST /logout
- Invalidate session
- Trigger global logout signal

---

## JWT RULES
- Use jose library
- Access token expires in 15 minutes
- DO NOT create long-lived JWT
- Refresh token handles long sessions

---

## CROSS-PLATFORM COMPATIBILITY

| Platform | Method |
|----------|--------|
| Pages.dev subdomains | URL-based handshake with code |
| Safari (iOS) | Full redirect fallback |
| PWA | LocalStorage primary |
| APK | LocalStorage + native storage |

---

## AUTH CLIENT SDK (packages/authclient)

Features:
- **init()**: Check localStorage, detect ?code in URL, exchange code for token
- **getUser()**: Get current user
- **getToken()**: Get current JWT
- **login()**: Redirect to /authorize
- **logout()**: Clear storage + call /logout
- **auto refresh**: If token near expiry → try iframe, if fails → redirect

---

## APP BEHAVIOR

### All Apps (chatbot, learnx, classroom):
- DO NOT build login forms
- MUST use authclient

On load:
- call authclient.init()

If NOT authenticated:
- show button: "Sign in with Shiftslabs"

On click:
- redirect to /authorize

---

## WHITELIST VS NON-WHITELIST APPS

| App Type | Behavior |
|----------|----------|
| **Whitelisted** | Auto-login, no consent needed |
| **Non-Whitelisted** | Show consent: "App X wants username + avatar" |

---

## SECURITY

1. Validate client_id and redirect_uri strictly
2. Verify JWT on protected routes
3. Sanitize all inputs
4. Do not trust frontend data
5. Rate limiting
6. CORS headers
7. One-time auth codes (10 min expiry)
8. Token rotation on refresh

---

## UI REQUIREMENTS

- Tailwind CSS
- Full screen layout
- Sidebar navigation
- Responsive mobile UI

---

## DEPLOYMENT

- Each app deploys separately on Cloudflare Pages
- Auth server deploys as Worker/API
- Use environment variables for secrets

---

## TESTING CHECKLIST

1. Registration Flow: User creates account → password hashed → auto-login
2. SSO Flow: Login once → access all apps without re-auth
3. Token Refresh: JWT auto-refreshes after 15 min
4. Logout Flow: Logout clears all apps
5. Classroom Flow: Teacher creates course → Student enrolls → Submit → Grade
