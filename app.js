
const form = document.getElementById("chat-form");
const input = document.getElementById("message-input");
const messages = document.getElementById("chat-messages");
const sendBtn = document.getElementById("send-btn");
const newChatBtn = document.getElementById("new-chat-btn");

let history = [];

function addMessage(text, type) {
  const welcome = document.getElementById("welcome");
  if (welcome) welcome.remove();

  const div = document.createElement("div");
  div.className = "message " + type;
  div.textContent = text;

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;

  return div;
}

async function renderMath(element) {
  if (!window.MathJax) return;

  try {
    await window.MathJax.startup.promise;
    await window.MathJax.typesetPromise([element]);
  } catch (error) {
    console.error("MathJax error:", error);
  }
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text || sendBtn.disabled) return;

  addMessage(text, "user");

  input.value = "";
  input.style.height = "auto";

  input.disabled = true;
  sendBtn.disabled = true;

  const loading = addMessage("Thinking...", "assistant");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: text,
        history: history
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Server error");
    }

    if (!data.reply) {
      throw new Error("Empty response");
    }

    loading.textContent = data.reply;

    await renderMath(loading);

    history.push(
      { role: "user", content: text },
      { role: "assistant", content: data.reply }
    );

  } catch (error) {
    loading.textContent = "Connection error: " + error.message;
  } finally {
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
    messages.scrollTop = messages.scrollHeight;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage();
});

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 150) + "px";
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

newChatBtn.addEventListener("click", () => {
  history = [];

  messages.innerHTML = `
    <div class="welcome" id="welcome">
      <div class="welcome-icon">✦</div>
      <div class="welcome-tag">YOUR PERSONAL AI</div>
      <h1>What can I help you with?</h1>
      <p>Ask questions, explore ideas, or learn something new.</p>

      <div class="suggestions">
        <button type="button" class="suggestion"
          data-prompt="Explain a difficult scientific concept simply.">
          <span>◈</span>
          <div><strong>Learn something</strong>
          <small>Understand difficult concepts</small></div>
        </button>

        <button type="button" class="suggestion"
          data-prompt="Help me solve a mathematics problem step by step.">
          <span>∑</span>
          <div><strong>Mathematics</strong>
          <small>Equations and calculations</small></div>
        </button>

        <button type="button" class="suggestion"
          data-prompt="Give me creative ideas for a new project.">
          <span>✧</span>
          <div><strong>Explore ideas</strong>
          <small>Discover new possibilities</small></div>
        </button>

        <button type="button" class="suggestion"
          data-prompt="Help me write and improve some code.">
          <span>⌘</span>
          <div><strong>Write code</strong>
          <small>Build and improve projects</small></div>
        </button>
      </div>
    </div>
  `;

  input.value = "";
  input.style.height = "auto";
  input.focus();
});

messages.addEventListener("click", (event) => {
  const suggestion = event.target.closest(".suggestion");
  if (!suggestion) return;

  input.value = suggestion.dataset.prompt;
  input.focus();
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 150) + "px";
});
