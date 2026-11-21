JavaScript

"use strict";

// =====================================
// MY AI — CONFIGURATION
// =====================================

const SUPABASE_URL = "https://qxmmrlbhgmuhpityezvh.supabase.co";
const SUPABASE_KEY = "sb_publishable_a2bgpHM81IQK21ewBAtJsQ_gk2Y6uMK";

const $ = id => document.getElementById(id);

function required(id) {
  const element = $(id);
  if (!element) {
    console.error(`MY AI: Missing HTML element #${id}`);
  }
  return element;
}

if (!window.supabase) {
  alert("Supabase could not load. Please refresh the page.");
  throw new Error("Supabase SDK missing");
}

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// =====================================
// DOM ELEMENTS
// =====================================

const form = required("chat-form");
const input = required("message-input");
const messages = required("chat-messages");
const sendBtn = required("send-btn");
const newChatBtn = required("new-chat-btn");

const imageInput = required("image-input");
const attachBtn = required("attach-btn");
const preview = required("image-preview");
const previewImg = required("preview-img");
const removeImageBtn = required("remove-image");

const loginButton = required("google-login");
const logoutButton = required("google-logout");
const creditsDisplay = required("credits-display");
const accountEmail = required("account-email");

const sidebar = required("main-sidebar");
const sidebarOverlay = required("sidebar-overlay");
const openSidebarBtn = required("open-sidebar");
const closeSidebarBtn = required("close-sidebar");
const sidebarAccountEmail = required("sidebar-account-email");

const settingsBtn = required("open-settings");
const aboutBtn = required("open-about");
const aboutModal = required("about-modal");
const closeAboutBtn = required("close-about");
const personalAccountBtn = required("personal-account");

const voiceInputBtn = required("voice-input-btn");
const voiceOutputBtn = required("voice-output-btn");
const stopVoiceBtn = required("stop-voice-btn");
const voiceStatus = required("voice-status");

const languageSelect = required("voice-language");
const voiceSelect = required("voice-choice");
const previewVoiceBtn = required("preview-voice-btn");

const voiceSettingsToggle = required("voice-settings-toggle");
const voiceSettingsPanel = required("voice-settings-panel");

const elements = [
  form, input, messages, sendBtn, newChatBtn,
  imageInput, attachBtn, preview, previewImg,
  removeImageBtn, loginButton, logoutButton,
  creditsDisplay, accountEmail, sidebar,
  sidebarOverlay, openSidebarBtn, closeSidebarBtn,
  sidebarAccountEmail, settingsBtn, aboutBtn,
  aboutModal, closeAboutBtn, personalAccountBtn,
  voiceInputBtn, voiceOutputBtn, stopVoiceBtn,
  voiceStatus, languageSelect, voiceSelect,
  previewVoiceBtn, voiceSettingsToggle,
  voiceSettingsPanel
];

if (elements.some(element => !element)) {
  console.error(
    "MY AI: Some HTML elements are missing. Check index.html."
  );
}

// =====================================
// MAIN VARIABLES
// =====================================

let history = [];
let selectedImage = null;
let currentSession = null;

let autoSpeak = false;
let recognition = null;
let isListening = false;
let recognizedText = "";
let speechError = null;
let lastSpeechLanguage = null;

let activeOwnerId = null;
let activeConversation = null;
let localDB = null;
let isSending = false;

// =====================================
// SAFE EVENT LISTENERS
// =====================================

function on(element, event, callback) {
  if (element) {
    element.addEventListener(event, callback);
  }
}

// =====================================
// SIDEBAR
// =====================================

function openSidebar() {
  if (!sidebar || !sidebarOverlay) return;

  sidebar.classList.add("sidebar-open");
  sidebarOverlay.classList.add("overlay-visible");
  document.body.style.overflow = "hidden";
}

function closeSidebar() {
  if (!sidebar || !sidebarOverlay) return;

  sidebar.classList.remove("sidebar-open");
  sidebarOverlay.classList.remove("overlay-visible");
  document.body.style.overflow = "";
}

