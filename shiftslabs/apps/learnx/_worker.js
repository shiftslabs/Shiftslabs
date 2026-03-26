/**
 * LearnX - Interactive Learning Platform
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Handle auth code in URL (OAuth callback)
    const code = url.searchParams.get('code');
    if (code) {
      return handleOAuthCallback(request, env, url, code, corsHeaders);
    }

    // Serve the main page
    return new Response(getHTML(), {
      headers: { 'Content-Type': 'text/html', ...corsHeaders }
    });
  }
};

async function handleOAuthCallback(request, env, url, code, corsHeaders) {
  try {
    const authUrl = env.AUTH_SERVER_URL || 'https://auth.shiftslabs.pages.dev';
    
    const res = await fetch(`${authUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: 'learnx'
      })
    });

    if (!res.ok) {
      return new Response('Authentication failed', { status: 400 });
    }

    const data = await res.json();

    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/?authenticated=true',
        'Set-Cookie': `session_token=${data.access_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${15 * 60}`,
        ...corsHeaders
      }
    });
  } catch (e) {
    return new Response('Authentication failed', { status: 500 });
  }
}

function getHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LearnX - Interactive Learning</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📚</text></svg>">
  <style>
    .course-card:hover { transform: translateY(-4px); }
    .lesson-item.active { border-left-color: #3b82f6; background: #1e293b; }
  </style>
</head>
<body class="bg-gray-900 min-h-screen">
  <div id="app">
    <div class="flex items-center justify-center min-h-screen">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  </div>

  <script>
    let user = null;
    let loading = true;
    let currentView = 'home';
    let selectedCourse = null;
    let currentLesson = null;
    let userProgress = {};

    // Sample courses data
    const courses = [
      {
        id: 'web-dev',
        title: 'Web Development Fundamentals',
        description: 'Learn HTML, CSS, and JavaScript from scratch',
        icon: '🌐',
        color: 'blue',
        lessons: [
          { id: 'html-intro', title: 'Introduction to HTML', content: '<h2>Welcome to HTML!</h2><p>HTML (HyperText Markup Language) is the foundation of every webpage. It provides the structural content that browsers display.</p><h3>Key Concepts:</h3><ul><li>Document Structure</li><li>Headings and Paragraphs</li><li>Links and Images</li><li>Lists and Tables</li></ul><p>HTML uses tags to define elements. Most tags come in pairs - an opening tag and a closing tag.</p><pre><code><html>\n  <head>\n    <title>My Page</title>\n  </head>\n  <body>\n    <h1>Hello World!</h1>\n  </body>\n</html></code></pre>' },
          { id: 'css-basics', title: 'CSS Styling Basics', content: '<h2>CSS - Making it Beautiful!</h2><p>CSS (Cascading Style Sheets) controls how HTML elements look on the screen.</p><h3>Selectors:</h3><p>You can select elements by tag, class, or ID:</p><pre><code>/* By tag */\np { color: blue; }\n/* By class */\n.highlight { background: yellow; }\n/* By ID */\n#header { height: 100px; }</code></pre><h3>Properties:</h3><ul><li>color, background-color</li><li>font-size, font-weight</li><li>margin, padding</li><li>display, position</li></ul>' },
          { id: 'js-intro', title: 'JavaScript Essentials', content: '<h2>JavaScript - Adding Interactivity!</h2><p>JavaScript makes webpages interactive and dynamic.</p><h3>Variables:</h3><pre><code>let name = "John";\nconst PI = 3.14;\nvar oldWay = "deprecated";</code></pre><h3>Functions:</h3><pre><code>function greet(name) {\n  return "Hello, " + name + "!";\n}\n\n// Arrow function\nconst add = (a, b) => a + b;</code></pre><h3>DOM Manipulation:</h3><pre><code>document.getElementById("myDiv")\n  .innerHTML = "New content";</code></pre>' }
        ]
      },
      {
        id: 'python',
        title: 'Python Programming',
        description: 'Master Python for data science and automation',
        icon: '🐍',
        color: 'green',
        lessons: [
          { id: 'py-intro', title: 'Getting Started with Python', content: '<h2>Welcome to Python!</h2><p>Python is a versatile, beginner-friendly programming language.</p><h3>Hello World:</h3><pre><code>print("Hello, World!")</code></pre><h3>Variables:</h3><pre><code>name = "Alice"  # string\nage = 25       # integer\nprice = 19.99  # float\nis_active = True  # boolean</code></pre><h3>Lists:</h3><pre><code>fruits = ["apple", "banana", "cherry"]\nprint(fruits[0])  # apple</code></pre>' },
          { id: 'py-functions', title: 'Functions & Modules', content: '<h2>Functions in Python</h2><p>Functions help organize code into reusable blocks.</p><pre><code>def greet(name):\n    return f"Hello, {name}!"\n\n# Default parameters\ndef power(base, exp=2):\n    return base ** exp</code></pre><h3>Modules:</h3><pre><code>import math\nprint(math.sqrt(16))  # 4.0\n\nfrom datetime import datetime\nprint(datetime.now())</code></pre>' }
        ]
      },
      {
        id: 'ai-ml',
        title: 'AI & Machine Learning',
        description: 'Explore artificial intelligence and neural networks',
        icon: '🤖',
        color: 'purple',
        lessons: [
          { id: 'ai-intro', title: 'Introduction to AI', content: '<h2>What is Artificial Intelligence?</h2><p>AI enables machines to learn from experience and perform human-like tasks.</p><h3>Types of AI:</h3><ul><li><strong>Narrow AI</strong> - Designed for specific tasks</li><li><strong>General AI</strong> - Human-level intelligence</li><li><strong>Superintelligent AI</strong> - Surpassing human intelligence</li></ul><h3>Key Concepts:</h3><ul><li>Machine Learning</li><li>Neural Networks</li><li>Deep Learning</li><li>Natural Language Processing</li></ul>' },
          { id: 'ml-basics', title: 'Machine Learning Basics', content: '<h2>Machine Learning Fundamentals</h2><p>ML algorithms learn patterns from data without being explicitly programmed.</p><h3>Types of Learning:</h3><ul><li><strong>Supervised Learning</strong> - Learning from labeled data</li><li><strong>Unsupervised Learning</strong> - Finding patterns in unlabeled data</li><li><strong>Reinforcement Learning</strong> - Learning through rewards</li></ul><h3>Common Algorithms:</h3><ul><li>Linear Regression</li><li>Decision Trees</li><li>Random Forests</li><li>Neural Networks</li></ul>' }
        ]
      },
      {
        id: 'design',
        title: 'UI/UX Design',
        description: 'Create beautiful and user-friendly interfaces',
        icon: '🎨',
        color: 'pink',
        lessons: [
          { id: 'design-principles', title: 'Design Principles', content: '<h2>Core Design Principles</h2><h3>1. Contrast</h3><p>Use contrasting colors, sizes, and shapes to create visual interest.</p><h3>2. Alignment</h3><p>Keep elements aligned to create a cohesive look.</p><h3>3. Repetition</h3><p>Repeat colors, fonts, and styles for consistency.</p><h3>4. Proximity</h3><p>Group related elements together.</p>' },
          { id: 'color-theory', title: 'Color Theory', content: '<h2>Understanding Colors</h2><h3>Color Wheel:</h3><ul><li><strong>Primary:</strong> Red, Blue, Yellow</li><li><strong>Secondary:</strong> Orange, Green, Purple</li><li><strong>Tertiary:</strong> Mixes of primary and secondary</li></ul><h3>Color Schemes:</h3><ul><li><strong>Complementary:</strong> Opposite on the wheel</li><li><strong>Analogous:</strong> Adjacent colors</li><li><strong>Triadic:</strong> Three colors equally spaced</li></ul>' }
        ]
      }
    ];

    // Get current page from URL hash
    function getPageFromHash() {
      const hash = window.location.hash.slice(1);
      if (hash.startsWith('course-')) {
        const courseId = hash.replace('course-', '');
        return { view: 'course', courseId };
      }
      if (hash.startsWith('lesson-')) {
        const lessonId = hash.replace('lesson-', '');
        return { view: 'lesson', lessonId };
      }
      return { view: 'home' };
    }

    async function checkAuth() {
      try {
        const res = await fetch('https://auth.shiftslabs.pages.dev/me', {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          user = data.user;
        }
      } catch (e) {
        console.log('Not authenticated');
      }
      loading = false;
      
      const page = getPageFromHash();
      if (page.view === 'course') {
        currentView = 'course';
        selectedCourse = courses.find(c => c.id === page.courseId);
      } else if (page.view === 'lesson') {
        currentView = 'lesson';
        const lessonId = page.lessonId;
        for (const course of courses) {
          const lesson = course.lessons.find(l => l.id === lessonId);
          if (lesson) {
            selectedCourse = course;
            currentLesson = lesson;
            break;
          }
        }
      }
      
      render();
    }

    function render() {
      const app = document.getElementById('app');
      
      if (loading) {
        app.innerHTML = '<div class="flex items-center justify-center min-h-screen"><div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div></div>';
        return;
      }

      if (!user) {
        app.innerHTML = getLoginPage();
      } else if (currentView === 'lesson') {
        app.innerHTML = getLessonPage();
      } else if (currentView === 'course') {
        app.innerHTML = getCoursePage();
      } else {
        app.innerHTML = getHomePage();
      }
    }

    function getLoginPage() {
      const authUrl = 'https://auth.shiftslabs.pages.dev/authorize?client_id=learnx&redirect_uri=https://learnx.shiftslabs.pages.dev&scope=read:profile';
      return \`
        <div class="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-4">
          <div class="max-w-md w-full">
            <div class="text-center mb-8">
              <span class="text-6xl">📚</span>
              <h1 class="text-4xl font-bold text-white mt-4">LearnX</h1>
              <p class="text-gray-400 mt-2">Interactive Learning Platform</p>
            </div>
            <div class="bg-gray-800 p-8 rounded-2xl shadow-xl">
              <h2 class="text-2xl font-bold text-white mb-6 text-center">Welcome to LearnX</h2>
              <p class="text-gray-400 mb-6 text-center">Sign in to track your progress and access courses.</p>
              <a href="\${authUrl}" class="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center py-3 rounded-lg font-semibold transition">
                Sign In with Shiftslabs
              </a>
            </div>
          </div>
        </div>
      \`;
    }

    function getHomePage() {
      return \`
        <div class="min-h-screen bg-gray-900">
          <!-- Header -->
          <header class="bg-gray-800 border-b border-gray-700">
            <div class="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
              <a href="#/" class="flex items-center space-x-3">
                <span class="text-3xl">📚</span>
                <span class="text-2xl font-bold text-white">LearnX</span>
              </a>
              <div class="flex items-center space-x-4">
                <span class="text-gray-400">Welcome, \${user.username}</span>
                <img src="\${user.avatar || 'https://api.dicebear.com/7.x/initials/svg?seed=' + user.username}" 
                     class="w-10 h-10 rounded-full">
                <a href="https://account.shiftslabs.pages.dev" class="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition">
                  Account
                </a>
              </div>
            </div>
          </header>

          <!-- Hero -->
          <section class="bg-gradient-to-r from-blue-900 to-purple-900 py-16">
            <div class="max-w-7xl mx-auto px-4 text-center">
              <h1 class="text-4xl font-bold text-white mb-4">Learn Anything, Anytime</h1>
              <p class="text-xl text-gray-300 max-w-2xl mx-auto">Master new skills with interactive courses, quizzes, and hands-on projects.</p>
            </div>
          </section>

          <!-- Courses -->
          <main class="max-w-7xl mx-auto px-4 py-12">
            <h2 class="text-3xl font-bold text-white mb-8">Available Courses</h2>
            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              \${courses.map(course => \`
                <a href="#course-\${course.id}" onclick="viewCourse('\${course.id}')" 
                   class="course-card bg-gray-800 rounded-xl p-6 transition-all duration-300 hover:shadow-2xl border border-gray-700">
                  <div class="text-4xl mb-4">\${course.icon}</div>
                  <h3 class="text-xl font-semibold text-white mb-2">\${course.title}</h3>
                  <p class="text-gray-400 mb-4">\${course.description}</p>
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-500">\${course.lessons.length} lessons</span>
                    <span class="text-blue-400">Start Learning →</span>
                  </div>
                </a>
              \`).join('')}
            </div>
          </main>

          <!-- Footer -->
          <footer class="bg-gray-800 border-t border-gray-700 py-8 mt-12">
            <div class="max-w-7xl mx-auto px-4 text-center text-gray-400">
              <p>© 2026 LearnX - Part of Shiftslabs Ecosystem</p>
            </div>
          </footer>
        </div>
      \`;
    }

    function viewCourse(courseId) {
      selectedCourse = courses.find(c => c.id === courseId);
      currentView = 'course';
      render();
    }

    function getCoursePage() {
      if (!selectedCourse) {
        window.location.hash = '/';
        return getHomePage();
      }

      const completedLessons = userProgress[selectedCourse.id] || [];
      
      return \`
        <div class="min-h-screen bg-gray-900">
          <!-- Header -->
          <header class="bg-gray-800 border-b border-gray-700">
            <div class="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
              <div class="flex items-center space-x-4">
                <a href="#/" class="text-3xl">📚</a>
                <span class="text-2xl font-bold text-white">LearnX</span>
                <span class="text-gray-500">/</span>
                <span class="text-xl text-white">\${selectedCourse.title}</span>
              </div>
              <div class="flex items-center space-x-4">
                <img src="\${user.avatar || 'https://api.dicebear.com/7.x/initials/svg?seed=' + user.username}" 
                     class="w-10 h-10 rounded-full">
              </div>
            </div>
          </header>

          <!-- Course Content -->
          <div class="max-w-7xl mx-auto px-4 py-8 flex gap-8">
            <!-- Sidebar -->
            <aside class="w-80 flex-shrink-0">
              <div class="bg-gray-800 rounded-xl p-6 sticky top-8">
                <div class="text-4xl mb-4">\${selectedCourse.icon}</div>
                <h2 class="text-xl font-bold text-white mb-2">\${selectedCourse.title}</h2>
                <p class="text-gray-400 text-sm mb-4">\${selectedCourse.description}</p>
                <div class="mb-4">
                  <div class="flex justify-between text-sm text-gray-400 mb-1">
                    <span>Progress</span>
                    <span>\${completedLessons.length}/\${selectedCourse.lessons.length}</span>
                  </div>
                  <div class="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div class="h-full bg-blue-500 transition-all" style="width: \${(completedLessons.length / selectedCourse.lessons.length) * 100}%"></div>
                  </div>
                </div>
                <a href="#/" class="block text-center text-blue-400 hover:text-blue-300 mt-4">← Back to Courses</a>
              </div>
            </aside>

            <!-- Lessons -->
            <main class="flex-1">
              <h3 class="text-xl font-semibold text-white mb-6">Course Lessons</h3>
              <div class="space-y-3">
                \${selectedCourse.lessons.map((lesson, index) => {
                  const isCompleted = completedLessons.includes(lesson.id);
                  const isActive = currentLesson && currentLesson.id === lesson.id;
                  return \`
                    <a href="#lesson-\${lesson.id}" onclick="viewLesson('\${selectedCourse.id}', '\${lesson.id}')"
                       class="lesson-item block bg-gray-800 p-4 rounded-lg border-l-4 transition \${isActive ? 'active' : 'border-gray-700 hover:border-gray-600'}">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-4">
                          <span class="w-8 h-8 rounded-full \${isCompleted ? 'bg-green-600' : 'bg-gray-700'} flex items-center justify-center text-white text-sm">
                            \${isCompleted ? '✓' : index + 1}
                          </span>
                          <span class="text-white font-medium">\${lesson.title}</span>
                        </div>
                        <span class="text-gray-500 text-sm">→</span>
                      </div>
                    </a>
                  \`;
                }).join('')}
              </div>
            </main>
          </div>
        </div>
      \`;
    }

    function viewLesson(courseId, lessonId) {
      selectedCourse = courses.find(c => c.id === courseId);
      currentLesson = selectedCourse.lessons.find(l => l.id === lessonId);
      currentView = 'lesson';
      render();
      window.scrollTo(0, 0);
    }

    function getLessonPage() {
      if (!selectedCourse || !currentLesson) {
        window.location.hash = '/';
        return getHomePage();
      }

      const completedLessons = userProgress[selectedCourse.id] || [];
      const isCompleted = completedLessons.includes(currentLesson.id);
      const currentIndex = selectedCourse.lessons.findIndex(l => l.id === currentLesson.id);
      const prevLesson = selectedCourse.lessons[currentIndex - 1];
      const nextLesson = selectedCourse.lessons[currentIndex + 1];

      return \`
        <div class="min-h-screen bg-gray-900">
          <!-- Header -->
          <header class="bg-gray-800 border-b border-gray-700">
            <div class="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
              <div class="flex items-center space-x-4">
                <a href="#course-\${selectedCourse.id}" onclick="viewCourse('\${selectedCourse.id}')" class="text-3xl">📚</a>
                <span class="text-2xl font-bold text-white">LearnX</span>
                <span class="text-gray-500">/</span>
                <a href="#course-\${selectedCourse.id}" onclick="viewCourse('\${selectedCourse.id}')" class="text-white hover:text-blue-400">\${selectedCourse.title}</a>
                <span class="text-gray-500">/</span>
                <span class="text-white">\${currentLesson.title}</span>
              </div>
              <div class="flex items-center space-x-4">
                <span class="text-gray-400">\${currentIndex + 1} of \${selectedCourse.lessons.length}</span>
                <img src="\${user.avatar || 'https://api.dicebear.com/7.x/initials/svg?seed=' + user.username}" 
                     class="w-10 h-10 rounded-full">
              </div>
            </div>
          </header>

          <!-- Lesson Content -->
          <div class="max-w-4xl mx-auto px-4 py-12">
            <article class="bg-gray-800 rounded-xl p-8">
              <div class="prose prose-invert max-w-none">
                \${currentLesson.content}
              </div>
              
              <!-- Actions -->
              <div class="mt-12 pt-8 border-t border-gray-700 flex justify-between">
                \${prevLesson ? \`
                  <a href="#lesson-\${prevLesson.id}" onclick="viewLesson('\${selectedCourse.id}', '\${prevLesson.id}')"
                     class="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg transition">
                    ← Previous
                  </a>
                \` : '<div></div>'}
                
                \${!isCompleted ? \`
                  <button onclick="markComplete('\${currentLesson.id}')"
                          class="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition">
                    Mark as Complete ✓
                  </button>
                \` : \`
                  \${nextLesson ? \`
                    <a href="#lesson-\${nextLesson.id}" onclick="viewLesson('\${selectedCourse.id}', '\${nextLesson.id}')"
                       class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition">
                      Next Lesson →
                    </a>
                  \` : ''}
                \`}
              </div>
            </article>
          </div>
        </div>
      \`;
    }

    function markComplete(lessonId) {
      if (!userProgress[selectedCourse.id]) {
        userProgress[selectedCourse.id] = [];
      }
      if (!userProgress[selectedCourse.id].includes(lessonId)) {
        userProgress[selectedCourse.id].push(lessonId);
      }
      render();
    }

    // Initialize
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('authenticated') === 'true') {
      checkAuth();
    } else {
      checkAuth();
    }
  </script>
</body>
</html>`;
}
