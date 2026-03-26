import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SignJWT, jwtVerify } from 'jose';

// Environment types
export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  AUTH_SECRET: string;
  AUTH_CODES: KVNamespace;
}

// Types
interface User {
  id: string;
  username: string;
  email: string;
  avatar_url: string;
  password_hash: string;
  created_at: string;
}

interface App {
  id: string;
  name: string;
  client_id: string;
  redirect_uri: string;
  is_whitelisted: boolean;
  created_at: string;
}

interface Session {
  id: string;
  user_id: string;
  refresh_token: string;
  expires_at: string;
  created_at: string;
}

interface AuthCodeData {
  code: string;
  client_id: string;
  redirect_uri: string;
  user_id: string;
  scope: string;
  expires_at: number;
}

// Helper: Create Supabase client
function getSupabaseClient(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

// Helper: Get JWT secret
function getJWTSecret(env: Env): Uint8Array {
  return new TextEncoder().encode(env.AUTH_SECRET);
}

// Helper: Generate random string
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Helper: Hash password with PBKDF2
async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  return salt + ':' + Buffer.from(derivedBits).toString('base64');
}

// Helper: Verify password
async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(':');
  const computedHash = await hashPassword(password, salt);
  return computedHash === storedHash;
}

// Helper: CORS headers
function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

// Helper: Get session from cookie
async function getSessionFromCookie(request: Request, env: Env): Promise<User | null> {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;

  const cookies = Object.fromEntries(
    cookieHeader.split('; ').map(c => c.split('='))
  );

  const token = cookies['session_token'];
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getJWTSecret(env));
    const supabase = getSupabaseClient(env);
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', payload.userId)
      .single();
    return user as User | null;
  } catch {
    return null;
  }
}

// Helper: Set session cookie
function setSessionCookie(token: string): string {
  return `session_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${15 * 60}`;
}

// Routes
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    // Add CORS headers to all responses
    const cors = corsHeaders();

    try {
      // Route: /register
      if (path === '/register' && request.method === 'POST') {
        return await handleRegister(request, env, cors);
      }

      // Route: /login
      if (path === '/login' && request.method === 'POST') {
        return await handleLogin(request, env, cors);
      }

      // Route: /authorize
      if (path === '/authorize') {
        return await handleAuthorize(request, env, cors);
      }

      // Route: /token
      if (path === '/token' && request.method === 'POST') {
        return await handleToken(request, env, cors);
      }

      // Route: /verify
      if (path === '/verify') {
        return await handleVerify(request, env, cors);
      }

      // Route: /refresh
      if (path === '/refresh' && request.method === 'POST') {
        return await handleRefresh(request, env, cors);
      }

      // Route: /logout
      if (path === '/logout' && request.method === 'POST') {
        return await handleLogout(request, env, cors);
      }

      // Route: /me
      if (path === '/me') {
        return await handleMe(request, env, cors);
      }

      // Default: 404
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...cors }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...cors }
      });
    }
  }
};

// POST /register
async function handleRegister(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const { username, email, password, avatar_url } = await request.json();

  // Validation
  if (!username || !email || !password) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors }
    });
  }

  if (username.length < 3 || username.length > 50) {
    return new Response(JSON.stringify({ error: 'Username must be 3-50 characters' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors }
    });
  }

  if (password.length < 8) {
    return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors }
    });
  }

  const supabase = getSupabaseClient(env);

  // Check if username or email exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .or(`username.eq.${username},email.eq.${email}`)
    .single();

  if (existingUser) {
    return new Response(JSON.stringify({ error: 'Username or email already exists' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json', ...cors }
    });
  }

  // Hash password
  const salt = generateRandomString(32);
  const password_hash = await hashPassword(password, salt);

  // Create user
  const { data: user, error } = await supabase
    .from('users')
    .insert({
      username,
      email,
      avatar_url: avatar_url || '',
      password_hash
    })
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors }
    });
  }

  // Create session token
  const token = await new SignJWT({ userId: user.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(getJWTSecret(env));

  const response = new Response(JSON.stringify({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar_url
    },
    access_token: token
  }), {
    status: 201,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': setSessionCookie(token),
      ...cors
    }
  });

  return response;
}

// POST /login
async function handleLogin(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const { email, password } = await request.json();

  if (!email || !password) {
    return new Response(JSON.stringify({ error: 'Missing email or password' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors }
    });
  }

  const supabase = getSupabaseClient(env);

  // Find user
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...cors }
    });
  }

  // Verify password
  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...cors }
    });
  }

  // Create session token
  const token = await new SignJWT({ userId: user.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(getJWTSecret(env));

  return new Response(JSON.stringify({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar_url
    },
    access_token: token
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': setSessionCookie(token),
      ...cors
    }
  });
}

