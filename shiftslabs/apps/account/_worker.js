/**
 * Account App - SSO Hub
 * Handles authentication and user dashboard
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle static files
    if (path.startsWith('/static/') || path.includes('.')) {
      return fetch(request);
    }

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // API endpoints
    if (path === '/api/user') {
      return handleUserRequest(request, env, corsHeaders);
    }

    if (path === '/api/session') {
      return handleSessionRequest(request, env, corsHeaders);
    }

    // Check for auth code in URL (OAuth callback)
    const code = url.searchParams.get('code');
    if (code) {
      return handleOAuthCallback(request, env, url, code, corsHeaders);
    }

    // Serve the main page - will handle routing client-side
    return new Response(getHTML(), {
      headers: { 'Content-Type': 'text/html', ...corsHeaders }
    });
  }
};

async function handleUserRequest(request, env, corsHeaders) {
  if (request.method === 'GET') {
    // Get current user from session cookie
    const cookieHeader = request.headers.get('Cookie');
    let token = null;

    if (cookieHeader) {
      const cookies = Object.fromEntries(
        cookieHeader.split('; ').map(c => c.split('='))
      );
      token = cookies['session_token'];
    }

    if (!token) {
      return new Response(JSON.stringify({ authenticated: false }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Verify token with auth server
    try {
      const authUrl = env.AUTH_SERVER_URL || 'https://auth.shiftslabs.pages.dev';
      const res = await fetch(`${authUrl}/verify`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        return new Response(JSON.stringify({ authenticated: true, user: data.user }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    } catch (e) {
      console.error('Verify error:', e);
    }

    return new Response(JSON.stringify({ authenticated: false }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

async function handleSessionRequest(request, env, corsHeaders) {
  if (request.method === 'POST') {
    const { action } = await request.json();

    if (action === 'logout') {
      return new Response(JSON.stringify({ success: true }), {
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': 'session_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
          ...corsHeaders
        }
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

async function handleOAuthCallback(request, env, url, code, corsHeaders) {
  try {
    const authUrl = env.AUTH_SERVER_URL || 'https://auth.shiftslabs.pages.dev';
    
    // Exchange code for tokens
    const res = await fetch(`${authUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: 'account'
      })
    });

    if (!res.ok) {
      const error = await res.json();
      return new Response(JSON.stringify({ error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const data = await res.json();

    // Redirect to dashboard with user data
    const response = new Response(null, {
      status: 302,
      headers: {
        'Location': '/?authenticated=true',
        'Set-Cookie': `session_token=${data.access_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${15 * 60}`,
        ...corsHeaders
      }
    });

    return response;
  } catch (e) {
    console.error('OAuth callback error:', e);
    return new Response(JSON.stringify({ error: 'Authentication failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

function getHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shiftslabs Account</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚀</text></svg>">
</head>
<body class="bg-gray-900 min-h-screen">
  <div id="app">
    <!-- Loading -->
    <div class="flex items-center justify-center min-h-screen">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  </div>

  <script>
    // Auth state
    let user = null;
    let loading = true;

    // Check authentication
    async function checkAuth() {
      try {
        const res = await fetch('/api/user');
        const data = await res.json();
        
        if (data.authenticated) {
          user = data.user;
        }
      } catch (e) {
        console.error('Auth check failed:', e);
      }
      
      loading = false;
      render();
    }

    // Render app
    function render() {
      const app = document.getElementById('app');
      
      if (loading) {
        app.innerHTML = \`
          <div class="flex items-center justify-center min-h-screen">
            <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        \`;
        return;
      }

      if (!user) {
        app.innerHTML = \`
          <!-- Landing Page -->
          <div class="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
            <nav class="flex items-center justify-between px-8 py-4">
              <div class="flex items-center space-x-2">
                <span class="text-2xl">🚀</span>
                <span class="text-xl font-bold text-white">Shiftslabs</span>
              </div>
              <div class="flex items-center space-x-4">
                <a href="https://auth.shiftslabs.pages.dev/login?client_id=account&redirect_uri=https://account.shiftslabs.pages.dev" class="text-gray-300 hover:text-white">Sign In</a>
                <a href="https://auth.shiftslabs.pages.dev/register?client_id=account&redirect_uri=https://account.shiftslabs.pages.dev" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">Get Started</a>
              </div>
            </nav>

            <div class="max-w-4xl mx-auto px-8 py-20 text-center">
              <h1 class="text-5xl font-bold text-white mb-6">
                One Account, <span class="text-blue-400">50+ Apps</span>
              </h1>
              <p class="text-xl text-gray-300 mb-10">
                Welcome to Shiftslabs ecosystem. Sign in once, access everything.
              </p>
              <div class="flex justify-center space-x-4">
                <a href="https://auth.shiftslabs.pages.dev/login?client_id=account&redirect_uri=https://account.shiftslabs.pages.dev" class="bg-blue-600 hover:bg-blue-700 text-white text-lg px-8 py-3 rounded-lg font-semibold transition">
                  Sign In
                </a>
                <a href="https://auth.shiftslabs.pages.dev/register?client_id=account&redirect_uri=https://account.shiftslabs.pages.dev" class="bg-gray-700 hover:bg-gray-600 text-white text-lg px-8 py-3 rounded-lg font-semibold transition">
                  Create Account
                </a>
              </div>
            </div>

            <!-- Features -->
            <div class="max-w-6xl mx-auto px-8 py-16">
              <div class="grid md:grid-cols-3 gap-8">
                <div class="bg-gray-800 p-6 rounded-xl">
                  <div class="text-3xl mb-4">🔐</div>
                  <h3 class="text-xl font-semibold text-white mb-2">Secure SSO</h3>
                  <p class="text-gray-400">One login for all your apps. No need to remember multiple passwords.</p>
                </div>
                <div class="bg-gray-800 p-6 rounded-xl">
                  <div class="text-3xl mb-4">🚀</div>
                  <h3 class="text-xl font-semibold text-white mb-2">50+ Apps</h3>
                  <p class="text-gray-400">Access productivity, education, AI tools, and more - all in one place.</p>
                </div>
                <div class="bg-gray-800 p-6 rounded-xl">
                  <div class="text-3xl mb-4">⚡</div>
                  <h3 class="text-xl font-semibold text-white mb-2">Lightning Fast</h3>
                  <p class="text-gray-400">Built on modern infrastructure for instant access anywhere.</p>
                </div>
              </div>
            </div>

            <!-- Apps Grid -->
            <div class="max-w-6xl mx-auto px-8 py-16">
              <h2 class="text-3xl font-bold text-white mb-8 text-center">Popular Apps</h2>
              <div class="grid md:grid-cols-3 gap-6">
                <a href="https://chatbot.shiftslabs.pages.dev" class="bg-gray-800 hover:bg-gray-700 p-6 rounded-xl transition group">
                  <div class="text-4xl mb-3 group-hover:scale-110 transition">🤖</div>
                  <h3 class="text-xl font-semibold text-white mb-1">Chatbot</h3>
                  <p class="text-gray-400">AI-powered conversations</p>
                </a>
                <a href="https://learnx.shiftslabs.pages.dev" class="bg-gray-800 hover:bg-gray-700 p-6 rounded-xl transition group">
                  <div class="text-4xl mb-3 group-hover:scale-110 transition">📚</div>
                  <h3 class="text-xl font-semibold text-white mb-1">LearnX</h3>
                  <p class="text-gray-400">Interactive learning platform</p>
                </a>
                <a href="https://classroom.shiftslabs.pages.dev" class="bg-gray-800 hover:bg-gray-700 p-6 rounded-xl transition group">
                  <div class="text-4xl mb-3 group-hover:scale-110 transition">🏫</div>
                  <h3 class="text-xl font-semibold text-white mb-1">Classroom</h3>
                  <p class="text-gray-400">Online learning management</p>
                </a>
              </div>
            </div>
          </div>
        \`;
      } else {
        // Dashboard
        app.innerHTML = \`
          <!-- Dashboard -->
          <div class="min-h-screen bg-gray-900">
            <nav class="bg-gray-800 border-b border-gray-700 px-8 py-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-4">
                  <span class="text-2xl">🚀</span>
                  <span class="text-xl font-bold text-white">Shiftslabs</span>
                </div>
                <div class="flex items-center space-x-4">
                  <div class="flex items-center space-x-3">
                    <img src="\${user.avatar || 'https://api.dicebear.com/7.x/initials/svg?seed=' + user.username}" 
                         alt="Avatar" class="w-10 h-10 rounded-full">
                    <span class="text-white font-medium">\${user.username}</span>
                  </div>
                  <button id="logoutBtn" class="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition">
                    Sign Out
                  </button>
                </div>
              </div>
            </nav>

            <div class="max-w-6xl mx-auto px-8 py-10">
              <h1 class="text-3xl font-bold text-white mb-2">Welcome back, \${user.username}!</h1>
              <p class="text-gray-400 mb-8">Manage your account and access all Shiftslabs apps.</p>

              <!-- Quick Stats -->
              <div class="grid md:grid-cols-3 gap-6 mb-10">
                <div class="bg-gray-800 p-6 rounded-xl">
                  <div class="text-3xl font-bold text-blue-400">50+</div>
                  <div class="text-gray-400">Available Apps</div>
                </div>
                <div class="bg-gray-800 p-6 rounded-xl">
                  <div class="text-3xl font-bold text-green-400">0</div>
                  <div class="text-gray-400">Active Sessions</div>
                </div>
                <div class="bg-gray-800 p-6 rounded-xl">
                  <div class="text-3xl font-bold text-purple-400">Free</div>
                  <div class="text-gray-400">Plan</div>
                </div>
              </div>

              <!-- Your Apps -->
              <h2 class="text-2xl font-bold text-white mb-6">Your Apps</h2>
              <div class="grid md:grid-cols-3 gap-6">
                <a href="https://chatbot.shiftslabs.pages.dev" class="bg-gray-800 hover:bg-gray-700 p-6 rounded-xl transition group">
                  <div class="text-4xl mb-3 group-hover:scale-110 transition">🤖</div>
                  <h3 class="text-xl font-semibold text-white mb-1">Chatbot</h3>
                  <p class="text-gray-400">AI-powered conversations</p>
                </a>
                <a href="https://learnx.shiftslabs.pages.dev" class="bg-gray-800 hover:bg-gray-700 p-6 rounded-xl transition group">
                  <div class="text-4xl mb-3 group-hover:scale-110 transition">📚</div>
                  <h3 class="text-xl font-semibold text-white mb-1">LearnX</h3>
                  <p class="text-gray-400">Interactive learning platform</p>
                </a>
                <a href="https://classroom.shiftslabs.pages.dev" class="bg-gray-800 hover:bg-gray-700 p-6 rounded-xl transition group">
                  <div class="text-4xl mb-3 group-hover:scale-110 transition">🏫</div>
                  <h3 class="text-xl font-semibold text-white mb-1">Classroom</h3>
                  <p class="text-gray-400">Online learning management</p>
                </a>
              </div>

              <!-- Account Settings -->
              <h2 class="text-2xl font-bold text-white mb-6 mt-12">Account Settings</h2>
              <div class="bg-gray-800 rounded-xl p-6">
                <div class="space-y-4">
                  <div class="flex items-center justify-between py-3 border-b border-gray-700">
                    <div>
                      <div class="text-white font-medium">Email</div>
                      <div class="text-gray-400 text-sm">\${user.email}</div>
                    </div>
                  </div>
                  <div class="flex items-center justify-between py-3 border-b border-gray-700">
                    <div>
                      <div class="text-white font-medium">Username</div>
                      <div class="text-gray-400 text-sm">\${user.username}</div>
                    </div>
                  </div>
                  <div class="flex items-center justify-between py-3">
                    <div>
                      <div class="text-white font-medium">Password</div>
                      <div class="text-gray-400 text-sm">••••••••</div>
                    </div>
                    <button class="text-blue-400 hover:text-blue-300">Change</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        \`;

        // Add logout handler
        document.getElementById('logoutBtn').addEventListener('click', async () => {
          await fetch('/api/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'logout' })
          });
          window.location.href = 'https://auth.shiftslabs.pages.dev/logout';
        });
      }
    }

    // Check for auth in URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('authenticated') === 'true') {
      // Re-check auth after redirect
      checkAuth();
    } else {
      checkAuth();
    }
  </script>
</body>
</html>`;
}
