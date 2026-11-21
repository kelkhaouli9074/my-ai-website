JavaScript

"use strict";

/* =========================================
   MY AI — COMPLETE APP.JS
   Stable initialization + events + chat
========================================= */

(() => {
  // Visible diagnostic: confirms that this file loaded.
  console.info("MY AI: app.js loaded successfully.");

  function initializeMYAI() {
    if (window.__MY_AI_INITIALIZED__) return;
    window.__MY_AI_INITIALIZED__ = true;

    const $ = id => document.getElementById(id);
    const on = (el, event, fn, options) => {
      if (el) el.addEventListener(event, fn, options);
    };

    const SUPABASE_URL =
      "https://qxmmrlbhgmuhpityezvh.supabase.co";

    const SUPABASE_KEY =
      "sb_publishable_a2bgpHM81IQK21ewBAtJsQ_gk2Y6uMK";

    const makeId = () =>
      window.crypto?.randomUUID?.() ||
      "myai-" + Date.now() + "-" +
      Math.random().toString(36).slice(2);

    // =====================================
    // SUPABASE
    // =====================================

    if (!window.supabase?.createClient) {
      console.error("MY AI: Supabase SDK did not load.");
      alert("MY AI: Supabase could not load. Refresh the page.");
      return;
    }

    const supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_KEY
    );

    // =====================================
    // HTML ELEMENTS
    // =====================================

    const form = $("chat-form");
    const input = $("message-input");
    const messages = $("chat-messages");
    const sendBtn = $("send-btn");

    const newChatBtn = $("new-chat-btn");
    const loginBtn = $("google-login");
    const logoutBtn = $("google-logout");

    const creditsDisplay = $("credits-display");
    const accountEmail = $("account-email");
    const sidebarAccountEmail = $("sidebar-account-email");

    const sidebar = $("main-sidebar");
    const overlay = $("sidebar-overlay");

    const imageInput = $("image-input");
    const attachBtn = $("attach-btn");
    const imagePreview = $("image-preview");
    const previewImg = $("preview-img");
    const removeImageBtn = $("remove-image");

    const voiceInputBtn = $("voice-input-btn");
    const voiceOutputBtn = $("voice-output-btn");
    const stopVoiceBtn = $("stop-voice-btn");
    const voiceStatus = $("voice-status");

    const languageSelect = $("voice-language");
    const voiceSelect = $("voice-choice");
    const previewVoiceBtn = $("preview-voice-btn");
    const voiceSettingsToggle = $("voice-settings-toggle");
    const voiceSettingsPanel = $("voice-settings-panel");

    const aboutModal = $("about-modal");

    const missing = [
      ["chat-form", form],
      ["message-input", input],
      ["chat-messages", messages],
      ["send-btn", sendBtn]
    ].filter(([, element]) => !element).map(([id]) => id);

    if (missing.length) {
      console.error("MY AI: Missing HTML elements:", missing);
      alert("MY AI: Missing HTML elements: " + missing.join(", "));
      window.__MY_AI_INITIALIZED__ = false;
      return;
    }

    // =====================================
    // STATE
    // =====================================

    let currentSession = null;
    let activeOwnerId = null;
    let activeConversation = null;
    let history = [];

    let selectedImage = null;
    let isSending = false;
    let autoSpeak = false;

    let recognition = null;
    let isListening = false;
    let recognizedText = "";
    let speechError = null;
    let lastSpeechLanguage = null;

    // =====================================
    // ERROR DISPLAY
    // =====================================

    function showError(message) {
      console.error("MY AI:", message);
      addMessage("Error: " + message, "assistant");
    }

    // =====================================
    // SIDEBAR
    // =====================================

    function openSidebar() {
      sidebar?.classList.add("sidebar-open");
      overlay?.classList.add("overlay-visible");
      document.body.style.overflow = "hidden";
    }

    function closeSidebar() {
      sidebar?.classList.remove("sidebar-open");
      overlay?.classList.remove("overlay-visible");
      document.body.style.overflow = "";
    }

    on($("open-sidebar"), "click", event => {
      event.preventDefault();
      openSidebar();
    });

    on($("close-sidebar"), "click", event => {
      event.preventDefault();
      closeSidebar();
    });

    on(overlay, "click", closeSidebar);

    document.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;

      closeSidebar();

      if (aboutModal) aboutModal.hidden = true;

      if (voiceSettingsPanel) {
        voiceSettingsPanel.hidden = true;
        voiceSettingsToggle?.setAttribute("aria-expanded", "false");
      }
    });

    // =====================================
    // LOCAL CONVERSATION DATABASE
    // =====================================

    const DB_NAME = "MY_AI_LOCAL_DATABASE";
    const STORE_NAME = "conversations";
    let localDB = null;

    function openDatabase() {
      return new Promise((resolve, reject) => {
        if (localDB) return resolve(localDB);

        if (!window.indexedDB) {
          return reject(new Error("Browser storage is unavailable."));
        }

        const request = indexedDB.open(DB_NAME, 1);

        request.onupgradeneeded = event => {
          const db = event.target.result;

          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, {
              keyPath: "id"
            });

            store.createIndex("ownerId", "ownerId", {
              unique: false
            });
          }
        };

        request.onsuccess = () => {
          localDB = request.result;
          resolve(localDB);
        };

        request.onerror = () => {
          reject(request.error || new Error("Database error."));
        };
      });
    }

    async function saveConversation(conversation) {
      const db = await openDatabase();

      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(conversation);

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    }

    async function getConversations(ownerId) {
      const db = await openDatabase();

      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME)
          .index("ownerId")
          .getAll(ownerId);

        request.onsuccess = () => {
          const result = request.result || [];
          result.sort((a, b) => b.updatedAt - a.updatedAt);
          resolve(result);
        };

        request.onerror = () => reject(request.error);
      });
    }

    async function getConversation(id, ownerId) {
      const db = await openDatabase();

      return new Promise((resolve, reject) => {
        const request = db.transaction(STORE_NAME, "readonly")
          .objectStore(STORE_NAME)
          .get(id);

        request.onsuccess = () => {
          const item = request.result;
          resolve(item?.ownerId === ownerId ? item : null);
        };

        request.onerror = () => reject(request.error);
      });
    }

    async function deleteConversation(id) {
      const db = await openDatabase();

      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(id);

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    }

    function createConversation(ownerId, firstMessage) {
      const now = Date.now();

      return {
        id: makeId(),
        ownerId,
        title: (firstMessage || "New chat").slice(0, 45),
        createdAt: now,
        updatedAt: now,
        messages: []
      };
    }

    // =====================================
    // MESSAGE DISPLAY
    // =====================================

    function addMessage(text, type, imageUrl = null) {
      $("welcome")?.remove();

      const div = document.createElement("div");
      div.className = "message " + type;
      div.textContent = text || "";

      if (imageUrl) {
        const img = document.createElement("img");
        img.src = imageUrl;
        img.alt = "Uploaded image";
        img.className = "message-image";
        div.appendChild(img);
      }

      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;

      return div;
    }

    function showWelcome() {
      messages.innerHTML = `
        <div class="welcome" id="welcome">
          <div class="welcome-orb">
            <div class="orb-core">M</div>
          </div>

          <div class="welcome-tag">YOUR PERSONAL AI</div>

          <h1>Think beyond<br><span>the ordinary.</span></h1>

          <p>
            Ask questions, explore ideas, create something new
            or learn something you have always wanted to understand.
          </p>

          <div class="suggestions">
            <button type="button" class="suggestion"
              data-prompt="Explain a difficult scientific concept simply.">
              <span class="suggestion-icon">◈</span>
              <span class="suggestion-copy">
                <strong>Learn something</strong>
                <small>Understand difficult concepts</small>
              </span>
              <span class="suggestion-arrow">↗</span>
            </button>

            <button type="button" class="suggestion"
              data-prompt="Help me solve a mathematics problem step by step.">
              <span class="suggestion-icon">∑</span>
              <span class="suggestion-copy">
                <strong>Mathematics</strong>
                <small>Equations and calculations</small>
              </span>
              <span class="suggestion-arrow">↗</span>
            </button>

            <button type="button" class="suggestion"
              data-prompt="Give me creative ideas for a new project.">
              <span class="suggestion-icon">✧</span>
              <span class="suggestion-copy">
                <strong>Explore ideas</strong>
                <small>Discover new possibilities</small>
              </span>
              <span class="suggestion-arrow">↗</span>
            </button>

            <button type="button" class="suggestion"
              data-prompt="Help me write and improve some code.">
              <span class="suggestion-icon">⌘</span>
              <span class="suggestion-copy">
                <strong>Write code</strong>
                <small>Build and improve projects</small>
              </span>
              <span class="suggestion-arrow">↗</span>
            </button>
          </div>
        </div>
      `;
    }

    // =====================================
    // HISTORY INTERFACE
    // =====================================

    function createHistoryInterface() {
      if ($("myai-history") || !newChatBtn) return;

      const section = document.createElement("section");
      section.id = "myai-history";

      section.innerHTML = `
        <div class="history-heading">
          <span>Recent chats</span>
          <button id="myai-delete-all" type="button">Clear all</button>
        </div>
        <div id="myai-history-list">
          <div class="myai-history-empty">No conversations yet</div>
        </div>
      `;

      newChatBtn.insertAdjacentElement("afterend", section);

      section.addEventListener("click", async event => {
        const deleteBtn = event.target.closest(".myai-history-delete");

        if (deleteBtn) {
          event.stopPropagation();

          if (!confirm("Delete this conversation?")) return;

          try {
            const id = deleteBtn.dataset.id;
            await deleteConversation(id);

            if (activeConversation?.id === id) startNewChat();

            await renderConversationList();
          } catch (error) {
            alert("Could not delete conversation: " + error.message);
          }

          return;
        }

        const item = event.target.closest(".myai-history-item");

        if (item) {
          await openConversation(item.dataset.id);
          closeSidebar();
        }
      });

      on($("myai-delete-all"), "click", async () => {
        if (!activeOwnerId) return;
        if (!confirm("Delete all your saved conversations?")) return;

        try {
          const all = await getConversations(activeOwnerId);

          for (const item of all) {
            await deleteConversation(item.id);
          }

          startNewChat();
          await renderConversationList();
        } catch (error) {
          alert("Could not clear history: " + error.message);
        }
      });
    }

    async function renderConversationList() {
      createHistoryInterface();

      const list = $("myai-history-list");
      if (!list) return;

      if (!activeOwnerId) {
        list.innerHTML =
          '<div class="myai-history-empty">Sign in to see your chats</div>';
        return;
      }

      try {
        const conversations = await getConversations(activeOwnerId);
        list.innerHTML = "";

        if (!conversations.length) {
          list.innerHTML =
            '<div class="myai-history-empty">No conversations yet</div>';
          return;
        }

        conversations.forEach(conversation => {
          const item = document.createElement("div");
          item.className = "myai-history-item";
          item.dataset.id = conversation.id;

          if (activeConversation?.id === conversation.id) {
            item.classList.add("active");
          }

          const title = document.createElement("span");
          title.className = "myai-history-title";
          title.textContent = "▤  " + conversation.title;

          const remove = document.createElement("button");
          remove.type = "button";
          remove.className = "myai-history-delete";
          remove.dataset.id = conversation.id;
          remove.textContent = "×";

          item.append(title, remove);
          list.appendChild(item);
        });
      } catch (error) {
        console.error("History error:", error);
        list.innerHTML =
          '<div class="myai-history-empty">Could not load conversations</div>';
      }
    }

    async function ensureActiveConversation(firstMessage) {
      if (activeConversation && activeConversation.ownerId === activeOwnerId) {
        return activeConversation;
      }

      if (!activeOwnerId) throw new Error("Please sign in first.");

      activeConversation = createConversation(activeOwnerId, firstMessage);
      await saveConversation(activeConversation);
      await renderConversationList();

      return activeConversation;
    }

    async function storeMessage(message) {
      if (!activeConversation) return;

      activeConversation.messages.push(message);
      activeConversation.updatedAt = Date.now();

      await saveConversation(activeConversation);
      await renderConversationList();
    }

    async function openConversation(id) {
      if (!activeOwnerId) return;

      try {
        stopSpeaking();

        if (isListening && recognition) recognition.stop();

        clearImage();

        const conversation = await getConversation(id, activeOwnerId);
        if (!conversation) return;

        activeConversation = conversation;

        history = conversation.messages
          .filter(item => item.sentToModel)
          .filter(item =>
            item.role === "user" || item.role === "assistant"
          )
          .map(item => ({
            role: item.role,
            content: item.content
          }));

        messages.innerHTML = "";

        if (!conversation.messages.length) {
          showWelcome();
        } else {
          conversation.messages.forEach(item => {
            const element = addMessage(
              item.content,
              item.role,
              item.imagePreview || null
            );

            if (item.role === "assistant") renderMath(element);
          });
        }

        await renderConversationList();
      } catch (error) {
        alert("Could not open conversation: " + error.message);
      }
    }

    function startNewChat() {
      history = [];
      activeConversation = null;

      stopSpeaking();

      if (isListening && recognition) recognition.stop();

      clearImage();
      showWelcome();

      input.value = "";
      input.style.height = "auto";

      if (voiceSettingsPanel) voiceSettingsPanel.hidden = true;
      voiceSettingsToggle?.setAttribute("aria-expanded", "false");

      renderConversationList();
      closeSidebar();
      input.focus();
    }

    // =====================================
    // SIDEBAR BUTTONS
    // =====================================

    on(newChatBtn, "click", event => {
      event.preventDefault();
      startNewChat();
    });

    on($("open-settings"), "click", event => {
      event.preventDefault();
      closeSidebar();

      if (!voiceSettingsPanel) return;

      voiceSettingsPanel.hidden = false;
      voiceSettingsToggle?.setAttribute("aria-expanded", "true");

      voiceSettingsPanel.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    });

    on($("open-about"), "click", event => {
      event.preventDefault();
      closeSidebar();
      if (aboutModal) aboutModal.hidden = false;
    });

    on($("close-about"), "click", event => {
      event.preventDefault();
      if (aboutModal) aboutModal.hidden = true;
    });

    on(aboutModal, "click", event => {
      if (event.target === aboutModal) aboutModal.hidden = true;
    });

    on($("personal-account"), "click", event => {
      event.preventDefault();
      closeSidebar();

      if (currentSession) {
        if (confirm("Do you want to sign out?")) logoutBtn?.click();
      } else {
        loginBtn?.click();
      }
    });

    // =====================================
    // GOOGLE AUTHENTICATION
    // =====================================

    async function updateAccount(session) {
      try {
        if (session === undefined) {
          const result = await supabaseClient.auth.getSession();
          if (result.error) throw result.error;
          session = result.data.session;
        }

        currentSession = session;

        if (!session) {
          activeOwnerId = null;
          activeConversation = null;
          history = [];

          if (loginBtn) {
            loginBtn.hidden = false;
            loginBtn.disabled = false;
            loginBtn.textContent = "Sign in with Google";
          }

          if (logoutBtn) logoutBtn.hidden = true;
          if (accountEmail) accountEmail.textContent = "";
          if (sidebarAccountEmail) {
            sidebarAccountEmail.textContent = "Not signed in";
          }
          if (creditsDisplay) creditsDisplay.textContent = "Credits: --";

          showWelcome();
          await renderConversationList();
          return;
        }

        const ownerId = session.user.id;

        if (activeOwnerId !== ownerId) {
          activeOwnerId = ownerId;
          activeConversation = null;
          history = [];
          showWelcome();
        }

        if (loginBtn) loginBtn.hidden = true;
        if (logoutBtn) logoutBtn.hidden = false;

        const email = session.user.email || "Signed in";

        if (accountEmail) accountEmail.textContent = email;
        if (sidebarAccountEmail) sidebarAccountEmail.textContent = email;
        if (creditsDisplay) creditsDisplay.textContent = "Credits: ...";

        await renderConversationList();

        const { data, error } = await supabaseClient
          .from("profiles")
          .select("credits")
          .eq("id", ownerId)
          .maybeSingle();

        if (error) {
          console.error("Profile error:", error);
          if (creditsDisplay) {
            creditsDisplay.textContent = "Credits unavailable";
          }
          return;
        }

        if (creditsDisplay) {
          creditsDisplay.textContent =
            "Credits: " + (data?.credits ?? "--");
        }
      } catch (error) {
        console.error("Account error:", error);
        if (creditsDisplay) {
          creditsDisplay.textContent = "Credits unavailable";
        }
      }
    }

    on(loginBtn, "click", async event => {
      event.preventDefault();

      if (loginBtn.disabled) return;

      loginBtn.disabled = true;
      loginBtn.textContent = "Connecting...";

      try {
        const { error } = await supabaseClient.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: window.location.origin
          }
        });

        if (error) throw error;
      } catch (error) {
        alert("Google login error: " + error.message);
        loginBtn.disabled = false;
        loginBtn.textContent = "Sign in with Google";
      }
    });

    on(logoutBtn, "click", async event => {
      event.preventDefault();
      logoutBtn.disabled = true;

      try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;

        stopSpeaking();
        await updateAccount(null);
      } catch (error) {
        alert("Logout error: " + error.message);
      } finally {
        logoutBtn.disabled = false;
      }
    });

    supabaseClient.auth.onAuthStateChange((event, session) => {
      currentSession = session;
      setTimeout(() => updateAccount(session), 0);
    });

    // =====================================
    // MATHJAX
    // =====================================

    async function renderMath(element) {
      if (!window.MathJax || !element) return;

      try {
        await window.MathJax.startup.promise;
        await window.MathJax.typesetPromise([element]);
      } catch (error) {
        console.error("MathJax error:", error);
      }
    }

    // =====================================
    // VOICE LANGUAGE
    // =====================================

    const LANGUAGES = {
      darija: {
        recognition: "ar-MA",
        speech: "ar-MA",
        fallback: "ar"
      },
      ar: {
        recognition: "ar-SA",
        speech: "ar-SA",
        fallback: "ar"
      },
      en: {
        recognition: "en-US",
        speech: "en-US",
        fallback: "en"
      },
      fr: {
        recognition: "fr-FR",
        speech: "fr-FR",
        fallback: "fr"
      },
      es: {
        recognition: "es-ES",
        speech: "es-ES",
        fallback: "es"
      }
    };

    const LANGUAGE_SAMPLES = {
      darija: "مرحبا! أنا MY AI، كيف نقدر نعاونك اليوم؟",
      ar: "مرحباً! أنا MY AI، كيف يمكنني مساعدتك اليوم؟",
      en: "Hello! I am MY AI. How can I help you today?",
      fr: "Bonjour ! Je suis MY AI. Comment puis-je vous aider ?",
      es: "¡Hola! Soy MY AI. ¿Cómo puedo ayudarte hoy?"
    };

    function browserLanguage() {
      const lang = (navigator.language || "en").toLowerCase();

      if (lang.startsWith("ar")) return "ar";
      if (lang.startsWith("fr")) return "fr";
      if (lang.startsWith("es")) return "es";

      return "en";
    }

    function currentLanguage() {
      const selected = languageSelect?.value || "auto";

      if (selected === "auto") {
        return lastSpeechLanguage || browserLanguage();
      }

      return selected;
    }

    function speechConfig(language) {
      return LANGUAGES[language] || LANGUAGES.en;
    }

    function recognitionLanguage() {
      const selected = languageSelect?.value || "auto";
      return speechConfig(
        selected === "auto" ? browserLanguage() : selected
      ).recognition;
    }

    function detectTextLanguage(text) {
      if (/[\u0600-\u06FF]/.test(text)) return "ar";

      const value = " " + text.toLowerCase() + " ";

      const french = [
        " le ", " la ", " les ", " une ", " des ", " je ",
        " vous ", " bonjour ", " merci ", " pourquoi ", " comment "
      ];

      const spanish = [
        " el ", " los ", " las ", " una ", " hola ",
        " gracias ", " porque ", " buenos "
      ];

      const fs = french.filter(word => value.includes(word)).length;
      const ss = spanish.filter(word => value.includes(word)).length;

      if (fs > ss && fs > 0) return "fr";
      if (ss > fs && ss > 0) return "es";

      return "en";
    }

    // =====================================
    // TEXT TO SPEECH
    // =====================================

    function refreshVoiceList() {
      if (!voiceSelect || !window.speechSynthesis) return;

      const voices = speechSynthesis.getVoices();
      const config = speechConfig(currentLanguage());

      const matching = voices.filter(voice =>
        voice.lang.toLowerCase().startsWith(config.fallback)
      );

      voiceSelect.innerHTML = "";

      const automatic = document.createElement("option");
      automatic.value = "default";
      automatic.textContent = "Automatic voice";
      voiceSelect.appendChild(automatic);

      const available = matching.length ? matching : voices;

      available.forEach(voice => {
        const option = document.createElement("option");
        option.value = String(voices.indexOf(voice));
        option.textContent = voice.name + " (" + voice.lang + ")";
        voiceSelect.appendChild(option);
      });
    }

    function selectedVoice() {
      const value = voiceSelect?.value;

      if (!value || value === "default") return null;

      return speechSynthesis.getVoices()[Number(value)] || null;
    }

    if (window.speechSynthesis) {
      speechSynthesis.onvoiceschanged = refreshVoiceList;
      refreshVoiceList();
      setTimeout(refreshVoiceList, 500);
    } else if (previewVoiceBtn) {
      previewVoiceBtn.disabled = true;
    }

    function cleanSpeechText(text) {
      return text
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\$\$[\s\S]*?\$\$/g, " ")
        .replace(/\$[^$]*\$/g, " ")
        .replace(/https?:\/\/\S+/g, " ")
        .replace(/[#*_~>|]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function stopSpeaking() {
      if (window.speechSynthesis) speechSynthesis.cancel();
      if (stopVoiceBtn) stopVoiceBtn.hidden = true;
    }

    function speakText(text, languageOverride = null) {
      if (!window.speechSynthesis) {
        if (voiceStatus) {
          voiceStatus.textContent = "Voice playback is not supported.";
        }
        return;
      }

      const clean = cleanSpeechText(text);
      if (!clean) return;

      stopSpeaking();

      const language = languageOverride || currentLanguage();
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = speechConfig(language).speech;
      utterance.rate = 0.95;

      const voice = selectedVoice();
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      }

      utterance.onstart = () => {
        if (voiceStatus) voiceStatus.textContent = "MY AI is speaking...";
        if (stopVoiceBtn) stopVoiceBtn.hidden = false;
      };

      utterance.onend = () => {
        if (voiceStatus) voiceStatus.textContent = "";
        if (stopVoiceBtn) stopVoiceBtn.hidden = true;
      };

      utterance.onerror = error => {
        console.error("Speech error:", error);
        if (voiceStatus) {
          voiceStatus.textContent = "Voice playback unavailable.";
        }
        if (stopVoiceBtn) stopVoiceBtn.hidden = true;
      };

      speechSynthesis.speak(utterance);
    }

    on(previewVoiceBtn, "click", event => {
      event.preventDefault();

      const language = currentLanguage();
      speakText(
        LANGUAGE_SAMPLES[language] || LANGUAGE_SAMPLES.en,
        language
      );
    });

    // =====================================
    // LANGUAGE SETTINGS
    // =====================================

    try {
      const saved = localStorage.getItem("myai_voice_language");

      if (saved === "auto" || LANGUAGES[saved]) {
        if (languageSelect) languageSelect.value = saved;
      }
    } catch (error) {
      console.warn("Could not read language setting.");
    }

    on(languageSelect, "change", () => {
      if (isListening && recognition) recognition.stop();

      stopSpeaking();

      try {
        localStorage.setItem(
          "myai_voice_language",
          languageSelect.value
        );
      } catch (error) {
        console.warn("Could not save language setting.");
      }

      if (languageSelect.value !== "auto") {
        lastSpeechLanguage = languageSelect.value;
      }

      refreshVoiceList();

      if (recognition) {
        recognition.lang = recognitionLanguage();
      }

      if (voiceStatus) voiceStatus.textContent = "Language updated.";
    });

    on(voiceSettingsToggle, "click", event => {
      event.preventDefault();

      if (!voiceSettingsPanel) return;

      const opening = voiceSettingsPanel.hidden;
      voiceSettingsPanel.hidden = !opening;

      voiceSettingsToggle.setAttribute(
        "aria-expanded",
        String(opening)
      );
    });

    // =====================================
    // SPEECH RECOGNITION
    // =====================================

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.lang = recognitionLanguage();

      recognition.onstart = () => {
        isListening = true;
        recognizedText = "";
        speechError = null;

        voiceInputBtn?.classList.add("listening");

        if (voiceInputBtn) {
          voiceInputBtn.textContent = "●";
          voiceInputBtn.title = "Listening...";
        }

        if (voiceStatus) voiceStatus.textContent = "Speak now...";
      };

      recognition.onresult = event => {
        let finalText = "";
        let interimText = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;

          if (event.results[i].isFinal) {
            finalText += transcript;
          } else {
            interimText += transcript;
          }
        }

        if (finalText.trim()) {
          recognizedText += " " + finalText.trim();
        }

        if (interimText && voiceStatus) {
          voiceStatus.textContent = "Hearing: " + interimText;
        }
      };

      recognition.onerror = event => {
        speechError = event.error;

        if (!voiceStatus) return;

        if (event.error === "not-allowed") {
          voiceStatus.textContent = "Please allow microphone access.";
        } else if (event.error === "no-speech") {
          voiceStatus.textContent = "No speech detected.";
        } else {
          voiceStatus.textContent =
            "Voice recognition error: " + event.error;
        }
      };

      recognition.onend = () => {
        isListening = false;

        voiceInputBtn?.classList.remove("listening");

        if (voiceInputBtn) {
          voiceInputBtn.textContent = "🎙";
          voiceInputBtn.title = "Speak";
        }

        const spoken = recognizedText.trim();

        if (spoken && !speechError) {
          const selected = languageSelect?.value || "auto";

          lastSpeechLanguage = selected === "auto"
            ? detectTextLanguage(spoken)
            : selected;

          input.value = (input.value + " " + spoken).trim();
          input.style.height = "auto";
          input.style.height =
            Math.min(input.scrollHeight, 150) + "px";

          sendMessage({ speakReply: true });
        } else if (voiceStatus) {
          voiceStatus.textContent = "";
        }

        recognizedText = "";
      };
    } else {
      if (voiceInputBtn) {
        voiceInputBtn.disabled = true;
        voiceInputBtn.title = "Speech recognition is not supported.";
      }
    }

    on(voiceInputBtn, "click", event => {
      event.preventDefault();

      if (!recognition) {
        alert("Voice recognition is not supported in this browser.");
        return;
      }

      if (isListening) {
        recognition.stop();
        return;
      }

      stopSpeaking();
      recognizedText = "";
      speechError = null;
      recognition.lang = recognitionLanguage();

      try {
        recognition.start();
      } catch (error) {
        console.error(error);
        if (voiceStatus) {
          voiceStatus.textContent = "Could not start microphone.";
        }
      }
    });

    on(voiceOutputBtn, "click", event => {
      event.preventDefault();

      autoSpeak = !autoSpeak;

      voiceOutputBtn.classList.toggle("active", autoSpeak);
      voiceOutputBtn.textContent = autoSpeak
        ? "🔊 Voice on"
        : "🔊 Voice off";

      if (voiceStatus) {
        voiceStatus.textContent = autoSpeak
          ? "Automatic voice playback enabled."
          : "Automatic voice playback disabled.";
      }
    });

    on(stopVoiceBtn, "click", event => {
      event.preventDefault();
      stopSpeaking();
    });

    // =====================================
    // IMAGE MANAGEMENT
    // =====================================

    function clearImage() {
      selectedImage = null;

      if (imageInput) imageInput.value = "";
      if (imagePreview) imagePreview.hidden = true;
      if (previewImg) previewImg.removeAttribute("src");
    }

    function compressImage(file) {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();

        image.onload = () => {
          const maxSide = 1280;
          const scale = Math.min(
            1,
            maxSide / Math.max(image.width, image.height)
          );

          const canvas = document.createElement("canvas");
          canvas.width = Math.round(image.width * scale);
          canvas.height = Math.round(image.height * scale);

          const context = canvas.getContext("2d");

          if (!context) {
            URL.revokeObjectURL(url);
            reject(new Error("Image processing failed."));
            return;
          }

          context.drawImage(
            image,
            0,
            0,
            canvas.width,
            canvas.height
          );

          URL.revokeObjectURL(url);

          const dataUrl = canvas.toDataURL("image/jpeg", 0.75);

          resolve({
            data: dataUrl.split(",")[1],
            mimeType: "image/jpeg",
            preview: dataUrl
          });
        };

        image.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("Could not read this image."));
        };

        image.src = url;
      });
    }

    on(attachBtn, "click", event => {
      event.preventDefault();
      imageInput?.click();
    });

    on(imageInput, "change", async () => {
      const file = imageInput.files?.[0];
      if (!file) return;

      const allowed = [
        "image/jpeg",
        "image/png",
        "image/webp"
      ];

      if (!allowed.includes(file.type)) {
        alert("Choose a JPG, PNG or WEBP image.");
        clearImage();
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        alert("Choose an image smaller than 10 MB.");
        clearImage();
        return;
      }

      try {
        attachBtn && (attachBtn.disabled = true);

        selectedImage = await compressImage(file);

        if (previewImg) previewImg.src = selectedImage.preview;
        if (imagePreview) imagePreview.hidden = false;
      } catch (error) {
        alert("Could not load image: " + error.message);
        clearImage();
      } finally {
        if (attachBtn) attachBtn.disabled = false;
      }
    });

    on(removeImageBtn, "click", event => {
      event.preventDefault();
      clearImage();
    });

    // =====================================
    // SEND MESSAGE
    // =====================================

    async function sendMessage({ speakReply = false } = {}) {
      if (isSending) return;

      const text = input.value.trim();

      if (!text && !selectedImage) return;

      isSending = true;

      const imageToSend = selectedImage;
      const messageText = text || "Please analyze this image.";

      let loading = null;

      try {
        const { data, error } = await supabaseClient.auth.getSession();

        if (error) throw error;

        const session = data.session;

        if (!session) {
          addMessage(
            "Please sign in with Google before using MY AI.",
            "assistant"
          );

          if (loginBtn) loginBtn.hidden = false;
          return;
        }

        input.disabled = true;
        sendBtn.disabled = true;

        if (attachBtn) attachBtn.disabled = true;
        if (voiceInputBtn) voiceInputBtn.disabled = true;

        await ensureActiveConversation(messageText);

        const userMessage = {
          role: "user",
          content: messageText,
          imagePreview: imageToSend?.preview || null,
          sentToModel: false,
          timestamp: Date.now()
        };

        await storeMessage(userMessage);

        addMessage(
          messageText,
          "user",
          imageToSend?.preview || null
        );

        input.value = "";
        input.style.height = "auto";
        clearImage();

        loading = addMessage("Thinking...", "assistant");

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + session.access_token
          },
          body: JSON.stringify({
            message: messageText,
            history,
            image: imageToSend
              ? {
                  data: imageToSend.data,
                  mimeType: imageToSend.mimeType
                }
              : null
          })
        });

        let result;

        try {
          result = await response.json();
        } catch {
          throw new Error(
            "Invalid server response. Check the /api/chat endpoint."
          );
        }

        if (!response.ok) {
          throw new Error(
            result.error || "Server error: " + response.status
          );
        }

        if (!result.reply) {
          throw new Error("The server returned an empty response.");
        }

        loading.textContent = result.reply;
        await renderMath(loading);

        userMessage.sentToModel = true;

        const assistantMessage = {
          role: "assistant",
          content: result.reply,
          sentToModel: true,
          timestamp: Date.now()
        };

        activeConversation.messages.push(assistantMessage);
        activeConversation.updatedAt = Date.now();

        history.push(
          { role: "user", content: messageText },
          { role: "assistant", content: result.reply }
        );

        await saveConversation(activeConversation);
        await renderConversationList();

        if (speakReply || autoSpeak) {
          let language = currentLanguage();

          if (languageSelect?.value === "auto") {
            language =
              lastSpeechLanguage || detectTextLanguage(result.reply);
          }

          speakText(result.reply, language);
        }
      } catch (error) {
        console.error("MY AI chat error:", error);

        if (loading) {
          loading.textContent = "Connection error: " + error.message;
        } else {
          addMessage(
            "Connection error: " + error.message,
            "assistant"
          );
        }

        if (activeConversation) {
          try {
            await saveConversation(activeConversation);
            await renderConversationList();
          } catch (saveError) {
            console.error("Conversation save error:", saveError);
          }
        }
      } finally {
        isSending = false;

        input.disabled = false;
        sendBtn.disabled = false;

        if (attachBtn) attachBtn.disabled = false;
        if (voiceInputBtn) {
          voiceInputBtn.disabled = !recognition;
        }

        input.focus();
        messages.scrollTop = messages.scrollHeight;
      }
    }

    // =====================================
    // SEND BUTTON + FORM
    // =====================================

    on(sendBtn, "click", event => {
      event.preventDefault();
      event.stopPropagation();
      sendMessage();
    });

    on(form, "submit", event => {
      event.preventDefault();
      event.stopPropagation();
      sendMessage();
    });

    // =====================================
    // TEXTAREA
    // =====================================

    on(input, "input", () => {
      input.style.height = "auto";
      input.style.height =
        Math.min(input.scrollHeight, 150) + "px";
    });

    on(input, "keydown", event => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    });

    // =====================================
    // WELCOME SUGGESTIONS
    // =====================================

    on(messages, "click", event => {
      const suggestion = event.target.closest(".suggestion");
      if (!suggestion) return;

      event.preventDefault();

      input.value = suggestion.dataset.prompt || "";
      input.focus();

      input.style.height = "auto";
      input.style.height =
        Math.min(input.scrollHeight, 150) + "px";
    });

    // =====================================
    // INITIALIZATION
    // =====================================

    createHistoryInterface();
    showWelcome();

    updateAccount();

    console.info("MY AI initialized successfully.");
  }

  // =====================================
  // SAFE START
  // =====================================

  function start() {
    try {
      initializeMYAI();
    } catch (error) {
      console.error("MY AI initialization failed:", error);
      alert("MY AI initialization error: " + error.message);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, {
      once: true
    });
  } else {
    start();
  }
})();
