// Background Service Worker for Floating AI Assistant

const SYSTEM_INSTRUCTION =
  "You help answer multiple-choice questions. Reply in this format: Answer: <letter> - <option text>, then one or two short sentences of reasoning. If the question is not multiple choice, answer concisely. If the text is unclear or incomplete, say what is missing.";

// Toggle floating window in active tab (frameId 0)
async function toggleInActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      await chrome.tabs.sendMessage(tab.id, { action: "toggle" }, { frameId: 0 });
    }
  } catch (err) {
    // Content script may not be available on this page (e.g., chrome:// or restricted page)
  }
}

// Action click (toolbar icon)
chrome.action.onClicked.addListener(() => {
  toggleInActiveTab();
});

// Keyboard command
chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-window") {
    toggleInActiveTab();
  }
});

// Relay iframe selection to top frame
function relayIframeSelection(sender, text) {
  if (sender && sender.tab && sender.tab.id) {
    chrome.tabs
      .sendMessage(sender.tab.id, { action: "updateSelection", text }, { frameId: 0 })
      .catch(() => {
        // Ignore if top frame is not listening
      });
  }
}

// Helper to call Gemini generateContent endpoint
async function callGemini(modelName, prompt, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    modelName
  )}:generateContent`;

  const payload = {
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents: [
      {
        parts: [{ text: prompt.trim() }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
    },
  };

  return await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });
}

// Handle ask request to Gemini API with automatic high-demand/model fallback
async function handleAsk(prompt) {
  if (!prompt || !prompt.trim()) {
    return {
      ok: false,
      error: "Please enter a question or select text on the page to ask.",
    };
  }

  let storage;
  try {
    storage = await chrome.storage.local.get(["apiKey", "model"]);
  } catch (storageErr) {
    return {
      ok: false,
      error: `Failed to access extension storage: ${storageErr.message}`,
    };
  }

  const apiKey = storage && storage.apiKey ? storage.apiKey.trim() : "";
  if (!apiKey) {
    return {
      ok: false,
      error:
        "Gemini API key is missing. Click the settings gear icon in the title bar to enter and save your API key.",
    };
  }

  const userModel =
    storage && storage.model && storage.model.trim()
      ? storage.model.trim()
      : "gemini-2.0-flash";

  // Build model priority list: user model first, followed by reliable fallbacks
  const modelsToTry = [userModel];
  if (!modelsToTry.includes("gemini-2.0-flash")) {
    modelsToTry.push("gemini-2.0-flash");
  }
  if (!modelsToTry.includes("gemini-1.5-flash")) {
    modelsToTry.push("gemini-1.5-flash");
  }

  let lastError = null;

  for (let i = 0; i < modelsToTry.length; i++) {
    const currentModel = modelsToTry[i];
    let response;

    try {
      response = await callGemini(currentModel, prompt, apiKey);
    } catch (netErr) {
      return {
        ok: false,
        error: `Network error: Unable to reach Gemini API. Please check your connection. (${netErr.message})`,
      };
    }

    if (response.ok) {
      let data;
      try {
        data = await response.json();
      } catch (parseErr) {
        return {
          ok: false,
          error: "Failed to parse API response as JSON.",
        };
      }

      const candidate = data.candidates && data.candidates[0];
      const replyText = candidate?.content?.parts?.[0]?.text;

      if (!replyText || !replyText.trim()) {
        const finishReason = candidate?.finishReason || "NO_CONTENT";
        return {
          ok: false,
          error: `Empty response received from Gemini (Finish reason: ${finishReason}).`,
        };
      }

      return {
        ok: true,
        text: replyText.trim(),
      };
    }

    // If HTTP 503 (high demand / unavailable) or HTTP 404 (model deprecated / unavailable),
    // automatically failover to the next candidate model
    if ((response.status === 503 || response.status === 404) && i < modelsToTry.length - 1) {
      continue;
    }

    if (response.status === 429) {
      return {
        ok: false,
        error:
          "Rate or daily limit reached (HTTP 429). Please wait a moment before trying again or check your Gemini quota.",
      };
    }

    let errorBody = "";
    try {
      errorBody = await response.text();
    } catch (readErr) {
      errorBody = "Unable to read response body.";
    }

    const preview = errorBody.slice(0, 300);
    lastError = `API error (HTTP ${response.status}) on ${currentModel}: ${preview}`;
  }

  return {
    ok: false,
    error: lastError || "Failed to generate answer.",
  };
}

// Runtime message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    return false;
  }

  if (message.action === "iframeSelection") {
    relayIframeSelection(sender, message.text);
    sendResponse({ ok: true });
    return false;
  }

  if (message.action === "ask") {
    handleAsk(message.prompt)
      .then((res) => sendResponse(res))
      .catch((err) =>
        sendResponse({
          ok: false,
          error: err.message || "An unexpected error occurred while processing your request.",
        })
      );
    // Return true to keep the message channel open for async response
    return true;
  }

  return false;
});
