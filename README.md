# Floating AI Assistant

A lightweight Chrome Extension (Manifest V3) that sits right on top of any web page in a floating, draggable window to read questions and deliver intelligent answers using the Google Gemini API.

Built entirely with plain JavaScript, HTML, and CSS — zero build tools, zero external libraries, zero frameworks, and zero npm packages.

---

## What It Does

Floating AI Assistant overlays an unobtrusive, floating assistant directly inside your active web page:
- **No side panels, popups, new tabs, or new windows**: Answers appear right beside the question you are reading.
- **Shadow DOM Isolation**: The entire assistant UI is encapsulated in a Shadow DOM with maximum z-index (`2147483647`), ensuring web page styles never break the assistant and assistant styles never affect the page.
- **Multiple-Choice Optimization**: Pre-configured with a specialized system prompt to answer multiple-choice questions cleanly (`Answer: <letter> - <option text>`, followed by 1–2 short sentences of reasoning), while also handling open-ended questions concisely.
- **Iframe Support**: Listens for selections inside nested iframes (common on LMS and online assignment platforms) and automatically relays them to the top frame.

---

## Features

- **Draggable & Resizable**: Drag smoothly from the title bar (automatically constrained inside the browser viewport) and resize from the corner.
- **Bottom-Right Bubble**: A sleek 48px round button at the bottom-right for 1-click access; automatically hides when the window is open.
- **Keyboard Shortcut**: Press `Alt+Shift+Q` anywhere to toggle the floating window instantly.
- **Intelligent Selection Tracking**: Captures and remembers your last highlighted text using `selectionchange` listeners and `preventDefault` mousedown guards, so clicks inside the window never lose your highlight.
- **Full Page Reading**: "Read page" grabs the page body text (trimmed up to 12,000 characters) for context-heavy questions.
- **Configurable Settings Panel**: Gear icon allows entering and saving your Gemini API key and model name (`gemini-2.5-flash` by default) in `chrome.storage.local`.
- **Security-First**: The API key is stored locally in extension storage and never hardcoded, written to disk, or logged to the console.

---

## Getting a Free Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com).
2. Sign in with your Google account.
3. Click **Get API key** in the left sidebar or top banner.
4. Click **Create API key** and copy the generated key.

---

## Installation (Load Unpacked)

1. Open Google Chrome and go to `chrome://extensions`.
2. Turn on the **Developer mode** toggle in the top-right corner.
3. Click the **Load unpacked** button in the top-left corner.
4. Browse to and select the project folder:
   ```
   C:\Users\psc\.gemini\antigravity\scratch\floating-ai
   ```
5. *(Optional for local testing)*: If you want to use the extension on local HTML files (like the included `test.html`), find **Floating AI Assistant** on `chrome://extensions`, click **Details**, and toggle **"Allow access to file URLs"** to **ON**.

---

## How to Use

1. **Open the Assistant**:
   - Click the round floating bubble in the bottom-right corner of the page, **OR**
   - Click the extension icon in your Chrome toolbar, **OR**
   - Press the keyboard shortcut `Alt+Shift+Q`.
2. **First-Time Setup**:
   - Click the **gear icon** (⚙) in the window title bar.
   - Paste your Gemini API key into the password field.
   - *(Optional)* Set a custom model name (defaults to `gemini-2.5-flash`).
   - Click **Save**.
3. **Answering Questions**:
   - **From Selection**: Highlight any text on the page or inside an iframe, open the window, and click **Use selection**. The highlighted text will populate the input field.
   - **From Entire Page**: Click **Read page** to grab the page content.
   - **Custom Typing**: You can also type or edit questions directly in the textarea.
   - Click **Ask**: The assistant button switches to "Thinking...", calls the Gemini API, and displays the formatted answer and reasoning in the scrollable answer box.

---

## Changing the Keyboard Shortcut

The default shortcut is `Alt+Shift+Q` (avoiding `Alt+A` to prevent conflicts with other extensions). To customize it:

1. Open Chrome and navigate to `chrome://extensions/shortcuts`.
2. Find **Floating AI Assistant**.
3. Click the pencil icon next to **Toggle the AI window**.
4. Press your desired shortcut combination.

---

## Troubleshooting

- **Reload After Changes**: If you edit any extension files, go to `chrome://extensions` and click the circular **Reload** icon on the Floating AI Assistant card, then refresh any web pages you are testing on.
- **Restricted Pages**: Chrome extensions cannot run on internal browser pages (`chrome://*`, `chrome-extension://*`, or the Chrome Web Store). Test on standard websites (`https://...`) or local pages (`file://...`).
- **File URL Access**: If testing locally on `file://` URLs, remember to enable **"Allow access to file URLs"** in the extension details.
- **Checking Extension Errors**: Click the **Errors** button on the extension card in `chrome://extensions` to inspect background service worker or content script errors.
- **API Errors or Rate Limits (HTTP 429)**: Check that your Gemini API key is valid and that your project has available quota at [Google AI Studio](https://aistudio.google.com).

---

## Academic Integrity & Responsible Use

> [!NOTE]
> This tool is designed as an educational assistant and study aid. Users are solely responsible for adhering to their school's, university's, or institution's honor code and academic policies regarding generative AI use.
