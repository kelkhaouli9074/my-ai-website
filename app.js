

const form = document.getElementById("chat-form");
const input = document.getElementById("message-input");
const messages = document.getElementById("chat-messages");
const sendBtn = document.getElementById("send-btn");

let history = [];

function addMessage(text, type) {
  const welcome = document.getElementById("welcome");
  if (welcome) welcome.remove();

  const div = document.createElement("div");
  div.className = "message " + type;

  // Keep user messages as plain text.
  div.textContent = text;

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;

  return div;
}

async function renderMath(element) {
  if (window.MathJax && window.MathJax.typesetPromise) {
    try {
      await window.MathJax.typesetPromise([element]);
    } catch (error) {
      console.error("MathJax error:", error);
    }
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const text = input.value.trim();
  if (!text) return;

  addMessage(text, "user");

  input.value = "";
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

    // Render AI response as text first.
    loading.textContent = data.reply;

    // Format mathematical equations.
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
  }
});

document.getElementById("new-chat-btn").addEventListener("click", () => {
  history = [];

  messages.innerHTML = `
    <div class="welcome" id="welcome">
      <h1>What can I help you with?</h1>
      <p>Ask anything. Let's get started.</p>
    </div>
  `;
});