on(openSidebarBtn, "click", openSidebar);
on(closeSidebarBtn, "click", closeSidebar);
on(sidebarOverlay, "click", closeSidebar);

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeSidebar();

    if (aboutModal) aboutModal.hidden = true;

    if (voiceSettingsPanel) {
      voiceSettingsPanel.hidden = true;
      voiceSettingsToggle?.setAttribute("aria-expanded", "false");
    }
  }
});

// Swipe gestures

let touchStartX = 0;
let touchStartY = 0;

document.addEventListener("touchstart", event => {
  if (!event.changedTouches.length) return;

  touchStartX = event.changedTouches[0].screenX;
  touchStartY = event.changedTouches[0].screenY;
}, { passive: true });

document.addEventListener("touchend", event => {
  if (!event.changedTouches.length) return;

  const endX = event.changedTouches[0].screenX;
  const endY = event.changedTouches[0].screenY;

  const dx = endX - touchStartX;
  const dy = endY - touchStartY;

  if (Math.abs(dx) < 75 || Math.abs(dx) < Math.abs(dy) * 1.3) {
    return;
  }

  if (dx > 0 && touchStartX < 35) {
    openSidebar();
  }

  if (dx < 0 && sidebar?.classList.contains("sidebar-open")) {
    closeSidebar();
  }
}, { passive: true });

// =====================================
// LOCAL DATABASE — INDEXEDDB
// =====================================

const DB_NAME = "MY_AI_LOCAL_DATABASE";
const DB_VERSION = 1;
const STORE_NAME = "conversations";

