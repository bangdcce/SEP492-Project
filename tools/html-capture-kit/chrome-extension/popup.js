const captureButton = document.getElementById("captureButton");
const toggleFooterButton = document.getElementById("toggleFooterButton");
const statusElement = document.getElementById("status");
const ignoreStickyElement = document.getElementById("ignoreSticky");
const ignoreFixedElement = document.getElementById("ignoreFixed");
const captureImagesElement = document.getElementById("captureImages");
const ignoreSelectorsElement = document.getElementById("ignoreSelectors");
const STORAGE_KEY = "htmlCaptureKit.popupOptions";
const FOOTER_TOGGLE_STORAGE_KEY = "htmlCaptureKit.hiddenFooterOrigins";
const FOOTER_STYLE_ID = "html-capture-kit-hidden-footer-style";
const FOOTER_HIDE_SELECTORS = [
  "footer",
  "[role='contentinfo']",
  "[data-capture-footer]",
  "[data-footer]",
].join(", ");
let footerHidden = false;

initializePopup().catch((error) => {
  setStatus(getErrorMessage(error), "error");
});

captureButton.addEventListener("click", async () => {
  await runCapture();
});

toggleFooterButton.addEventListener("click", async () => {
  await runFooterToggle();
});

async function initializePopup() {
  const storedOptions = await chrome.storage.local.get(STORAGE_KEY);
  const options = storedOptions[STORAGE_KEY] || {};

  ignoreStickyElement.checked = options.ignoreSticky !== false;
  ignoreFixedElement.checked = options.ignoreFixed !== false;
  captureImagesElement.checked = options.captureImages !== false;
  ignoreSelectorsElement.value = String(options.ignoreSelectors || "");

  const tab = await getActiveTab();
  assertCapturableTab(tab);
  footerHidden = await syncFooterState(tab);
  syncFooterButtonLabel();
}

async function runCapture() {
  setBusy(true);
  setStatus("Preparing capture…");

  try {
    const tab = await getActiveTab();
    assertCapturableTab(tab);
    const captureOptions = {
      ignoreSticky: ignoreStickyElement.checked,
      ignoreFixed: ignoreFixedElement.checked,
      captureImages: captureImagesElement.checked,
      ignoreSelectors: ignoreSelectorsElement.value,
    };

    await chrome.storage.local.set({
      [STORAGE_KEY]: captureOptions,
    });

    await ensureContentScript(tab.id, "capturePage");
    const response = await sendCaptureMessage(tab.id, captureOptions);

    if (!response || !response.ok) {
      throw new Error(response && response.error ? response.error : "Capture failed.");
    }

    const capture = response.payload;
    const filename = buildFilename(capture);
    const blob = new Blob([JSON.stringify(capture, null, 2)], {
      type: "application/json",
    });
    const downloadUrl = URL.createObjectURL(blob);

    await chrome.downloads.download({
      url: downloadUrl,
      filename: `html-capture-kit/${filename}`,
      saveAs: true,
      conflictAction: "uniquify",
    });

    setTimeout(() => {
      URL.revokeObjectURL(downloadUrl);
    }, 30000);

    const layerCount = countCaptureLayers(capture);
    setStatus(
      `Saved ${filename} with ${layerCount} exported layers from ${capture.source.title || capture.source.url}.`,
      "success",
    );
  } catch (error) {
    setStatus(getErrorMessage(error), "error");
  } finally {
    setBusy(false);
  }
}

async function runFooterToggle() {
  setFooterBusy(true);
  setStatus(footerHidden ? "Restoring footer…" : "Hiding footer…");

  try {
    const tab = await getActiveTab();
    assertCapturableTab(tab);
    footerHidden = await applyFooterVisibility(tab, !footerHidden);
    syncFooterButtonLabel();
    setStatus(
      footerHidden
        ? `Footer is now hidden on ${getTabOrigin(tab) || "this site"}.`
        : `Footer is visible again on ${getTabOrigin(tab) || "this site"}.`,
      "success",
    );
  } catch (error) {
    setStatus(getErrorMessage(error), "error");
  } finally {
    setFooterBusy(false);
  }
}

async function ensureContentScript(tabId, requiredCapability) {
  try {
    const pingResponse = await chrome.tabs.sendMessage(tabId, {
      type: "FIGMA_CAPTURE_PING",
    });

    if (
      pingResponse &&
      pingResponse.ok &&
      hasRequiredCapability(pingResponse, requiredCapability)
    ) {
      return;
    }
  } catch (error) {
    if (!isMissingReceiverError(error)) {
      throw error;
    }
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content-script.js"],
  });
}

async function sendCaptureMessage(tabId, captureOptions) {
  try {
    return await chrome.tabs.sendMessage(tabId, {
      type: "FIGMA_CAPTURE_PAGE",
      options: captureOptions,
    });
  } catch (error) {
    if (!isMissingReceiverError(error)) {
      throw error;
    }

    await ensureContentScript(tabId, "capturePage");
    return await chrome.tabs.sendMessage(tabId, {
      type: "FIGMA_CAPTURE_PAGE",
      options: captureOptions,
    });
  }
}

function hasRequiredCapability(pingResponse, requiredCapability) {
  if (!requiredCapability) {
    return true;
  }

  const capabilities = pingResponse && pingResponse.capabilities;
  return Boolean(capabilities && capabilities[requiredCapability]);
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || typeof tab.id !== "number") {
    throw new Error("Could not find an active browser tab.");
  }

  return tab;
}