// GET /authorize
async function handleAuthorize(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const url = new URL(request.url);
  const client_id = url.searchParams.get('client_id');
  const redirect_uri = url.searchParams.get('redirect_uri');
  const scope = url.searchParams.get('scope') || 'read:profile';

  if (!client_id || !redirect_uri) {
    return new Response(JSON.stringify({ error: 'Missing client_id or redirect_uri' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors }
    });
  }

  const supabase = getSupabaseClient(env);

  // Validate app
  const { data: app } = await supabase
    .from('apps')
    .select('*')
    .eq('client_id', client_id)
    .single();

  if (!app) {
    return new Response(JSON.stringify({ error: 'Invalid client_id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors }
    });
  }

  // Validate redirect_uri
  if (app.redirect_uri !== redirect_uri) {
    return new Response(JSON.stringify({ error: 'Invalid redirect_uri' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors }
    });
  }

  // Check user session
  const user = await getSessionFromCookie(request, env);

  // If no session, show login page
  if (!user) {
    const loginPage = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign In - Shiftslabs</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-900 min-h-screen flex items-center justify-center">
  <div class="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md">
    <h1 class="text-2xl font-bold text-white mb-6 text-center">Sign In to Shiftslabs</h1>
    <form id="loginForm" class="space-y-4">
      <div>
        <label class="block text-gray-300 text-sm font-medium mb-2">Email</label>
        <input type="email" id="email" required class="w-full px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
      </div>
      <div>
        <label class="block text-gray-300 text-sm font-medium mb-2">Password</label>
        <input type="password" id="password" required class="w-full px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
      </div>
      <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition">
        Sign In
      </button>
    </form>
    <p class="mt-4 text-center text-gray-400">
      Don't have an account? <a href="/register?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}" class="text-blue-400 hover:underline">Sign up</a>
    </p>
    <div id="error" class="mt-4 text-red-400 text-center hidden"></div>
  </div>
  <script>
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const errorDiv = document.getElementById('error');
      
      try {
        const res = await fetch('/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        
        if (!res.ok) {
          const data = await res.json();
          errorDiv.textContent = data.error;
          errorDiv.classList.remove('hidden');
          return;
        }
        
        const data = await res.json();
        document.cookie = 'session_token=' + data.access_token + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=900';
        
        // Check consent for non-whitelisted apps
        const isWhitelisted = ${app.is_whitelisted};
        if (!isWhitelisted) {
          window.location.href = '/consent?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=${scope}';
        } else {
          window.location.href = '${redirect_uri}?code=' + btoa(JSON.stringify({ userId: data.user.id, timestamp: Date.now() }));
        }
      } catch (err) {
        errorDiv.textContent = 'Login failed';
        errorDiv.classList.remove('hidden');
      }
    });
  </script>
</body>
</html>`;
    return new Response(loginPage, {
      headers: { 'Content-Type': 'text/html', ...cors }
    });
  }

  // Check if app is whitelisted
  if (app.is_whitelisted) {
    // Auto-generate auth code for whitelisted apps
    const code = generateRandomString(32);
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    await env.AUTH_CODES.put(code, JSON.stringify({
      client_id,
      redirect_uri,
      user_id: user.id,
      scope,
      expires_at: expiresAt
    }));

    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${redirect_uri}?code=${code}`,
        ...cors
      }
    });
  }

  // Show consent page for non-whitelisted apps
  const consentPage = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize App - Shiftslabs</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-900 min-h-screen flex items-center justify-center">
  <div class="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md">
    <h1 class="text-2xl font-bold text-white mb-4 text-center">Authorize ${app.name}</h1>
    <p class="text-gray-300 text-center mb-6">
      This app wants to access your profile information:
    </p>
    <div class="bg-gray-700 p-4 rounded-lg mb-6">
      <ul class="space-y-2 text-gray-300">
        <li>✓ Username</li>
        <li>✓ Avatar</li>
      </ul>
    </div>
    <form id="consentForm">
      <input type="hidden" name="client_id" value="${client_id}">
      <input type="hidden" name="redirect_uri" value="${redirect_uri}">
      <input type="hidden" name="scope" value="${scope}">
      <div class="flex space-x-4">
        <button type="submit" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition">
          Allow
        </button>
        <a href="${redirect_uri}" class="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg text-center transition">
          Deny
        </a>
      </div>
    </form>
  </div>
  <script>
    document.getElementById('consentForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      
      const code = '${generateRandomString(32)}';
      const expiresAt = Date.now() + 10 * 60 * 1000;
      
      await fetch('/create-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          client_id: formData.get('client_id'),
          redirect_uri: formData.get('redirect_uri'),
          user_id: '${user.id}',
          scope: formData.get('scope'),
          expires_at: expiresAt
        })
      });
      
      window.location.href = formData.get('redirect_uri') + '?code=' + code;
    });
  </script>