function openLocalDatabase() {
  return new Promise((resolve, reject) => {
    if (localDB) {
      resolve(localDB);
      return;
    }

    if (!window.indexedDB) {
      reject(new Error("Local storage is not supported."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

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

      localDB.onversionchange = () => {
        localDB.close();
        localDB = null;
      };

      resolve(localDB);
    };

    request.onerror = () => {
      reject(request.error || new Error("Database error"));
    };
  });
}

async function saveConversation(conversation) {
  const db = await openLocalDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");

    transaction.objectStore(STORE_NAME).put(conversation);

    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function getConversations(ownerId) {
  const db = await openLocalDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");

    const request = transaction
      .objectStore(STORE_NAME)
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
  const db = await openLocalDatabase();

  return new Promise((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .get(id);

    request.onsuccess = () => {
      const result = request.result;

      resolve(
        result && result.ownerId === ownerId
          ? result
          : null
      );
    };

    request.onerror = () => reject(request.error);
  });
}

async function removeConversation(id, ownerId) {
  const conversation = await getConversation(id, ownerId);
  if (!conversation) return;

  const db = await openLocalDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");

    transaction.objectStore(STORE_NAME).delete(id);

    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function removeAllConversations(ownerId) {
  const conversations = await getConversations(ownerId);

  for (const conversation of conversations) {
    await removeConversation(conversation.id, ownerId);
  }
}

function createConversation(ownerId, firstMessage) {
  const now = Date.now();

  return {
    id: crypto.randomUUID(),
    ownerId,
    title: firstMessage.slice(0, 45) || "New chat",
    createdAt: now,
    updatedAt: now,
    messages: []
  };
}

// =====================================
// CHAT HISTORY
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
    const deleteButton = event.target.closest(".myai-history-delete");

    if (deleteButton) {
      event.stopPropagation();

      const id = deleteButton.dataset.id;

      if (!confirm("Delete this conversation?")) return;

      try {
        await removeConversation(id, activeOwnerId);

        if (activeConversation?.id === id) {
          startNewChat();
        }

        await renderConversationList();
      } catch (error) {
        console.error(error);
        alert("Could not delete this conversation.");
      }

      return;
    }

    const item = event.target.closest(".myai-history-item");

    if (item) {
      await openConversation(item.dataset.id);
      closeSidebar();
    }
  });

  const deleteAll = $("myai-delete-all");

  on(deleteAll, "click", async () => {
    if (!activeOwnerId) return;

    if (!confirm("Delete all your saved conversations?")) return;

    try {
      await removeAllConversations(activeOwnerId);
      startNewChat();
      await renderConversationList();
    } catch (error) {
      console.error(error);
      alert("Could not delete conversations.");
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

      if (activeConversation?.id === conversation.id) {
        item.classList.add("active");
      }

      item.dataset.id = conversation.id;

      const title = document.createElement("span");
      title.className = "myai-history-title";
      title.textContent = "▤  " + conversation.title;

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "myai-history-delete";
      deleteButton.dataset.id = conversation.id;
      deleteButton.textContent = "×";
      deleteButton.title = "Delete conversation";

      item.append(title, deleteButton);
      list.appendChild(item);
    });

  } catch (error) {
    console.error("History loading error:", error);
    list.innerHTML =
      '<div class="myai-history-empty">Could not load conversations</div>';
  }
}

// =====================================
// CONVERSATION MANAGEMENT
// =====================================

async function ensureActiveConversation(firstMessage) {
  if (activeConversation && activeConversation.ownerId === activeOwnerId) {
    return activeConversation;
  }

  if (!activeOwnerId) {
    throw new Error("Please sign in first.");
  }

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
  if (!activeOwnerId || !messages) return;

  try {
    const conversation = await getConversation(id, activeOwnerId);
    if (!conversation) return;

    stopSpeaking();

    if (isListening && recognition) {
      recognition.stop();
    }

    clearImage();
    activeConversation = conversation;

    history = conversation.messages
      .filter(message => message.sentToModel)
      .filter(message =>
        message.role === "user" || message.role === "assistant"
      )
      .map(message => ({
        role: message.role,
        content: message.content
      }));

    messages.innerHTML = "";

    if (!conversation.messages.length) {
      showWelcome();
    } else {
      conversation.messages.forEach(message => {
        const element = addMessage(
          message.content,
          message.role,
          message.imagePreview || null
        );

        if (message.role === "assistant") {
          renderMath(element);
        }
      });
    }

    await renderConversationList();

  } catch (error) {
    console.error(error);
    alert("Could not open this conversation.");
  }
}

function startNewChat() {
  history = [];
  activeConversation = null;

  stopSpeaking();

  if (isListening && recognition) {
    recognition.stop();
  }

  clearImage();
  showWelcome();

  if (input) {
    input.value = "";
    input.style.height = "auto";
  }

  if (voiceSettingsPanel) {
    voiceSettingsPanel.hidden = true;
  }

  voiceSettingsToggle?.setAttribute("aria-expanded", "false");

  renderConversationList();
  closeSidebar();
  input?.focus();
}

// =====================================
// SIDEBAR ACTIONS
// =====================================

on(newChatBtn, "click", startNewChat);

on(settingsBtn, "click", () => {
  closeSidebar();

  if (!voiceSettingsPanel) return;

  voiceSettingsPanel.hidden = false;
  voiceSettingsToggle?.setAttribute("aria-expanded", "true");

  voiceSettingsPanel.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
});

on(aboutBtn, "click", () => {
  closeSidebar();
  if (aboutModal) aboutModal.hidden = false;
});

on(closeAboutBtn, "click", () => {
  if (aboutModal) aboutModal.hidden = true;
});

on(aboutModal, "click", event => {
  if (event.target === aboutModal) {
    aboutModal.hidden = true;
  }
});

on(personalAccountBtn, "click", async () => {
  closeSidebar();

  if (currentSession) {
    const confirmed = confirm(
      "You are signed in as " +
      (currentSession.user.email || "your account") +
      ". Do you want to sign out?"
    );

    if (confirmed) logoutButton?.click();
  } else {
    loginButton?.click();
  }
});

// =====================================
// VOICE SETTINGS PANEL
// =====================================

on(voiceSettingsToggle, "click", () => {
  if (!voiceSettingsPanel) return;

  const isOpen = !voiceSettingsPanel.hidden;

  voiceSettingsPanel.hidden = isOpen;
  voiceSettingsToggle.setAttribute("aria-expanded", String(!isOpen));
});

document.addEventListener("click", event => {
  if (!voiceSettingsPanel || !voiceSettingsToggle) return;

  const clickedInside =
    voiceSettingsPanel.contains(event.target) ||
    voiceSettingsToggle.contains(event.target);

  if (!clickedInside && !voiceSettingsPanel.hidden) {
    voiceSettingsPanel.hidden = true;
    voiceSettingsToggle.setAttribute("aria-expanded", "false");
  }
});

// =====================================
// LANGUAGE CONFIGURATION
// =====================================

const LANGUAGE_CONFIG = {
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

function getBrowserLanguage() {
  const lang = (navigator.language || "en-US").toLowerCase();

  if (lang.startsWith("ar")) return "ar";
  if (lang.startsWith("fr")) return "fr";
  if (lang.startsWith("es")) return "es";

  return "en";
}

function getCurrentLanguage() {
  const selected = languageSelect?.value || "auto";

  if (selected === "auto") {
    return lastSpeechLanguage || getBrowserLanguage();
  }

  return selected;
}

function getSpeechLanguage(language) {
  if (language === "auto") {
    language = getCurrentLanguage();
  }

  return LANGUAGE_CONFIG[language] || LANGUAGE_CONFIG.en;
}

function getRecognitionLanguage() {
  const selected = languageSelect?.value || "auto";

  if (selected === "auto") {
    return getSpeechLanguage(getBrowserLanguage()).recognition;
  }

  return getSpeechLanguage(selected).recognition;
}

function detectTextLanguage(text) {
  if (/[\u0600-\u06FF]/.test(text)) return "ar";

  const value = " " + text.toLowerCase() + " ";

  const frenchWords = [
    " le ", " la ", " les ", " une ", " des ", " je ",
    " vous ", " bonjour ", " merci ", " pourquoi ", " comment "
  ];

  const spanishWords = [
    " el ", " la ", " los ", " las ", " una ", " que ",
    " hola ", " gracias ", " como ", " porque ", " buenos "
  ];

  const frenchScore = frenchWords.filter(w => value.includes(w)).length;
  const spanishScore = spanishWords.filter(w => value.includes(w)).length;

  if (frenchScore > spanishScore && frenchScore > 0) return "fr";
  if (spanishScore > frenchScore && spanishScore > 0) return "es";

  return "en";
}

// =====================================
// ACCOUNT MANAGEMENT
// =====================================

async function updateAccount(session = undefined) {
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

      if (loginButton) loginButton.hidden = false;
      if (logoutButton) logoutButton.hidden = true;

      if (accountEmail) accountEmail.textContent = "";
      if (sidebarAccountEmail) {
        sidebarAccountEmail.textContent = "Not signed in";
      }

      if (creditsDisplay) creditsDisplay.textContent = "Credits: --";

      showWelcome();
      await renderConversationList();
      return;
    }

    const newOwnerId = session.user.id;

    if (activeOwnerId !== newOwnerId) {
      activeOwnerId = newOwnerId;
      activeConversation = null;
      history = [];
      showWelcome();
    }

    if (loginButton) loginButton.hidden = true;
    if (logoutButton) logoutButton.hidden = false;

    if (accountEmail) {
      accountEmail.textContent = session.user.email || "Signed in";
    }

    if (sidebarAccountEmail) {
      sidebarAccountEmail.textContent = session.user.email || "Signed in";
    }

    if (creditsDisplay) creditsDisplay.textContent = "Credits: ...";

    await renderConversationList();

    const { data: profile, error } = await supabaseClient
      .from("profiles")
      .select("credits")
      .eq("id", session.user.id)
      .single();

    if (error) {
      console.error("Profile error:", error.message);
      if (creditsDisplay) {
        creditsDisplay.textContent = "Credits unavailable";
      }
      return;
    }

    if (creditsDisplay) {
      creditsDisplay.textContent = "Credits: " + profile.credits;
    }

  } catch (error) {
    console.error("Account error:", error);
    if (creditsDisplay) {
      creditsDisplay.textContent = "Credits unavailable";
    }
  }
}