async function syncFooterState(tab) {
  const storedHidden = await getStoredFooterPreference(tab);

  if (storedHidden) {
    await setFooterStyle(tab.id, true);
  }

  const liveHidden = await readFooterVisibility(tab.id).catch(() => storedHidden);
  if (liveHidden !== storedHidden) {
    await persistFooterPreference(tab, liveHidden);
  }

  return liveHidden;
}

async function applyFooterVisibility(tab, hidden) {
  const appliedHidden = await setFooterStyle(tab.id, hidden);
  await persistFooterPreference(tab, appliedHidden);
  return appliedHidden;
}

async function setFooterStyle(tabId, hidden) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: toggleFooterStyleOnPage,
    args: [hidden, FOOTER_STYLE_ID, FOOTER_HIDE_SELECTORS],
  });

  return Boolean(results && results[0] && results[0].result);
}

async function readFooterVisibility(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (styleId) => Boolean(document.getElementById(styleId)),
    args: [FOOTER_STYLE_ID],
  });

  return Boolean(results && results[0] && results[0].result);
}

async function getStoredFooterPreference(tab) {
  const origin = getTabOrigin(tab);
  if (!origin) {
    return false;
  }

  const stored = await chrome.storage.local.get(FOOTER_TOGGLE_STORAGE_KEY);
  const togglesByOrigin = stored[FOOTER_TOGGLE_STORAGE_KEY] || {};
  return Boolean(togglesByOrigin[origin]);
}

async function persistFooterPreference(tab, hidden) {
  const origin = getTabOrigin(tab);
  if (!origin) {
    return;
  }

  const stored = await chrome.storage.local.get(FOOTER_TOGGLE_STORAGE_KEY);
  const togglesByOrigin = stored[FOOTER_TOGGLE_STORAGE_KEY] || {};

  if (hidden) {
    togglesByOrigin[origin] = true;
  } else {
    delete togglesByOrigin[origin];
  }

  await chrome.storage.local.set({
    [FOOTER_TOGGLE_STORAGE_KEY]: togglesByOrigin,
  });
}

function getTabOrigin(tab) {
  try {
    return new URL(String(tab.url || "")).origin;
  } catch (error) {
    return "";
  }
}

function buildFilename(capture) {
  const safeTitle = sanitizeFilename(
    capture.source.title || capture.source.url || "captured-page",
  );
  const stamp = new Date(capture.capturedAt)
    .toISOString()
    .replace(/[:]/g, "-")
    .replace(/\.\d{3}Z$/, "Z");

  return `${safeTitle}-${stamp}.figcap.json`;
}

function sanitizeFilename(input) {
  return String(input || "capture")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "capture";
}

function setBusy(isBusy) {
  captureButton.disabled = isBusy;
  captureButton.textContent = isBusy ? "Capturing…" : "Capture Current Page";
}

function setFooterBusy(isBusy) {
  toggleFooterButton.disabled = isBusy;
  syncFooterButtonLabel(isBusy);
}

function syncFooterButtonLabel(isBusy) {
  if (isBusy) {
    toggleFooterButton.textContent = footerHidden ? "Showing Footer…" : "Hiding Footer…";
    return;
  }

  toggleFooterButton.textContent = footerHidden
    ? "Show Footer On This Site"
    : "Hide Footer On This Site";
}

function setStatus(message, state) {
  statusElement.textContent = message;
  if (state) {
    statusElement.dataset.state = state;
  } else {
    delete statusElement.dataset.state;
  }
}

function getErrorMessage(error) {
  if (chrome.runtime.lastError && chrome.runtime.lastError.message) {
    return chrome.runtime.lastError.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error || "Unknown capture error.");
}

function countCaptureLayers(capture) {
  if (capture && capture.root) {
    return Math.max(0, countLayerTree(capture.root) - 1);
  }

  if (capture && Array.isArray(capture.nodes)) {
    return capture.nodes.length;
  }

  return 0;
}

function countLayerTree(layer) {
  if (!layer || typeof layer !== "object") {
    return 0;
  }

  const children = Array.isArray(layer.children) ? layer.children : [];
  return 1 + children.reduce((sum, child) => sum + countLayerTree(child), 0);
}

function isMissingReceiverError(error) {
  const message = getErrorMessage(error);
  return message.includes("Receiving end does not exist");
}

function assertCapturableTab(tab) {
  const url = String(tab.url || "");

  if (!url) {
    throw new Error("The current tab does not expose a capturable URL yet.");
  }

  if (
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:")
  ) {
    throw new Error("Chrome blocks extensions from capturing this browser-internal page.");
  }

  if (url.startsWith("https://chromewebstore.google.com/")) {
    throw new Error("Chrome blocks extensions from running on the Chrome Web Store.");
  }

}

function toggleFooterStyleOnPage(hidden, styleId, selectors) {
  const existingStyle = document.getElementById(styleId);

  if (!hidden) {
    if (existingStyle) {
      existingStyle.remove();
    }
    return false;
  }

  if (!existingStyle) {
    const styleElement = document.createElement("style");
    styleElement.id = styleId;
    styleElement.textContent = `
      ${selectors} {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `;

    const target = document.head || document.documentElement;
    target.appendChild(styleElement);
  }

  return Boolean(document.getElementById(styleId));
}
