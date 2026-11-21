
"use strict";

/* =========================================
   MY AI — COMPLETE APP.JS
   Fixed History UI + Chat + Supabase
========================================= */

(() => {
  console.info("MY AI: app.js loaded successfully.");

  function initializeMYAI() {
    if (window.__MY_AI_INITIALIZED__) return;
    window.__MY_AI_INITIALIZED__ = true;

    const $ = id => document.getElementById(id);

    const SUPABASE_URL =
      "https://qxmmrlbhgmuhpityezvh.supabase.co";

    const SUPABASE_KEY =
      "sb_publishable_a2bgpHM81IQK21ewBAtJsQ_gk2Y6uMK";

    const DB_NAME = "MY_AI_LOCAL_DATABASE";
    const DB_VERSION = 1;
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

    const elements = {
      form: $("chat-form"),
      input: $("message-input"),
      messages: $("chat-messages"),
      send: $("send-btn"),
      newChat: $("new-chat-btn"),
      sidebar: $("main-sidebar"),
      overlay: $("sidebar-overlay"),
      openSidebar: $("open-sidebar"),
      closeSidebar: $("close-sidebar"),
      login: $("google-login"),
      logout: $("google-logout"),
      email: $("account-email"),
      sidebarEmail: $("sidebar-account-email"),
      credits: $("credits-display"),
      imageInput: $("image-input"),
      attach: $("attach-btn"),
      imagePreview: $("image-preview"),
      previewImg: $("preview-img"),
      removeImage: $("remove-image"),
      voiceInput: $("voice-input-btn"),
      voiceOutput: $("voice-output-btn"),
      stopVoice: $("stop-voice-btn"),
      voiceToggle: $("voice-settings-toggle"),
      voicePanel: $("voice-settings-panel"),
      voiceLanguage: $("voice-language"),
      voiceChoice: $("voice-choice"),
      previewVoice: $("preview-voice-btn"),
      voiceStatus: $("voice-status"),
      settings: $("open-settings"),
      about: $("open-about"),
      aboutModal: $("about-modal"),
      closeAbout: $("close-about")
    };

    let supabase = null;
    let currentSession = null;
    let activeConversation = null;
    let pendingImage = null;
    let isSending = false;
    let recognition = null;
    let isListening = false;
    let autoSpeak = false;
    let databasePromise = null;

    const voiceLanguages = {
      darija: "ar-MA",
      arabic: "ar-SA",
      english: "en-US",
      french: "fr-FR",
      spanish: "es-ES"
    };

    const getVoiceLanguage = () => {
      const selected = elements.voiceLanguage?.value || "darija";
      return voiceLanguages[selected] || selected;
    };

    function showError(message) {
      console.error("MY AI:", message);
      alert(message);
    }

    function setStatus(message) {
      if (elements.voiceStatus) {
        elements.voiceStatus.textContent = message;
      }
    }

    function scrollToBottom() {
      if (elements.messages) {
        elements.messages.scrollTop =
          elements.messages.scrollHeight;
      }
    }

    /* SUPABASE */

    function initializeSupabase() {
      if (!window.supabase?.createClient) {
        console.error("Supabase SDK is missing.");
        return false;
      }

      supabase = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
      );

      return true;
    }

    async function getSession() {
      if (!supabase) return null;

      const { data, error } =
        await supabase.auth.getSession();

      if (error) {
        console.error("Session error:", error);
        return null;
      }

      currentSession = data.session || null;
      return currentSession;
    }

    async function updateAccount(session) {
      currentSession = session || null;

      const loggedIn = Boolean(currentSession);
      const email = currentSession?.user?.email || "";

      if (elements.login) elements.login.hidden = loggedIn;
      if (elements.logout) elements.logout.hidden = !loggedIn;

      if (elements.email) {
        elements.email.textContent =
          loggedIn ? email : "Not signed in";
      }

      if (elements.sidebarEmail) {
        elements.sidebarEmail.textContent =
          loggedIn ? email : "Not signed in";
      }

      if (elements.credits) {
        elements.credits.textContent = loggedIn ? "..." : "0";
      }

      if (!loggedIn) {
        await renderConversationList();
        return;
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("credits")
          .eq("id", currentSession.user.id)
          .maybeSingle();

        if (!error && data && elements.credits) {
          elements.credits.textContent = data.credits ?? "0";
        }
      } catch (error) {
        console.error("Credits error:", error);
      }

      await renderConversationList();
    }

    async function loginWithGoogle() {
      if (!supabase) {
        showError("Supabase is not available.");
        return;
      }

      try {
        if (elements.login) elements.login.disabled = true;

        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: window.location.origin
          }
        });

        if (error) throw error;

      } catch (error) {
        showError(error.message || "Google login failed.");
      } finally {
        if (elements.login) elements.login.disabled = false;
      }
    }

    async function logout() {
      if (!supabase) return;

      try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;

        currentSession = null;
        activeConversation = null;

        showWelcome();
        await updateAccount(null);

      } catch (error) {
        showError(error.message || "Logout failed.");
      }
    }

    /* INDEXED DB */

    function openDatabase() {
      if (databasePromise) return databasePromise;

      databasePromise = new Promise((resolve, reject) => {
        if (!window.indexedDB) {
          reject(new Error("IndexedDB is not supported."));
          return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = event => {
          const db = event.target.result;
          let store;

          if (!db.objectStoreNames.contains("conversations")) {
            store = db.createObjectStore("conversations", {
              keyPath: "id"
            });
          } else {
            store = event.target.transaction.objectStore(
              "conversations"
            );
          }

          if (!store.indexNames.contains("ownerId")) {
            store.createIndex("ownerId", "ownerId", {
              unique: false
            });
          }

          if (!store.indexNames.contains("updatedAt")) {
            store.createIndex("updatedAt", "updatedAt", {
              unique: false
            });
          }
        };

        request.onsuccess = () => resolve(request.result);

        request.onerror = () => {
          databasePromise = null;
          reject(request.error);
        };
      });

      return databasePromise;
    }

    async function databaseAction(mode, callback) {
      const db = await openDatabase();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(
          "conversations",
          mode
        );

        const store = transaction.objectStore("conversations");
        let request;

        try {
          request = callback(store);
        } catch (error) {
          reject(error);
          return;
        }

        transaction.oncomplete = () => resolve(request?.result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    }

    async function saveConversation(conversation) {
      if (!conversation) return;

      conversation.updatedAt = Date.now();

      try {
        await databaseAction("readwrite", store =>
          store.put(conversation)
        );
      } catch (error) {
        console.error("Save conversation error:", error);
      }
    }

    async function getConversation(id) {
      try {
        const db = await openDatabase();

        return await new Promise((resolve, reject) => {
          const transaction = db.transaction(
            "conversations",
            "readonly"
          );

          const request = transaction
            .objectStore("conversations")
            .get(id);

          request.onsuccess = () =>
            resolve(request.result || null);

          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        console.error("Get conversation error:", error);
        return null;
      }
    }

    async function getConversations() {
      const ownerId = currentSession?.user?.id;
      if (!ownerId) return [];

      try {
        const db = await openDatabase();

        return await new Promise((resolve, reject) => {
          const transaction = db.transaction(
            "conversations",
            "readonly"
          );

          const request = transaction
            .objectStore("conversations")
            .index("ownerId")
            .getAll(ownerId);

          request.onsuccess = () => {
            const conversations = request.result || [];

            conversations.sort(
              (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
            );

            resolve(conversations);
          };

          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        console.error("List conversations error:", error);
        return [];
      }
    }

    async function deleteConversation(id) {
      try {
        await databaseAction("readwrite", store =>
          store.delete(id)
        );

        if (activeConversation?.id === id) {
          activeConversation = null;
          showWelcome();
        }

        await renderConversationList();

      } catch (error) {
        console.error("Delete conversation error:", error);
      }
    }

    async function clearConversations() {
      const conversations = await getConversations();

      for (const conversation of conversations) {
        await databaseAction("readwrite", store =>
          store.delete(conversation.id)
        );
      }

      activeConversation = null;
      showWelcome();
      await renderConversationList();
    }

    function createConversation() {
      return {
        id: crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now()) + Math.random(),

        ownerId: currentSession.user.id,
        title: "New chat",
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
    }

    async function ensureActiveConversation(message) {
      if (!currentSession?.user) {
        throw new Error("Please sign in first.");
      }

      if (!activeConversation) {
        activeConversation = createConversation();
      }

      if (
        activeConversation.title === "New chat" &&
        message
      ) {
        activeConversation.title =
          message.trim().slice(0, 45) || "New chat";
      }

      return activeConversation;
    }

    async function storeMessage(message) {
      if (!activeConversation) return;

      activeConversation.messages.push(message);
      activeConversation.updatedAt = Date.now();

      await saveConversation(activeConversation);
    }

    /* CHAT DISPLAY */

    function addMessage(role, content, image = null) {
      if (!elements.messages) return null;

      $("welcome")?.remove();

      const message = document.createElement("div");
      message.className =
        role === "user"
          ? "message user"
          : "message assistant";

      const bubble = document.createElement("div");
      bubble.className = "message-content";

      if (image) {
        const imageElement = document.createElement("img");
        imageElement.src = image;
        imageElement.alt = "Uploaded image";
        imageElement.className = "message-image";
        bubble.appendChild(imageElement);
      }

      const textElement = document.createElement("div");
      textElement.className = "message-text";
      textElement.textContent = content || "";

      bubble.appendChild(textElement);
      message.appendChild(bubble);
      elements.messages.appendChild(message);

      scrollToBottom();
      return message;
    }

    function showWelcome() {
      if (!elements.messages) return;

      elements.messages.innerHTML = `
        <div class="welcome" id="welcome">
          <h1>How can I help you today?</h1>
          <p>Ask anything. Let's explore together.</p>
          <div class="suggestion-grid">
            <button type="button" class="suggestion">
              Explain a difficult topic
            </button>
            <button type="button" class="suggestion">
              Help me write something
            </button>
            <button type="button" class="suggestion">
              Solve a problem
            </button>
            <button type="button" class="suggestion">
              Give me creative ideas
            </button>
          </div>
        </div>
      `;

      elements.messages
        .querySelectorAll(".suggestion")
        .forEach(button => {
          button.addEventListener("click", () => {
            if (!elements.input) return;
            elements.input.value = button.textContent.trim();
            elements.input.focus();
          });
        });
    }

    function showThinking() {
      removeThinking();

      const thinking = document.createElement("div");
      thinking.id = "myai-thinking";
      thinking.className = "message assistant";

      const bubble = document.createElement("div");
      bubble.className = "message-content";
      bubble.textContent = "Thinking...";

      thinking.appendChild(bubble);
      elements.messages?.appendChild(thinking);

      scrollToBottom();
    }

    function removeThinking() {
      $("myai-thinking")?.remove();
    }

    function renderMath(element) {
      if (!window.MathJax?.typesetPromise || !element) return;

      window.MathJax.typesetPromise([element]).catch(error => {
        console.warn("MathJax error:", error);
      });
    }

    /* HISTORY */

    function createHistoryInterface() {
      if (!elements.newChat || $("myai-history")) return;

      const history = document.createElement("section");
      history.id = "myai-history";
      history.className = "myai-history";

      history.innerHTML = `
        <div class="history-heading">
          <span>Recent chats</span>
          <button type="button" id="myai-delete-all">
            Clear all
          </button>
        </div>
        <div id="myai-history-list"></div>
      `;

      elements.newChat.insertAdjacentElement("afterend", history);

      $("myai-delete-all")?.addEventListener("click", async () => {
        if (!currentSession) {
          showError("Please sign in first.");
          return;
        }

        if (confirm("Delete all your conversations?")) {
          await clearConversations();
        }
      });

      $("myai-history-list")?.addEventListener("click", async event => {
        const deleteButton = event.target.closest(
          "[data-delete-chat]"
        );

        if (deleteButton) {
          event.stopPropagation();

          const id = deleteButton.dataset.deleteChat;

          if (confirm("Delete this conversation?")) {
            await deleteConversation(id);
          }

          return;
        }

        const item = event.target.closest("[data-chat-id]");

        if (item) {
          await openConversation(item.dataset.chatId);
        }
      });
    }

    async function renderConversationList() {
      createHistoryInterface();

      const list = $("myai-history-list");
      if (!list) return;

      if (!currentSession) {
        list.innerHTML = "";
        return;
      }

      const conversations = await getConversations();
      list.innerHTML = "";

      conversations.forEach(conversation => {
        const item = document.createElement("div");

        /* Correct class names matching CSS */
        item.className = "myai-history-item";
        item.dataset.chatId = conversation.id;

        const title = document.createElement("span");
        title.className = "myai-history-title";
        title.textContent = conversation.title || "New chat";

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "myai-history-delete";
        deleteButton.textContent = "×";
        deleteButton.title = "Delete conversation";
        deleteButton.dataset.deleteChat = conversation.id;

        item.append(title, deleteButton);
        list.appendChild(item);
      });
    }

    async function openConversation(id) {
      const conversation = await getConversation(id);

      if (!conversation) return;

      if (currentSession?.user?.id !== conversation.ownerId) {
        return;
      }

      activeConversation = conversation;
      elements.messages.innerHTML = "";

      for (const message of conversation.messages || []) {
        if (!message.sentToModel && message.role === "user") {
          continue;
        }

        addMessage(
          message.role,
          message.content,
          message.imagePreview
        );
      }

      closeSidebar();
    }

    async function startNewChat() {
      activeConversation = null;
      clearImagePreview();
      showWelcome();
      closeSidebar();
      await renderConversationList();
      elements.input?.focus();
    }

    /* SIDEBAR */

    function openSidebar() {
      elements.sidebar?.classList.add("sidebar-open");
      elements.overlay?.classList.add("overlay-visible");
      document.body.style.overflow = "hidden";
    }

    function closeSidebar() {
      elements.sidebar?.classList.remove("sidebar-open");
      elements.overlay?.classList.remove("overlay-visible");
      document.body.style.overflow = "";
    }

    elements.openSidebar?.addEventListener("click", openSidebar);
    elements.closeSidebar?.addEventListener("click", closeSidebar);
    elements.overlay?.addEventListener("click", closeSidebar);
    elements.newChat?.addEventListener("click", startNewChat);

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        closeSidebar();
        elements.aboutModal?.classList.remove("active");
      }
    });

    elements.settings?.addEventListener("click", () => {
      closeSidebar();

      if (elements.voicePanel) {
        elements.voicePanel.hidden = false;
        elements.voicePanel.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
      }
    });

    elements.about?.addEventListener("click", () => {
      closeSidebar();
      elements.aboutModal?.classList.add("active");
    });

    elements.closeAbout?.addEventListener("click", () => {
      elements.aboutModal?.classList.remove("active");
    });

    elements.aboutModal?.addEventListener("click", event => {
      if (event.target === elements.aboutModal) {
        elements.aboutModal.classList.remove("active");
      }
    });

    /* IMAGE UPLOAD */

    function clearImagePreview() {
      pendingImage = null;

      if (elements.imageInput) elements.imageInput.value = "";
      if (elements.previewImg) elements.previewImg.src = "";
      if (elements.imagePreview) elements.imagePreview.hidden = true;
    }

    function showImagePreview(dataUrl) {
      if (elements.previewImg) elements.previewImg.src = dataUrl;
      if (elements.imagePreview) elements.imagePreview.hidden = false;
    }

    function compressImage(file) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        const reader = new FileReader();

        reader.onload = () => {
          image.onload = () => {
            const maxDimension = 1280;

            let width = image.width;
            let height = image.height;

            if (width > maxDimension || height > maxDimension) {
              const ratio = Math.min(
                maxDimension / width,
                maxDimension / height
              );

              width = Math.round(width * ratio);
              height = Math.round(height * ratio);
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;

            const context = canvas.getContext("2d");
            context.drawImage(image, 0, 0, width, height);

            const dataUrl = canvas.toDataURL("image/jpeg", 0.75);

            resolve({
              preview: dataUrl,
              mimeType: "image/jpeg",
              data: dataUrl.split(",")[1]
            });
          };

          image.onerror = reject;
          image.src = reader.result;
        };

        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    elements.attach?.addEventListener("click", () => {
      elements.imageInput?.click();
    });

    elements.imageInput?.addEventListener("change", async () => {
      const file = elements.imageInput.files?.[0];
      if (!file) return;

      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        showError("Please select a JPG, PNG, or WEBP image.");
        clearImagePreview();
        return;
      }

      if (file.size > MAX_IMAGE_SIZE) {
        showError("Image size must be less than 10 MB.");
        clearImagePreview();
        return;
      }

      try {
        pendingImage = await compressImage(file);
        showImagePreview(pendingImage.preview);
      } catch (error) {
        console.error("Image error:", error);
        showError("Could not load this image.");
        clearImagePreview();
      }
    });

    elements.removeImage?.addEventListener("click", clearImagePreview);

    /* VOICE OUTPUT */

    function detectLanguage(text) {
      if (/[\u0600-\u06FF]/.test(text)) return "ar-SA";
      if (/[àâçéèêëîïôûùüÿœ]/i.test(text)) return "fr-FR";
      return getVoiceLanguage();
    }

    function stopSpeaking() {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    }

    function speakText(text) {
      if (!("speechSynthesis" in window) || !text) return;

      stopSpeaking();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = detectLanguage(text);
      utterance.rate = 1;
      utterance.pitch = 1;

      const voices = window.speechSynthesis.getVoices();
      const selectedVoice = elements.voiceChoice?.value;

      if (selectedVoice) {
        const voice = voices.find(v => v.name === selectedVoice);
        if (voice) utterance.voice = voice;
      } else {
        const language = utterance.lang.split("-")[0];
        const voice = voices.find(v =>
          v.lang.toLowerCase().startsWith(language.toLowerCase())
        );
        if (voice) utterance.voice = voice;
      }

      window.speechSynthesis.speak(utterance);
    }

    function loadVoices() {
      if (!elements.voiceChoice || !("speechSynthesis" in window)) return;

      const voices = window.speechSynthesis.getVoices();
      const previous = elements.voiceChoice.value;

      elements.voiceChoice.innerHTML =
        `<option value="">Automatic voice</option>`;

      voices.forEach(voice => {
        const option = document.createElement("option");
        option.value = voice.name;
        option.textContent = `${voice.name} (${voice.lang})`;
        elements.voiceChoice.appendChild(option);
      });

      if (previous) elements.voiceChoice.value = previous;
    }

    window.speechSynthesis?.addEventListener?.(
      "voiceschanged",
      loadVoices
    );

    elements.voiceOutput?.addEventListener("click", () => {
      autoSpeak = !autoSpeak;
      elements.voiceOutput.classList.toggle("active", autoSpeak);
      elements.voiceOutput.setAttribute("aria-pressed", String(autoSpeak));

      setStatus(
        autoSpeak
          ? "Voice responses enabled"
          : "Voice responses disabled"
      );
    });

    elements.stopVoice?.addEventListener("click", stopSpeaking);

    elements.voiceToggle?.addEventListener("click", () => {
      if (!elements.voicePanel) return;
      elements.voicePanel.hidden = !elements.voicePanel.hidden;
    });

    elements.previewVoice?.addEventListener("click", () => {
      speakText("Hello! This is the MY AI voice preview.");
    });

    /* VOICE INPUT */

    function initializeRecognition() {
      const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

      if (!SpeechRecognition) {
        setStatus("Voice input is not supported by this browser.");
        return null;
      }

      const instance = new SpeechRecognition();
      instance.lang = getVoiceLanguage();
      instance.continuous = false;
      instance.interimResults = true;

      let finalTranscript = "";

      instance.onstart = () => {
        isListening = true;
        finalTranscript = "";
        setStatus("Listening...");
        elements.voiceInput?.classList.add("active");
      };

      instance.onresult = event => {
        let interimText = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];

          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimText += result[0].transcript;
          }
        }

        if (elements.input) {
          elements.input.value = finalTranscript + interimText;
        }
      };

      instance.onerror = event => {
        console.error("Speech recognition error:", event.error);
        setStatus("Voice recognition error.");
      };

      instance.onend = () => {
        isListening = false;
        elements.voiceInput?.classList.remove("active");
        setStatus("Voice input stopped.");
      };

      return instance;
    }

    elements.voiceInput?.addEventListener("click", () => {
      if (isListening) {
        recognition?.stop();
        return;
      }

      recognition = initializeRecognition();
      if (!recognition) return;

      try {
        recognition.start();
      } catch (error) {
        console.error("Recognition start error:", error);
        setStatus("Could not start voice recognition.");
      }
    });

    elements.voiceLanguage?.addEventListener("change", () => {
      if (recognition && !isListening) {
        recognition.lang = getVoiceLanguage();
      }
    });

    /* GEMINI CHAT */

    function getModelHistory() {
      if (!activeConversation?.messages) return [];

      return activeConversation.messages
        .filter(message => message.sentToModel)
        .map(message => ({
          role: message.role === "assistant" ? "model" : "user",
          content: message.content || ""
        }));
    }

    async function sendMessage() {
      if (isSending) return;

      const messageText = elements.input?.value.trim() || "";
      if (!messageText && !pendingImage) return;

      if (!currentSession) await getSession();

      if (!currentSession) {
        showError("Please sign in with Google before sending a message.");
        return;
      }

      isSending = true;

      const imageToSend = pendingImage
        ? { ...pendingImage }
        : null;

      const userMessage = {
        role: "user",
        content: messageText,
        imagePreview: imageToSend?.preview || null,
        sentToModel: false,
        timestamp: Date.now()
      };

      if (elements.send) elements.send.disabled = true;
      if (elements.input) elements.input.disabled = true;

      try {
        await ensureActiveConversation(messageText || "Image");
        await storeMessage(userMessage);

        addMessage("user", messageText, imageToSend?.preview || null);

        if (elements.input) elements.input.value = "";

        clearImagePreview();
        showThinking();

        const history = getModelHistory();

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${currentSession.access_token}`
          },
          body: JSON.stringify({
            message: messageText,
            history,
            image: imageToSend
              ? {
                  mimeType: imageToSend.mimeType,
                  data: imageToSend.data
                }
              : null
          })
        });

        let result;

        try {
          result = await response.json();
        } catch {
          throw new Error("The server returned an invalid response.");
        }

        if (!response.ok) {
          throw new Error(
            result.error ||
            result.message ||
            `Server error (${response.status})`
          );
        }

        const reply = result.reply || result.response || result.text;

        if (!reply) {
          throw new Error("The AI returned an empty response.");
        }

        removeThinking();
        userMessage.sentToModel = true;

        const assistantMessage = {
          role: "assistant",
          content: reply,
          sentToModel: true,
          timestamp: Date.now()
        };

        await storeMessage(assistantMessage);

        const assistantElement = addMessage("assistant", reply);
        renderMath(assistantElement);

        await saveConversation(activeConversation);
        await renderConversationList();

        if (autoSpeak) speakText(reply);

      } catch (error) {
        console.error("Send message error:", error);
        removeThinking();

        addMessage(
          "assistant",
          `Sorry, something went wrong: ${error.message}`
        );

        if (activeConversation) {
          await saveConversation(activeConversation);
        }

      } finally {
        isSending = false;
        if (elements.send) elements.send.disabled = false;
        if (elements.input) elements.input.disabled = false;
        elements.input?.focus();
      }
    }

    /* FORM EVENTS */

    elements.form?.addEventListener("submit", event => {
      event.preventDefault();
      sendMessage();
    });

    elements.send?.addEventListener("click", event => {
      event.preventDefault();
      sendMessage();
    });

    elements.input?.addEventListener("keydown", event => {
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.isComposing
      ) {
        event.preventDefault();
        sendMessage();
      }
    });

    /* AUTH EVENTS */

    elements.login?.addEventListener("click", loginWithGoogle);
    elements.logout?.addEventListener("click", logout);

    /* START */

    async function start() {
      closeSidebar();
      createHistoryInterface();
      showWelcome();
      loadVoices();

      if (!initializeSupabase()) {
        showError(
          "Supabase could not be initialized. Check the Supabase SDK in index.html."
        );
        return;
      }

      try {
        const session = await getSession();
        await updateAccount(session);

        supabase.auth.onAuthStateChange((_event, session) => {
          currentSession = session || null;

          updateAccount(currentSession).catch(error => {
            console.error("Account update error:", error);
          });
        });

      } catch (error) {
        console.error("Application startup error:", error);
      }
    }

    start().catch(error => {
      console.error("MY AI startup failed:", error);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializeMYAI,
      { once: true }
    );
  } else {
    initializeMYAI();
  }
})();
