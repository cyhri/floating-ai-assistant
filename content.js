// Content script for Floating AI Assistant
// Runs on all pages, handles floating window injection, selection tracking, settings, and iframe relay

(function () {
  const isTopFrame = window.self === window.top;

  // --- IFRAME SUPPORT ---
  // In child frames, only monitor selections and relay to the background worker/top frame
  if (!isTopFrame) {
    document.addEventListener("selectionchange", () => {
      try {
        const sel = window.getSelection() ? window.getSelection().toString().trim() : "";
        if (sel) {
          chrome.runtime.sendMessage({ action: "iframeSelection", text: sel }).catch(() => {
            // Safe ignore if background worker or top frame is not listening
          });
        }
      } catch (err) {
        // Prevent cross-origin iframe security exceptions from bubbling
      }
    });
    return;
  }

  // Prevent multiple injections in the top frame
  if (document.getElementById("floating-ai-assistant-host")) {
    return;
  }

  // --- HOST ELEMENT & SHADOW DOM ---
  const host = document.createElement("div");
  host.id = "floating-ai-assistant-host";
  host.style.all = "initial";
  host.style.position = "fixed";
  host.style.top = "0";
  host.style.left = "0";
  host.style.width = "0";
  host.style.height = "0";
  host.style.zIndex = "2147483647";
  host.style.pointerEvents = "none";

  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    .ai-bubble {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #4f46e5;
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      pointer-events: auto;
      transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
      z-index: 2147483647;
      user-select: none;
    }

    .ai-bubble:hover {
      transform: scale(1.06);
      background: #4338ca;
      box-shadow: 0 6px 20px rgba(79, 70, 229, 0.5);
    }

    .ai-bubble.hidden {
      display: none !important;
    }

    .ai-bubble svg {
      width: 24px;
      height: 24px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .ai-window {
      position: fixed;
      width: 360px;
      height: 420px;
      min-width: 280px;
      min-height: 320px;
      max-width: 96vw;
      max-height: 96vh;
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.08);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      resize: both;
      pointer-events: auto;
      z-index: 2147483647;
      border: 1px solid rgba(0, 0, 0, 0.08);
    }

    .ai-window.hidden {
      display: none !important;
    }

    .ai-titlebar {
      height: 44px;
      background: #4f46e5;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 14px;
      cursor: move;
      user-select: none;
      flex-shrink: 0;
    }

    .ai-titlebar-title {
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.3px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .ai-titlebar-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .ai-icon-btn {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: #ffffff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.15s ease;
      padding: 0;
    }

    .ai-icon-btn:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .ai-icon-btn.active {
      background: rgba(255, 255, 255, 0.3);
    }

    .ai-icon-btn svg {
      width: 16px;
      height: 16px;
      stroke: currentColor;
      fill: none;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .ai-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 12px;
      gap: 10px;
      overflow: hidden;
      background: #fdfdfd;
      position: relative;
    }

    .ai-answer-area {
      flex: 1;
      min-height: 120px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 10px 12px;
      overflow-y: auto;
      font-size: 14px;
      line-height: 1.5;
      color: #1f2937;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .ai-answer-area.placeholder {
      color: #9ca3af;
      font-style: italic;
    }

    .ai-answer-area.error {
      color: #dc2626;
      background: #fef2f2;
      border-color: #fecaca;
    }

    .ai-answer-area.status {
      color: #6b7280;
    }

    .ai-input-area {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex-shrink: 0;
    }

    .ai-textarea {
      width: 100%;
      height: 80px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 13px;
      line-height: 1.4;
      color: #111827;
      resize: none;
      outline: none;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .ai-textarea:focus {
      border-color: #6366f1;
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
    }

    .ai-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .ai-btn {
      padding: 7px 11px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      transition: background-color 0.15s ease, transform 0.05s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      user-select: none;
    }

    .ai-btn:active {
      transform: scale(0.98);
    }

    .ai-btn-secondary {
      background: #f3f4f6;
      color: #374151;
      border: 1px solid #e5e7eb;
    }

    .ai-btn-secondary:hover {
      background: #e5e7eb;
      color: #111827;
    }

    .ai-btn-primary {
      background: #4f46e5;
      color: #ffffff;
      margin-left: auto;
      min-width: 68px;
    }

    .ai-btn-primary:hover {
      background: #4338ca;
    }

    .ai-btn-primary:disabled {
      background: #a5b4fc;
      cursor: not-allowed;
      transform: none;
    }

    /* Settings Panel */
    .ai-settings-panel {
      position: absolute;
      top: 44px;
      left: 0;
      right: 0;
      bottom: 0;
      background: #ffffff;
      z-index: 10;
      display: flex;
      flex-direction: column;
      padding: 16px;
      gap: 12px;
      overflow-y: auto;
    }

    .ai-settings-panel.hidden {
      display: none !important;
    }

    .ai-settings-title {
      font-size: 15px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 2px;
    }

    .ai-field {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .ai-label {
      font-size: 12px;
      font-weight: 600;
      color: #374151;
    }

    .ai-input {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 13px;
      color: #111827;
      outline: none;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .ai-input:focus {
      border-color: #6366f1;
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
    }

    .ai-hint {
      font-size: 11px;
      color: #6b7280;
      line-height: 1.4;
    }

    .ai-settings-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
    }

    .ai-settings-status {
      font-size: 12px;
      min-height: 16px;
    }

    .ai-settings-status.success {
      color: #059669;
    }

    .ai-settings-status.error {
      color: #dc2626;
    }
  `;

  const container = document.createElement("div");
  container.innerHTML = `
    <!-- Bubble button -->
    <div class="ai-bubble" id="aiBubble" title="Open AI Assistant (Alt+Shift+Q)">
      <svg viewBox="0 0 24 24">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
      </svg>
    </div>

    <!-- Floating Window -->
    <div class="ai-window hidden" id="aiWindow">
      <div class="ai-titlebar" id="aiTitlebar">
        <div class="ai-titlebar-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a10 10 0 1 0 10 10H12V2z"></path>
            <path d="M12 12 2.1 10.5"></path>
            <path d="M12 12V2a10 10 0 0 1 10 10"></path>
          </svg>
          <span>AI Assistant</span>
        </div>
        <div class="ai-titlebar-actions">
          <button class="ai-icon-btn" id="aiSettingsBtn" title="Settings" type="button">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
          <button class="ai-icon-btn" id="aiCloseBtn" title="Close" type="button">
            <svg viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <div class="ai-body">
        <div class="ai-answer-area placeholder" id="aiAnswerArea">Answers and reasoning will appear here.</div>

        <div class="ai-input-area">
          <textarea class="ai-textarea" id="aiPromptInput" placeholder="Type or select a question to ask..."></textarea>
          <div class="ai-actions">
            <button class="ai-btn ai-btn-secondary" id="aiBtnUseSelection" type="button">Use selection</button>
            <button class="ai-btn ai-btn-secondary" id="aiBtnReadPage" type="button">Read page</button>
            <button class="ai-btn ai-btn-primary" id="aiBtnAsk" type="button">Ask</button>
          </div>
        </div>
      </div>

      <!-- Settings Panel -->
      <div class="ai-settings-panel hidden" id="aiSettingsPanel">
        <div class="ai-settings-title">Configuration</div>

        <div class="ai-field">
          <label class="ai-label" for="aiApiKeyInput">Gemini API Key</label>
          <input
            class="ai-input"
            type="password"
            id="aiApiKeyInput"
            placeholder="Enter your Gemini API key"
            autocomplete="off"
            spellcheck="false"
          />
          <span class="ai-hint">Get a free key from Google AI Studio (aistudio.google.com).</span>
        </div>

        <div class="ai-field">
          <label class="ai-label" for="aiModelInput">Model Name</label>
          <input
            class="ai-input"
            type="text"
            id="aiModelInput"
            placeholder="gemini-2.5-flash"
            autocomplete="off"
            spellcheck="false"
          />
          <span class="ai-hint">Default: gemini-2.5-flash</span>
        </div>

        <div class="ai-settings-actions">
          <button class="ai-btn ai-btn-primary" id="aiBtnSaveSettings" type="button">Save</button>
          <button class="ai-btn ai-btn-secondary" id="aiBtnCancelSettings" type="button">Cancel</button>
        </div>

        <div class="ai-settings-status" id="aiSettingsStatus"></div>
      </div>
    </div>
  `;

  shadow.appendChild(style);
  shadow.appendChild(container);

  if (document.body) {
    document.body.appendChild(host);
  } else {
    document.documentElement.appendChild(host);
  }

  // DOM references
  const bubble = shadow.getElementById("aiBubble");
  const win = shadow.getElementById("aiWindow");
  const titlebar = shadow.getElementById("aiTitlebar");
  const closeBtn = shadow.getElementById("aiCloseBtn");
  const settingsBtn = shadow.getElementById("aiSettingsBtn");
  const settingsPanel = shadow.getElementById("aiSettingsPanel");
  const apiKeyInput = shadow.getElementById("aiApiKeyInput");
  const modelInput = shadow.getElementById("aiModelInput");
  const btnSaveSettings = shadow.getElementById("aiBtnSaveSettings");
  const btnCancelSettings = shadow.getElementById("aiBtnCancelSettings");
  const settingsStatus = shadow.getElementById("aiSettingsStatus");
  const answerArea = shadow.getElementById("aiAnswerArea");
  const promptInput = shadow.getElementById("aiPromptInput");
  const btnUseSelection = shadow.getElementById("aiBtnUseSelection");
  const btnReadPage = shadow.getElementById("aiBtnReadPage");
  const btnAsk = shadow.getElementById("aiBtnAsk");

  // Selection tracking state
  let lastSelection = "";

  // Track selection changes in the top frame
  document.addEventListener("selectionchange", () => {
    const sel = window.getSelection() ? window.getSelection().toString().trim() : "";
    if (sel) {
      lastSelection = sel;
    }
  });

  // Listen for relayed selection and toggle command from background worker
  chrome.runtime.onMessage.addListener((message) => {
    if (!message || typeof message !== "object") return;

    if (message.action === "toggle") {
      toggleWindow();
    } else if (message.action === "updateSelection" && message.text) {
      lastSelection = message.text.trim();
    }
  });

  // Preserving page selection on button click
  btnUseSelection.addEventListener("mousedown", (e) => e.preventDefault());
  btnReadPage.addEventListener("mousedown", (e) => e.preventDefault());
  btnAsk.addEventListener("mousedown", (e) => e.preventDefault());

  // Window position & visibility state
  let isOpen = false;
  let isSettingsOpen = false;

  function openWindow() {
    isOpen = true;
    bubble.classList.add("hidden");
    win.classList.remove("hidden");

    if (!win.style.top && !win.style.left) {
      const defaultWidth = 360;
      const defaultHeight = 420;
      const margin = 24;
      const left = Math.max(12, window.innerWidth - defaultWidth - margin);
      const top = Math.max(12, window.innerHeight - defaultHeight - margin);
      win.style.left = `${left}px`;
      win.style.top = `${top}px`;
    }
  }

  function closeWindow() {
    isOpen = false;
    win.classList.add("hidden");
    bubble.classList.remove("hidden");
    closeSettings();
  }

  function toggleWindow() {
    if (isOpen) {
      closeWindow();
    } else {
      openWindow();
    }
  }

  // Settings panel toggle and storage
  function openSettings() {
    isSettingsOpen = true;
    settingsBtn.classList.add("active");
    settingsPanel.classList.remove("hidden");
    settingsStatus.textContent = "";
    settingsStatus.className = "ai-settings-status";

    // Load saved settings from chrome.storage.local
    chrome.storage.local.get(["apiKey", "model"], (data) => {
      if (chrome.runtime.lastError) {
        settingsStatus.className = "ai-settings-status error";
        settingsStatus.textContent = "Could not load settings.";
        return;
      }
      apiKeyInput.value = data && data.apiKey ? data.apiKey : "";
      modelInput.value = data && data.model ? data.model : "";
      apiKeyInput.focus();
    });
  }

  function closeSettings() {
    isSettingsOpen = false;
    settingsBtn.classList.remove("active");
    settingsPanel.classList.add("hidden");
    settingsStatus.textContent = "";
  }

  function toggleSettings() {
    if (isSettingsOpen) {
      closeSettings();
    } else {
      openSettings();
    }
  }

  settingsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleSettings();
  });

  btnCancelSettings.addEventListener("click", () => {
    closeSettings();
  });

  btnSaveSettings.addEventListener("click", () => {
    const rawApiKey = apiKeyInput.value.trim();
    const rawModel = modelInput.value.trim();
    const modelToSave = rawModel || "gemini-2.5-flash";

    chrome.storage.local.set(
      {
        apiKey: rawApiKey,
        model: modelToSave,
      },
      () => {
        if (chrome.runtime.lastError) {
          settingsStatus.className = "ai-settings-status error";
          settingsStatus.textContent = `Save failed: ${chrome.runtime.lastError.message}`;
          return;
        }

        settingsStatus.className = "ai-settings-status success";
        settingsStatus.textContent = "Settings saved successfully!";

        setTimeout(() => {
          if (isSettingsOpen) {
            closeSettings();
          }
        }, 800);
      }
    );
  });

  bubble.addEventListener("click", openWindow);
  closeBtn.addEventListener("click", closeWindow);

  // Keyboard shortcut listener: Alt+Shift+Q
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.altKey && e.shiftKey && (e.code === "KeyQ" || e.key === "Q" || e.key === "q")) {
        e.preventDefault();
        toggleWindow();
      }
    },
    true
  );

  // Dragging logic
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let initialLeft = 0;
  let initialTop = 0;

  titlebar.addEventListener("mousedown", (e) => {
    if (e.target.closest(".ai-icon-btn")) {
      return;
    }

    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    const rect = win.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    e.preventDefault();
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;

    let newLeft = initialLeft + deltaX;
    let newTop = initialTop + deltaY;

    // Constrain inside viewport
    const winWidth = win.offsetWidth;
    const winHeight = win.offsetHeight;
    const maxLeft = Math.max(0, window.innerWidth - winWidth);
    const maxTop = Math.max(0, window.innerHeight - winHeight);

    newLeft = Math.max(0, Math.min(newLeft, maxLeft));
    newTop = Math.max(0, Math.min(newTop, maxTop));

    win.style.left = `${newLeft}px`;
    win.style.top = `${newTop}px`;
  });

  window.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
    }
  });

  // Display helpers for status and errors
  function showStatus(text) {
    answerArea.className = "ai-answer-area status";
    answerArea.textContent = text;
  }

  function showError(text) {
    answerArea.className = "ai-answer-area error";
    answerArea.textContent = text;
  }

  function showAnswer(text) {
    answerArea.className = "ai-answer-area";
    answerArea.textContent = text;
  }

  // "Use selection" button
  btnUseSelection.addEventListener("click", () => {
    const activeSel = window.getSelection() ? window.getSelection().toString().trim() : "";
    const textToUse = activeSel || lastSelection;
    if (textToUse) {
      promptInput.value = textToUse;
      promptInput.focus();
    } else {
      showStatus("No text currently selected on this page or iframe.");
    }
  });

  // "Read page" button
  btnReadPage.addEventListener("click", () => {
    const pageText = (document.body ? document.body.innerText : "").trim();
    if (pageText) {
      promptInput.value = pageText.slice(0, 12000);
      promptInput.focus();
    } else {
      showStatus("Page body is empty.");
    }
  });

  // "Ask" button
  btnAsk.addEventListener("click", () => {
    const inputVal = promptInput.value.trim();
    const promptToSend = inputVal || lastSelection;

    if (!promptToSend) {
      showError("Please enter a question or select text on the page.");
      return;
    }

    if (!inputVal && promptToSend) {
      promptInput.value = promptToSend;
    }

    btnAsk.disabled = true;
    btnAsk.textContent = "Thinking...";
    showStatus("Thinking...");

    chrome.runtime.sendMessage({ action: "ask", prompt: promptToSend }, (response) => {
      btnAsk.disabled = false;
      btnAsk.textContent = "Ask";

      if (chrome.runtime.lastError) {
        showError(
          `Communication error: ${chrome.runtime.lastError.message || "Failed to reach background service."}`
        );
        return;
      }

      if (!response || typeof response !== "object") {
        showError("Received an invalid response from the background service.");
        return;
      }

      if (!response.ok) {
        showError(response.error || "An unknown error occurred.");
      } else {
        showAnswer(response.text || "No answer generated.");
      }
    });
  });

  window.__floatingAiToggle = toggleWindow;
})();