// =====================================
// GOOGLE LOGIN
// =====================================

on(loginButton, "click", async () => {
  loginButton.disabled = true;
  loginButton.textContent = "Connecting...";

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
    loginButton.disabled = false;
    loginButton.textContent = "Sign in with Google";
  }
});

// =====================================
// GOOGLE LOGOUT
// =====================================

on(logoutButton, "click", async () => {
  logoutButton.disabled = true;

  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;

    stopSpeaking();
    await updateAccount(null);

  } catch (error) {
    alert("Logout error: " + error.message);

  } finally {
    logoutButton.disabled = false;
  }
});

// =====================================
// AUTH STATE
// =====================================

supabaseClient.auth.onAuthStateChange((event, session) => {
  currentSession = session;
  setTimeout(() => updateAccount(session), 0);
});

createHistoryInterface();
updateAccount();

// =====================================
// ADD MESSAGE
// =====================================

function addMessage(text, type, imageUrl = null) {
  if (!messages) return null;

  const welcome = $("welcome");
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
// VOICE — AVAILABLE VOICES
// =====================================

function getDeviceVoices() {
  if (!("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices();
}

function refreshVoiceList() {
  if (!voiceSelect) return;

  const voices = getDeviceVoices();
  const language = getCurrentLanguage();
  const config = getSpeechLanguage(language);

  const matching = voices.filter(voice =>
    voice.lang.toLowerCase().startsWith(config.fallback.toLowerCase())
  );

  voiceSelect.innerHTML = "";

  if (!voices.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No voices found on this device";
    voiceSelect.appendChild(option);
    return;
  }

  const available = matching.length ? matching : voices;

  const automaticOption = document.createElement("option");
  automaticOption.value = "default";
  automaticOption.textContent = matching.length
    ? "Automatic — recommended"
    : "Automatic — device default";

  voiceSelect.appendChild(automaticOption);

  available.forEach(voice => {
    const option = document.createElement("option");

    // Keep the real voice object index.
    option.value = String(voices.indexOf(voice));
    option.textContent = voice.name + " (" + voice.lang + ")";

    voiceSelect.appendChild(option);
  });
}

function getSelectedDeviceVoice() {
  const value = voiceSelect?.value;

  if (!value || value === "default") return null;

  const voices = getDeviceVoices();
  return voices[Number(value)] || null;
}

if ("speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = refreshVoiceList;
  refreshVoiceList();
  setTimeout(refreshVoiceList, 500);
} else if (voiceSelect) {
  voiceSelect.innerHTML = "<option>Speech not supported</option>";
  if (previewVoiceBtn) previewVoiceBtn.disabled = true;
}

// =====================================
// VOICE — TEXT TO SPEECH
// =====================================

function cleanTextForSpeech(text) {
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

function speakText(text, languageOverride = null) {
  if (!("speechSynthesis" in window)) {
    if (voiceStatus) {
      voiceStatus.textContent = "Voice playback is not supported.";
    }
    return;
  }

  const cleanText = cleanTextForSpeech(text);
  if (!cleanText) return;

  stopSpeaking();

  const language = languageOverride || getCurrentLanguage();
  const config = getSpeechLanguage(language);

  const utterance = new SpeechSynthesisUtterance(cleanText);

  utterance.lang = config.speech;
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.volume = 1;

  const voice = getSelectedDeviceVoice();

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

  utterance.onerror = event => {
    console.error("Speech error:", event.error);
    if (voiceStatus) {
      voiceStatus.textContent = "Voice playback unavailable.";
    }
    if (stopVoiceBtn) stopVoiceBtn.hidden = true;
  };

  window.speechSynthesis.speak(utterance);
}

function stopSpeaking() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  if (stopVoiceBtn) stopVoiceBtn.hidden = true;
}

// =====================================
// VOICE PREVIEW
// =====================================

on(previewVoiceBtn, "click", () => {
  const language = getCurrentLanguage();
  const sample = LANGUAGE_SAMPLES[language] || LANGUAGE_SAMPLES.en;

  speakText(sample, language);
});

// =====================================
// LANGUAGE SETTINGS
// =====================================

try {
  const savedLanguage = localStorage.getItem("myai_voice_language");

  if (
    (savedLanguage && LANGUAGE_CONFIG[savedLanguage]) ||
    savedLanguage === "auto"
  ) {
    languageSelect.value = savedLanguage;
  }
} catch (error) {
  console.warn("Could not read saved language preference.");
}

on(languageSelect, "change", () => {
  if (isListening && recognition) recognition.stop();

  stopSpeaking();

  try {
    localStorage.setItem("myai_voice_language", languageSelect.value);
  } catch (error) {
    console.warn("Could not save language preference.");
  }

  if (languageSelect.value !== "auto") {
    lastSpeechLanguage = languageSelect.value;
  }

  refreshVoiceList();

  if (recognition) {
    recognition.lang = getRecognitionLanguage();
  }

  if (voiceStatus) voiceStatus.textContent = "Language updated.";
});

// =====================================
// VOICE — SPEECH TO TEXT
// =====================================

const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();

  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.lang = getRecognitionLanguage();

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
    let finalTranscript = "";
    let interimTranscript = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;

      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    if (finalTranscript.trim()) {
      recognizedText += " " + finalTranscript.trim();
    }

    if (interimTranscript && voiceStatus) {
      voiceStatus.textContent = "Hearing: " + interimTranscript;
    }
  };

  recognition.onerror = event => {
    speechError = event.error;
    console.error("Recognition error:", event.error);

    if (!voiceStatus) return;

    if (event.error === "not-allowed") {
      voiceStatus.textContent = "Please allow microphone access.";
    } else if (event.error === "no-speech") {
      voiceStatus.textContent = "No speech detected.";
    } else {
      voiceStatus.textContent = "Voice recognition error: " + event.error;
    }
  };

  recognition.onend = () => {
    isListening = false;

    voiceInputBtn?.classList.remove("listening");

    if (voiceInputBtn) {
      voiceInputBtn.textContent = "🎙";
      voiceInputBtn.title = "Speak";
    }

    const spokenText = recognizedText.trim();

    if (spokenText && !speechError) {
      const selectedLanguage = languageSelect.value;

      lastSpeechLanguage = selectedLanguage === "auto"
        ? detectTextLanguage(spokenText)
        : selectedLanguage;

      input.value = (input.value + " " + spokenText).trim();
      input.style.height = "auto";
      input.style.height =
        Math.min(input.scrollHeight, 150) + "px";

      if (voiceStatus) {
        voiceStatus.textContent = "Sending your message...";
      }

      sendMessage({ speakReply: true });

    } else if (!speechError && voiceStatus) {
      voiceStatus.textContent = "";
    }

    recognizedText = "";
  };

} else {
  if (voiceInputBtn) {
    voiceInputBtn.disabled = true;
    voiceInputBtn.title = "Speech recognition is not supported.";
  }

  if (voiceStatus) {
    voiceStatus.textContent =
      "Voice input is not supported in this browser.";
  }
}

// =====================================
// VOICE BUTTONS
// =====================================

on(voiceInputBtn, "click", () => {
  if (!recognition) {
    alert("Voice recognition is not supported. Try Chrome.");
    return;
  }

  if (isListening) {
    recognition.stop();
    return;
  }

  stopSpeaking();
  recognizedText = "";
  speechError = null;

  recognition.lang = getRecognitionLanguage();

  try {
    recognition.start();
  } catch (error) {
    console.error(error);
    if (voiceStatus) {
      voiceStatus.textContent = "Could not start microphone. Try again.";
    }
  }
});

on(voiceOutputBtn, "click", () => {
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

on(stopVoiceBtn, "click", stopSpeaking);

// =====================================
// IMAGE MANAGEMENT
// =====================================

function clearImage() {
  selectedImage = null;

  if (imageInput) imageInput.value = "";
  if (preview) preview.hidden = true;
  if (previewImg) previewImg.removeAttribute("src");
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

      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Image processing failed"));
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
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

// =====================================
// SELECT IMAGE
// =====================================

on(attachBtn, "click", () => {
  imageInput?.click();
});

on(imageInput, "change", async () => {
  const file = imageInput.files?.[0];
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
    console.error(error);
    alert("Could not load this image.");
    clearImage();

  } finally {
    attachBtn.disabled = false;
  }
});

on(removeImageBtn, "click", clearImage);

// =====================================
// SEND MESSAGE
// =====================================

async function sendMessage({ speakReply = false } = {}) {
  if (isSending) return;

  const text = input.value.trim();

  if ((!text && !selectedImage) || !sendBtn) return;

  isSending = true;

  const imageToSend = selectedImage;
  const messageText = text || "Please analyze this image.";

  let loading = null;
  let userMessage = null;

  try {
    const { data: sessionData, error: sessionError } =
      await supabaseClient.auth.getSession();

    if (sessionError) throw sessionError;

    if (!sessionData.session) {
      addMessage(
        "Please sign in with Google before using MY AI.",
        "assistant"
      );

      if (loginButton) loginButton.hidden = false;
      return;
    }

    const session = sessionData.session;

    input.disabled = true;
    sendBtn.disabled = true;
    attachBtn.disabled = true;
    voiceInputBtn.disabled = true;

    await ensureActiveConversation(messageText);

    userMessage = {
      role: "user",
      content: messageText,
      imagePreview: imageToSend ? imageToSend.preview : null,
      sentToModel: false,
      timestamp: Date.now()
    };

    await storeMessage(userMessage);

    addMessage(
      messageText,
      "user",
      imageToSend ? imageToSend.preview : null
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
        history: history,
        image: imageToSend
          ? {
              data: imageToSend.data,
              mimeType: imageToSend.mimeType
            }
          : null
      })
    });

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error("Invalid server response.");
    }

    if (!response.ok) {
      throw new Error(data.error || "Server error");
    }

    if (!data.reply) {
      throw new Error("Empty response");
    }

    loading.textContent = data.reply;
    await renderMath(loading);

    userMessage.sentToModel = true;

    const assistantMessage = {
      role: "assistant",
      content: data.reply,
      sentToModel: true,
      timestamp: Date.now()
    };

    activeConversation.messages.push(assistantMessage);
    activeConversation.updatedAt = Date.now();

    history.push(
      { role: "user", content: messageText },
      { role: "assistant", content: data.reply }
    );

    await saveConversation(activeConversation);
    await renderConversationList();

    if (speakReply || autoSpeak) {
      let language = getCurrentLanguage();

      if (languageSelect.value === "auto") {
        language = lastSpeechLanguage || detectTextLanguage(data.reply);
      }

      speakText(data.reply, language);
    }

  } catch (error) {
    console.error("Chat error:", error);

    if (loading) {
      loading.textContent = "Connection error: " + error.message;
    } else {
      addMessage("Connection error: " + error.message, "assistant");
    }

    if (activeConversation) {
      activeConversation.updatedAt = Date.now();

      try {
        await saveConversation(activeConversation);
        await renderConversationList();
      } catch (saveError) {
        console.error("Could not save conversation:", saveError);
      }
    }

  } finally {
    isSending = false;

    if (input) input.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
    if (attachBtn) attachBtn.disabled = false;
    if (voiceInputBtn) voiceInputBtn.disabled = !recognition;

    input?.focus();

    if (messages) {
      messages.scrollTop = messages.scrollHeight;
    }
  }
}