</body>
</html>`;

  return new Response(consentPage, {
    headers: { 'Content-Type': 'text/html', ...cors }
  });
}

// POST /create-code (internal)
async function handleCreateCode(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const { code, client_id, redirect_uri, user_id, scope, expires_at } = await request.json();

  await env.AUTH_CODES.put(code, JSON.stringify({
    client_id,
    redirect_uri,
    user_id,
    scope,
    expires_at
  }));

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json', ...cors }
  });
}

// POST /token
async function handleToken(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const { code, client_id } = await request.json();

  if (!code || !client_id) {
    return new Response(JSON.stringify({ error: 'Missing code or client_id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors }
    });
  }

  // Get auth code from KV
  const codeData = await env.AUTH_CODES.get(code);
  
  if (!codeData) {
    return new Response(JSON.stringify({ error: 'Invalid or expired code' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors }
    });
  }

  const data: AuthCodeData = JSON.parse(codeData);

  // Check expiration
  if (Date.now() > data.expires_at) {
    await env.AUTH_CODES.delete(code);
    return new Response(JSON.stringify({ error: 'Code expired' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors }
    });
  }

  // Validate client_id
  if (data.client_id !== client_id) {
    return new Response(JSON.stringify({ error: 'Client_id mismatch' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors }
    });
  }

  // Delete the code (one-time use)
  await env.AUTH_CODES.delete(code);

  // Get user
  const supabase = getSupabaseClient(env);
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', data.user_id)
    .single();

  if (!user) {
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...cors }
    });
  }

  // Generate access token (JWT)
  const access_token = await new SignJWT({
    userId: user.id,
    username: user.username,
    avatar: user.avatar_url
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(getJWTSecret(env));

  // Generate refresh token
  const refresh_token = generateRandomString(64);
  const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

  // Store refresh token in database
  await supabase
    .from('sessions')
    .insert({
      user_id: user.id,
      refresh_token,
      expires_at: refreshExpiresAt
    });

  return new Response(JSON.stringify({
    access_token,
    refresh_token,
    user: {
      id: user.id,
      username: user.username,
      avatar: user.avatar_url
    },
    expires_in: 900 // 15 minutes in seconds
  }), {
    headers: { 'Content-Type': 'application/json', ...cors }
  });
}

// GET /verify
async function handleVerify(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'No token provided' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...cors }
    });
  }

  const token = authHeader.substring(7);

  try {
    const { payload } = await jwtVerify(token, getJWTSecret(env));
    
    const supabase = getSupabaseClient(env);
    const { data: user } = await supabase
      .from('users')
      .select('id, username, email, avatar_url')
      .eq('id', payload.userId)
      .single();

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...cors }
      });
    }

    return new Response(JSON.stringify({
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar_url
      }
    }), {
      headers: { 'Content-Type': 'application/json', ...cors }
    });

  } catch {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...cors }
    });
  }
}

// POST /refresh
async function handleRefresh(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const { refresh_token } = await request.json();

  if (!refresh_token) {
    return new Response(JSON.stringify({ error: 'Missing refresh_token' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors }
    });
  }

  const supabase = getSupabaseClient(env);

  // Find session
  const { data: session } = await supabase
    .from('sessions')
    .select('*, user:users(*)')
    .eq('refresh_token', refresh_token)
    .single();

  if (!session) {
    return new Response(JSON.stringify({ error: 'Invalid refresh token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...cors }
    });
  }

  // Check expiration
  if (new Date(session.expires_at) < new Date()) {
    await supabase.from('sessions').delete().eq('refresh_token', refresh_token);
    return new Response(JSON.stringify({ error: 'Refresh token expired' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...cors }
    });
  }

  const user = session.user as User;

  // Generate new access token
  const access_token = await new SignJWT({
    userId: user.id,
    username: user.username,
    avatar: user.avatar_url
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(getJWTSecret(env));

  // Rotate refresh token
  const new_refresh_token = generateRandomString(64);
  const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // Delete old session, create new one
  await supabase.from('sessions').delete().eq('refresh_token', refresh_token);
  await supabase.from('sessions').insert({
    user_id: user.id,
    refresh_token: new_refresh_token,
    expires_at: refreshExpiresAt
  });

  return new Response(JSON.stringify({
    access_token,
    refresh_token: new_refresh_token,
    user: {
      id: user.id,
      username: user.username,
      avatar: user.avatar_url
    },
    expires_in: 900
  }), {
    headers: { 'Content-Type': 'application/json', ...cors }
  });
}

// POST /logout
async function handleLogout(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  // Clear session cookie
  return new Response(JSON.stringify({ success: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'session_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
      ...cors
    }
  });
}

// GET /me
async function handleMe(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const user = await getSessionFromCookie(request, env);

  if (!user) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...cors }
    });
  }

  return new Response(JSON.stringify({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar_url
    }
  }), {
    headers: { 'Content-Type': 'application/json', ...cors }
  });
}