
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#080b12">
  <title>MY AI — Intelligent Assistant</title>
  <link rel="stylesheet" href="/style.css">

  <script>
    window.MathJax = {
      tex: {
        inlineMath: [['$', '$'], ['\\(', '\\)']],
        displayMath: [['$$', '$$'], ['\\[', '\\]']]
      },
      svg: { fontCache: 'global' },
      startup: { typeset: false }
    };
  </script>
  <script defer src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>

  <style>
    .account-area {
      display:flex; align-items:center; justify-content:flex-end;
      gap:9px; flex-wrap:wrap; margin-left:auto; font-size:12px;
    }
    #credits-display {
      color:#a5c8ff; background:#14243a; border:1px solid #263d5c;
      padding:8px 12px; border-radius:20px; white-space:nowrap;
    }
    #google-login,#google-logout {
      background:#202b3c; color:#fff; border:1px solid #35445b;
      border-radius:9px; padding:9px 12px; cursor:pointer; font:inherit;
    }
    #google-login:hover,#google-logout:hover { background:#2b3b52; }
    #google-login:disabled,#google-logout:disabled { opacity:.6; cursor:wait; }
    #account-email {
      color:#aab5c7; max-width:150px; overflow:hidden;
      text-overflow:ellipsis; white-space:nowrap;
    }
    #google-login[hidden],#google-logout[hidden] { display:none; }

    .voice-panel {
      display:grid; grid-template-columns:repeat(2,minmax(0,1fr));
      gap:9px; margin-bottom:10px; padding:12px;
      background:#101827; border:1px solid #26364d; border-radius:13px;
    }
    .voice-field { display:flex; flex-direction:column; gap:6px; min-width:0; }
    .voice-field label { color:#aebbd0; font-size:12px; }
    .voice-field select {
      width:100%; min-width:0; padding:10px;
      color:#eef4ff; background:#182438;
      border:1px solid #344763; border-radius:9px;
      font:inherit; font-size:13px;
    }
    .voice-actions {
      display:flex; align-items:center; gap:8px;
      flex-wrap:wrap; grid-column:1/-1;
    }
    .voice-controls {
      display:flex; align-items:center; gap:7px;
      margin-bottom:9px; flex-wrap:wrap;
    }
    .voice-btn {
      background:#17243a; color:#eaf2ff; border:1px solid #304361;
      border-radius:10px; padding:9px 13px; cursor:pointer;
      font-size:13px; transition:.2s;
    }
    .voice-btn:hover { background:#243a59; }
    .voice-btn.active { background:#174c40; border-color:#2c9b78; }
    .voice-btn.listening {
      background:#662b37; border-color:#d45a70;
      animation:voicePulse 1.2s infinite;
    }
    .voice-btn:disabled { opacity:.5; cursor:not-allowed; }
    #voice-status { color:#91a0b8; font-size:12px; min-height:17px; }
    @keyframes voicePulse {
      50% { box-shadow:0 0 0 5px rgba(212,90,112,.12); }
    }
    @media(max-width:600px) {
      .topbar { flex-wrap:wrap; gap:10px; }
      .account-area {
        width:100%; justify-content:flex-start; margin-left:0;
      }
      #account-email { display:none; }
      .voice-panel { grid-template-columns:1fr; }
    }
  </style>
</head>

<body>
<div class="app">
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-icon">M</div>
      <span>MY AI</span>
    </div>

    <button id="new-chat-btn" class="new-chat-btn">
      <span class="plus">＋</span>
      <span>New Chat</span>
    </button>

    <div class="sidebar-label">YOUR ASSISTANT</div>
    <div class="sidebar-info">
      <span class="status-dot"></span>
      MY AI Assistant
    </div>

    <div class="sidebar-footer">
      <span class="footer-icon">⎈</span>
      <span>Powered by AI</span>
    </div>
  </aside>

  <main class="main">
    <header class="topbar">
      <div class="mobile-brand">
        <div class="brand-icon">M</div>
        <span>MY AI</span>
      </div>

      <div class="online-status">
        <span class="status-dot"></span>
        AI Assistant
      </div>

      <div class="account-area">
        <span id="credits-display">Credits: --</span>
        <button id="google-login" type="button">Sign in with Google</button>
        <button id="google-logout" type="button" hidden>Sign out</button>
        <span id="account-email"></span>
      </div>
    </header>

    <section id="chat-messages" class="chat-messages">
      <div class="welcome" id="welcome">
        <div class="welcome-icon">⎈</div>
        <div class="welcome-tag">YOUR PERSONAL AI</div>
        <h1>What can I help you with?</h1>
        <p>Ask questions, explore ideas, or learn something new.</p>

        <div class="suggestions">
          <button type="button" class="suggestion"
            data-prompt="Explain a difficult scientific concept simply.">
            <span>◈</span>
            <div><strong>Learn something</strong><small>Understand difficult concepts</small></div>
          </button>

          <button type="button" class="suggestion"
            data-prompt="Help me solve a mathematics problem step by step.">
            <span>∑</span>
            <div><strong>Mathematics</strong><small>Equations and calculations</small></div>
          </button>

          <button type="button" class="suggestion"
            data-prompt="Give me creative ideas for a new project.">
            <span>✧</span>
            <div><strong>Explore ideas</strong><small>Discover new possibilities</small></div>
          </button>

          <button type="button" class="suggestion"
            data-prompt="Help me write and improve some code.">
            <span>⌘</span>
            <div><strong>Write code</strong><small>Build and improve projects</small></div>
          </button>
        </div>
      </div>
    </section>

    <footer class="composer-area">
      <div class="voice-panel">
        <div class="voice-field">
          <label for="voice-language">🌍 Language / اللغة</label>
          <select id="voice-language">
            <option value="auto">Auto — تلقائي</option>
            <option value="darija">🇲🇦 الدارجة المغربية</option>
            <option value="ar">العربية الفصحى</option>
            <option value="en">🇬🇧 English</option>
            <option value="fr">🇫🇷 Français</option>
            <option value="es">🇪🇸 Español</option>
          </select>
        </div>

        <div class="voice-field">
          <label for="voice-choice">🔊 Voice / الصوت</label>
          <select id="voice-choice">
            <option value="">Loading voices...</option>
          </select>
        </div>

        <div class="voice-actions">
          <button type="button" id="preview-voice-btn" class="voice-btn">
            ▶ Try voice
          </button>
          <span style="color:#91a0b8;font-size:11px">
            Voices depend on your device.
          </span>
        </div>
      </div>

      <div class="voice-controls">
        <button type="button" id="voice-input-btn" class="voice-btn">
          🎙️ Speak
        </button>
        <button type="button" id="voice-output-btn" class="voice-btn">
          🔊 Voice off
        </button>
        <button type="button" id="stop-voice-btn" class="voice-btn" hidden>
          ⏹ Stop
        </button>
        <span id="voice-status" aria-live="polite"></span>
      </div>

      <form id="chat-form" class="composer">
        <div id="image-preview" class="image-preview" hidden>
          <img id="preview-img" alt="Selected image">
          <button type="button" id="remove-image" aria-label="Remove image">×</button>
        </div>

        <input type="file" id="image-input"
          accept="image/jpeg,image/png,image/webp" hidden>

        <button type="button" id="attach-btn" class="attach-btn"
          title="Attach image" aria-label="Attach image">📎</button>

        <textarea id="message-input" placeholder="Message MY AI..."
          rows="1" aria-label="Write your message"></textarea>

        <button type="submit" id="send-btn" aria-label="Send message">↑</button>
      </form>

      <p class="disclaimer">
        MY AI can make mistakes. Verify important information.
      </p>
    </footer>
  </main>
</div>

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="/app.js"></script>
</body>
</html>