on(form, "submit", event => {
  event.preventDefault();
  sendMessage();
});

// =====================================
// TEXTAREA SIZE
// =====================================

on(input, "input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 150) + "px";
});

on(input, "keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form?.requestSubmit();
  }
});

// =====================================
// WELCOME SCREEN
// =====================================

function showWelcome() {
  if (!messages) return;

  messages.innerHTML = `
    <div class="welcome" id="welcome">

      <div class="welcome-orb">
        <div class="orb-core">M</div>
      </div>

      <div class="welcome-tag">
        YOUR PERSONAL AI
      </div>

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
// SUGGESTIONS
// =====================================

on(messages, "click", event => {
  const suggestion = event.target.closest(".suggestion");
  if (!suggestion) return;

  input.value = suggestion.dataset.prompt;
  input.focus();

  input.style.height = "auto";
  input.style.height =
    Math.min(input.scrollHeight, 150) + "px";
});

// =====================================
// SIDEBAR ACCOUNT DISPLAY
// =====================================

async function updateSidebarAccount() {
  try {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) throw error;

    const session = data.session;

    if (sidebarAccountEmail) {
      sidebarAccountEmail.textContent = session
        ? (session.user.email || "Signed in")
        : "Not signed in";
    }

  } catch (error) {
    console.error("Sidebar account error:", error);

    if (sidebarAccountEmail) {
      sidebarAccountEmail.textContent = "Account unavailable";
    }
  }
}

supabaseClient.auth.onAuthStateChange(() => {
  setTimeout(updateSidebarAccount, 0);
});

updateSidebarAccount();

// =====================================
// INITIALIZATION
// =====================================

showWelcome();

console.log("MY AI initialized successfully.");
