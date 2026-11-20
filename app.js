
const form = document.getElementById("chat-form");
const input = document.getElementById("message-input");
const messages = document.getElementById("chat-messages");
const sendBtn = document.getElementById("send-btn");
const newChatBtn = document.getElementById("new-chat-btn");

const imageInput = document.getElementById("image-input");
const attachBtn = document.getElementById("attach-btn");
const preview = document.getElementById("image-preview");
const previewImg = document.getElementById("preview-img");
const removeImageBtn = document.getElementById("remove-image");

let history = [];
let selectedImage = null;

function addMessage(text, type, imageUrl = null) {
  const welcome = document.getElementById("welcome");
  if (welcome) welcome.remove();

  const div = document.createElement("div");
  div.className = "message " + type;
  div.textContent = text;

  if (imageUrl) {
    const img = document.createElement("img");
    img.src = imageUrl;
    img.className = "message-image";
    img.alt = "Uploaded image";
    div.appendChild(img);
  }

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

function clearImage() {
  selectedImage = null;
  imageInput.value = "";
  preview.hidden = true;
  previewImg.removeAttribute("src");
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const maxSide = 1280;
      const scale = Math.min(
        1,
        maxSide / Math.max(img.width, img.height)
      );

      const canvas = document.createElement("canvas");

      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext("2d");

      ctx.drawImage(
        img,
        0,
        0,
        canvas.width,
        canvas.height
      );

      URL.revokeObjectURL(objectUrl);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.75);

      resolve({
        data: dataUrl.split(",")[1],
        mimeType: "image/jpeg",
        preview: dataUrl
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read this image"));
    };

    img.src = objectUrl;
  });
}

/* SELECT IMAGE */

attachBtn.addEventListener("click", () => {
  imageInput.click();
});

imageInput.addEventListener("change", async () => {
  const file = imageInput.files[0];

  if (!file) return;

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  if (!allowedTypes.includes(file.type)) {
    alert("Choose a JPG, PNG or WEBP image.");
    clearImage();
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    alert("Image is too large. Choose an image under 10 MB.");
    clearImage();
    return;
  }

  try {
    attachBtn.disabled = true;

    selectedImage = await compressImage(file);

    previewImg.src = selectedImage.preview;
    preview.hidden = false;

  } catch (error) {
    alert("Could not load this image.");
    clearImage();

  } finally {
    attachBtn.disabled = false;
  }
});

/* REMOVE IMAGE */

removeImageBtn.addEventListener("click", clearImage);

/* SEND MESSAGE */

async function sendMessage() {
  const text = input.value.trim();

  if ((!text && !selectedImage) || sendBtn.disabled) {
    return;
  }

  const messageText = text || "Please analyze this image.";
  const imageToSend = selectedImage;

  addMessage(
    messageText,
    "user",
    imageToSend ? imageToSend.preview : null
  );

  input.value = "";
  input.style.height = "auto";

  clearImage();

  input.disabled = true;
  sendBtn.disabled = true;
  attachBtn.disabled = true;

  const loading = addMessage("Thinking...", "assistant");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: messageText,
        history: history,
        image: imageToSend
          ? {
              data: imageToSend.data,
              mimeType: imageToSend.mimeType
            }
          : null
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
      { role: "user", content: messageText },
      { role: "assistant", content: data.reply }
    );

  } catch (error) {
    loading.textContent = "Connection error: " + error.message;

  } finally {
    input.disabled = false;
    sendBtn.disabled = false;
    attachBtn.disabled = false;

    input.focus();
    messages.scrollTop = messages.scrollHeight;
  }
}

form.addEventListener("submit", event => {
  event.preventDefault();
  sendMessage();
});

/* TEXTAREA SIZE */

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height =
    Math.min(input.scrollHeight, 150) + "px";
});

input.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

/* NEW CHAT */

newChatBtn.addEventListener("click", () => {
  history = [];

  clearImage();

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
          <div>
            <strong>Learn something</strong>
            <small>Understand difficult concepts</small>
          </div>
        </button>

        <button type="button" class="suggestion"
          data-prompt="Help me solve a mathematics problem step by step.">
          <span>∑</span>
          <div>
            <strong>Mathematics</strong>
            <small>Equations and calculations</small>
          </div>
        </button>

        <button type="button" class="suggestion"
          data-prompt="Give me creative ideas for a new project.">
          <span>✧</span>
          <div>
            <strong>Explore ideas</strong>
            <small>Discover new possibilities</small>
          </div>
        </button>

        <button type="button" class="suggestion"
          data-prompt="Help me write and improve some code.">
          <span>⌘</span>
          <div>
            <strong>Write code</strong>
            <small>Build and improve projects</small>
          </div>
        </button>

      </div>
    </div>
  `;

  input.value = "";
  input.style.height = "auto";
  input.focus();
});

/* SUGGESTIONS */

messages.addEventListener("click", event => {
  const suggestion = event.target.closest(".suggestion");

  if (!suggestion) return;

  input.value = suggestion.dataset.prompt;
  input.focus();

  input.style.height = "auto";
  input.style.height =
    Math.min(input.scrollHeight, 150) + "px";
});
