
const API_URL = "/api/chat";

const form = document.getElementById("chat-form");
const input = document.getElementById("message-input");
const messages = document.getElementById("chat-messages");
const newChatBtn = document.getElementById("new-chat-btn");
const sendBtn = document.getElementById("send-btn");

let history = [];

function addMessage(text, type) {
  const welcome = document.getElementById("welcome");
  if (welcome) welcome.remove();

  const message = document.createElement("div");
  message.className = "message " + type;
  message.textContent = text;
  messages.appendChild(message);
  messages.scrollTop = messages.scrollHeight;

  return message;
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
    const response = await fetch(API_URL, {
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
      throw new Error(data.error || "Connection error");
    }

    const reply = data.reply || data.text || "No response received.";
    loading.textContent = reply;

    history.push(
      { role: "user", content: text },
      { role: "assistant", content: reply }
    );

  } catch (error) {
    loading.textContent = "Error: " + error.message;
  } finally {
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
  }
});

newChatBtn.addEventListener("click", () => {
  history = [];
  messages.innerHTML = `
    <div class="welcome" id="welcome">
      <h1>What can I help you with?</h1>
      <p>Ask anything. Let's get started.</p>
    </div>
  `;
});

document.getElementById("image-btn").addEventListener("click", () => {
  addMessage("Image Generator is coming soon.", "assistant");
});

document.getElementById("video-btn").addEventListener("click", () => {
  addMessage("Video Generator is coming soon.", "assistant");
});
