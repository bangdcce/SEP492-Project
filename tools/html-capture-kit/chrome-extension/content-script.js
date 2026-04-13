const FOOTER_STYLE_ID = "html-capture-kit-hidden-footer-style";
const FOOTER_TOGGLE_STORAGE_KEY = "htmlCaptureKit.hiddenFooterOrigins";
const CONTENT_SCRIPT_VERSION = "0.3.2";
const FOOTER_HIDE_SELECTORS = [
  "footer",
  "[role='contentinfo']",
  "[data-capture-footer]",
  "[data-footer]",
].join(", ");

initializeFooterToggle().catch(() => {
  // Ignore storage/setup failures and keep the page usable.
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "FIGMA_CAPTURE_PING") {
    sendResponse({
      ok: true,
      version: CONTENT_SCRIPT_VERSION,
      capabilities: {
        capturePage: true,
        footerToggle: true,
        pageState: true,
      },
    });
    return false;
  }

  if (message && message.type === "FIGMA_CAPTURE_GET_PAGE_STATE") {
    sendResponse({
      ok: true,
      footerHidden: isFooterHidden(),
      origin: getCurrentOriginKey(),
    });
    return false;
  }

  if (message && message.type === "FIGMA_CAPTURE_TOGGLE_FOOTER") {
    toggleFooterVisibility(message.hidden)
      .then((footerHidden) => {
        sendResponse({
          ok: true,
          footerHidden,
          origin: getCurrentOriginKey(),
        });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return true;
  }

  if (!message || message.type !== "FIGMA_CAPTURE_PAGE") {
    return false;
  }

  capturePage(message.options || {})
    .then((payload) => {
      sendResponse({ ok: true, payload });
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    });

  return true;
});

async function initializeFooterToggle() {
  const originKey = getCurrentOriginKey();
  if (!originKey || !chrome.storage || !chrome.storage.local) {
    return;
  }

  const stored = await chrome.storage.local.get(FOOTER_TOGGLE_STORAGE_KEY);
  const togglesByOrigin = stored[FOOTER_TOGGLE_STORAGE_KEY] || {};

  if (togglesByOrigin[originKey]) {
    applyFooterVisibility(true);
  }
}

async function toggleFooterVisibility(forceHidden) {
  const nextHidden =
    typeof forceHidden === "boolean" ? forceHidden : !isFooterHidden();

  applyFooterVisibility(nextHidden);
  await persistFooterPreference(nextHidden);
  return nextHidden;
}

function applyFooterVisibility(hidden) {
  const existingStyle = document.getElementById(FOOTER_STYLE_ID);

  if (!hidden) {
    if (existingStyle) {
      existingStyle.remove();
    }
    return;
  }

  if (existingStyle) {
    return;
  }

  const styleElement = document.createElement("style");
  styleElement.id = FOOTER_STYLE_ID;
  styleElement.textContent = `
    ${FOOTER_HIDE_SELECTORS} {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
  `;

  const target = document.head || document.documentElement;
  target.appendChild(styleElement);
}

function isFooterHidden() {
  return Boolean(document.getElementById(FOOTER_STYLE_ID));
}

async function persistFooterPreference(hidden) {
  const originKey = getCurrentOriginKey();
  if (!originKey || !chrome.storage || !chrome.storage.local) {
    return;
  }

  const stored = await chrome.storage.local.get(FOOTER_TOGGLE_STORAGE_KEY);
  const togglesByOrigin = stored[FOOTER_TOGGLE_STORAGE_KEY] || {};

  if (hidden) {
    togglesByOrigin[originKey] = true;
  } else {
    delete togglesByOrigin[originKey];
  }

  await chrome.storage.local.set({
    [FOOTER_TOGGLE_STORAGE_KEY]: togglesByOrigin,
  });
}

function getCurrentOriginKey() {
  return window.location && window.location.origin ? window.location.origin : "";
}

async function capturePage(rawOptions) {
  if (!document.body || !document.documentElement) {
    throw new Error("The current page is not ready for capture.");
  }

  const options = normalizeOptions(rawOptions);
  const context = {
    options,
    ignoreSelectors: createSelectorList(options.ignoreSelectors),
    order: 0,
  };

  const pageWidth = Math.max(
    document.documentElement.scrollWidth,
    document.body.scrollWidth,
    document.documentElement.clientWidth,
    window.innerWidth,
  );
  const pageHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight,
    document.documentElement.clientHeight,
    window.innerHeight,
  );

  const rootChildren = await captureChildNodes(Array.from(document.body.childNodes), context);

  return {
    format: "html-capture-kit",
    version: "0.3.0",
    capturedAt: new Date().toISOString(),
    source: {
      url: window.location.href,
      title: document.title,
      userAgent: window.navigator.userAgent,
    },
    settings: options,
    document: {
      width: pageWidth,
      height: pageHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      backgroundColor: getPageBackgroundColor(),
    },
    root: {
      id: "root",
      kind: "frame",
      tagName: "body",
      name: document.title || "Captured Page",
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
      opacity: 1,
      zIndex: 0,
      fills: buildDocumentFills(),
      stroke: null,
      borderRadius: createUniformRadius(0),
      layout: buildLayoutPayload(window.getComputedStyle(document.body), document.body),
      children: rootChildren,
    },
  };
}

async function captureChildNodes(childNodes, context) {
  const layers = [];

  for (const childNode of childNodes) {
    const captured = await captureNode(childNode, context);
    appendCapturedLayer(layers, captured);
  }

  return sortLayers(layers);
}

function appendCapturedLayer(target, captured) {
  if (Array.isArray(captured)) {
    target.push(...captured);
    return;
  }

  if (captured) {
    target.push(captured);
  }
}

async function captureNode(node, context) {
  if (node.nodeType === Node.TEXT_NODE) {
    return captureTextNode(node, context);
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  return captureElementNode(node, context);
}

function captureTextNode(textNode, context) {
  const parent = textNode.parentElement;

  if (!(parent instanceof Element)) {
    return null;
  }

  if (shouldIgnoreElement(parent, context.options, context.ignoreSelectors)) {
    return null;
  }

  if (isFieldElement(parent)) {
    return null;
  }

  const text = normalizeText(textNode.textContent);
  if (!text) {
    return null;
  }

  const style = window.getComputedStyle(parent);
  if (style.visibility === "hidden" || style.display === "none") {
    return null;
  }

  const textMetrics = getTextNodeMetrics(textNode);
  if (!textMetrics || !textMetrics.rect) {
    return null;
  }

  const parentRect = getDocumentRect(parent.getBoundingClientRect());
  const textContainer = resolveTextContainer(parent, style, textMetrics.rect, parentRect);
  const textMode = textContainer ? "container" : "tight";
  const rect = textContainer
    ? getTextContainerRect(textContainer.rect, style, parentRect)
    : textMetrics.rect;
  const textAlign = textContainer
    ? determineContainerTextAlign(
        textContainer.element,
        textContainer.style,
        textMetrics.rect,
        textContainer.rect,
      )
    : style.textAlign || "left";

  return createTextLayer({
    id: nextLayerId(context),
    name: deriveNodeName(parent, "text"),
    tagName: parent.tagName.toLowerCase(),
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    opacity: clampOpacity(style.opacity),
    zIndex: normalizeZIndex(style.zIndex),
    text: buildTextStylePayload(text, style, {
      textAlign,
      boxMode: textMode,
      lineCount: textMetrics.lineCount,
    }),
  });
}

async function captureElementNode(element, context) {
  if (shouldIgnoreElement(element, context.options, context.ignoreSelectors)) {
    return null;
  }

  const style = window.getComputedStyle(element);
  const tagName = element.tagName.toLowerCase();
  const rect = getDocumentRect(element.getBoundingClientRect());

  if (context.options.captureImages && isImageLikeElement(element)) {
    if (!rect) {
      return null;
    }

    return {
      id: nextLayerId(context),
      kind: "image",
      tagName,
      name: deriveNodeName(element, tagName),
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      opacity: clampOpacity(style.opacity),
      zIndex: normalizeZIndex(style.zIndex),
      image: await captureImageElement(element),
    };
  }

  let childLayers = await captureChildNodes(Array.from(element.childNodes), context);

  if (rect && isFieldElement(element)) {
    const syntheticText = buildSyntheticFieldTextLayer(element, rect, style, context);
    if (syntheticText) {
      childLayers.push(syntheticText);
      childLayers = sortLayers(childLayers);
    }
  }

  const hasVisualBox = rect ? hasRenderableBox(style, tagName) : false;
  const meaningfulChildren = childLayers.length > 0;
  const isMeaningfulFrame =
    Boolean(rect) &&
    (hasVisualBox ||
      meaningfulChildren ||
      isSemanticContainer(tagName) ||
      isLayoutContainer(style));

  if (!isMeaningfulFrame) {
    return meaningfulChildren ? childLayers : null;
  }

  if (shouldPromoteOnlyChild(element, style, childLayers, hasVisualBox)) {
    return childLayers;
  }

  return {
    id: nextLayerId(context),
    kind: "frame",
    tagName,
    name: deriveNodeName(element, tagName),
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    opacity: clampOpacity(style.opacity),
    zIndex: normalizeZIndex(style.zIndex),
    fills: buildFillsPayload(style),
    stroke: buildStrokePayload(style),
    borderRadius: parseBorderRadiusPayload(style, rect),
    effects: buildEffectsPayload(style),
    layout: buildLayoutPayload(style, element),
    children: childLayers,
  };
}

function shouldPromoteOnlyChild(element, style, childLayers, hasVisualBox) {
  if (childLayers.length !== 1) {
    return false;
  }

  if (hasVisualBox || isFieldElement(element) || isExplicitStructuralElement(element.tagName)) {
    return false;
  }

  if (hasDirectRenderableTextChild(element)) {
    return false;
  }

  if (isLayoutContainer(style)) {
    return false;
  }

  return true;
}

function hasDirectRenderableTextChild(element) {
  return Array.from(element.childNodes).some((childNode) => {
    return childNode.nodeType === Node.TEXT_NODE && normalizeText(childNode.textContent);
  });
}

function createTextLayer(payload) {
  return {
    id: payload.id,
    kind: "text",
    tagName: payload.tagName,
    name: payload.name,
    x: payload.x,
    y: payload.y,
    width: payload.width,
    height: payload.height,
    opacity: payload.opacity,
    zIndex: payload.zIndex,
    text: payload.text,
  };
}

function buildTextStylePayload(text, style, options) {
  return {
    content: text,
    fontFamily: style.fontFamily,
    fontSize: parseFloat(style.fontSize) || 16,
    fontWeight: normalizeFontWeight(style.fontWeight),
    fontStyle: style.fontStyle || "normal",
    lineHeight: parseLineHeight(style.lineHeight, style.fontSize),
    letterSpacing: parseFloat(style.letterSpacing) || 0,
    textAlign: (options && options.textAlign) || style.textAlign || "left",
    textTransform: style.textTransform || "none",
    textDecoration: style.textDecorationLine || "none",
    color: toSerializableColor(style.color) || style.color,
    boxMode: (options && options.boxMode) || "tight",
    lineCount: (options && options.lineCount) || 1,
  };
}

function buildSyntheticFieldTextLayer(element, rect, style, context) {
  const tagName = element.tagName.toLowerCase();
  let content = "";
  let color = style.color;

  if (tagName === "input") {
    const inputType = String(element.getAttribute("type") || "text").toLowerCase();
    if (["checkbox", "radio", "range", "color", "file", "hidden"].includes(inputType)) {
      return null;
    }

    content = element.value || element.placeholder || "";
    if (!element.value && element.placeholder) {
      color = toPlaceholderColor(style.color);
    }
  } else if (tagName === "textarea") {
    content = element.value || element.placeholder || "";
    if (!element.value && element.placeholder) {
      color = toPlaceholderColor(style.color);
    }
  } else if (tagName === "select") {
    const selectedOption = element.selectedOptions && element.selectedOptions[0];
    content = selectedOption ? normalizeText(selectedOption.textContent) : "";
  }

  if (!normalizeText(content)) {
    return null;
  }

  const padding = parsePaddingPayload(style);
  const lineHeight = parseLineHeight(style.lineHeight, style.fontSize);
  const textY = rect.y + Math.max(padding.top, (rect.height - lineHeight) / 2);
  const textHeight = Math.max(1, rect.height - padding.top - padding.bottom);

  return createTextLayer({
    id: nextLayerId(context),
    name: `${deriveNodeName(element, tagName)}-content`,
    tagName,
    x: rect.x + padding.left,
    y: textY,
    width: Math.max(1, rect.width - padding.left - padding.right),
    height: Math.max(1, Math.min(lineHeight, textHeight)),
    opacity: clampOpacity(style.opacity),
    zIndex: normalizeZIndex(style.zIndex) + 1,
    text: {
      content: normalizeText(content),
      fontFamily: style.fontFamily,
      fontSize: parseFloat(style.fontSize) || 16,
      fontWeight: normalizeFontWeight(style.fontWeight),
      fontStyle: style.fontStyle || "normal",
      lineHeight,
      letterSpacing: parseFloat(style.letterSpacing) || 0,
      textAlign: style.textAlign || "left",
      textTransform: style.textTransform || "none",
      textDecoration: "none",
      color: toSerializableColor(color) || color,
    },
  });
}

function normalizeOptions(rawOptions) {
  return {
    ignoreSticky: Boolean(rawOptions.ignoreSticky),
    ignoreFixed: Boolean(rawOptions.ignoreFixed),
    captureImages: rawOptions.captureImages !== false,
    ignoreSelectors: String(rawOptions.ignoreSelectors || ""),
  };
}

function createSelectorList(rawSelectors) {
  return String(rawSelectors || "")
    .split(/[\n,]+/g)
    .map((selector) => selector.trim())
    .filter(Boolean);
}

function shouldIgnoreElement(element, options, ignoreSelectors) {
  if (!(element instanceof Element)) {
    return true;
  }

  const tagName = element.tagName.toLowerCase();
  if (["script", "style", "meta", "link", "noscript", "template"].includes(tagName)) {
    return true;
  }

  if (element.closest("[data-capture-ignore]")) {
    return true;
  }

  if (hasIgnoredPositionAncestor(element, options)) {
    return true;
  }

  if (matchesAnySelector(element, ignoreSelectors)) {
    return true;
  }

  const style = window.getComputedStyle(element);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    parseFloat(style.opacity || "1") === 0
  ) {
    return true;
  }

  if (options.ignoreFixed && style.position === "fixed") {
    return true;
  }

  if (options.ignoreSticky && style.position === "sticky") {
    return true;
  }

  return false;
}

function hasIgnoredPositionAncestor(element, options) {
  let current = element.parentElement;

  while (current) {
    const style = window.getComputedStyle(current);

    if (options.ignoreFixed && style.position === "fixed") {
      return true;
    }

    if (options.ignoreSticky && style.position === "sticky") {
      return true;
    }

    if (current.hasAttribute("data-capture-ignore")) {
      return true;
    }

    current = current.parentElement;
  }

  return false;
}

function matchesAnySelector(element, selectors) {
  for (const selector of selectors) {
    try {
      if (element.matches(selector) || element.closest(selector)) {
        return true;
      }
    } catch (error) {
      console.warn("Invalid ignore selector skipped:", selector, error);
    }
  }

  return false;
}

function getDocumentRect(domRect) {
  if (!domRect || domRect.width < 1 || domRect.height < 1) {
    return null;
  }

  return {
    x: round(domRect.left + window.scrollX),
    y: round(domRect.top + window.scrollY),
    width: round(domRect.width),
    height: round(domRect.height),
  };
}

function getTextNodeMetrics(textNode) {
  const range = document.createRange();
  range.selectNodeContents(textNode);
  const rect = range.getBoundingClientRect();
  const lineCount = Array.from(range.getClientRects()).filter(
    (clientRect) => clientRect.width > 0 && clientRect.height > 0,
  ).length;
  if (typeof range.detach === "function") {
    range.detach();
  }
  return {
    rect: getDocumentRect(rect),
    lineCount: Math.max(1, lineCount),
  };
}

function resolveTextContainer(parent, style, tightRect, parentRect) {
  if (!parentRect || !isEligibleContainerTextTag(parent)) {
    return null;
  }

  if (parent.childElementCount > 0) {
    return null;
  }

  const parentTagName = parent.tagName.toLowerCase();
  const centeredAncestor =
    parentTagName === "button" || parentTagName === "a"
      ? null
      : findCenteredTextAncestor(parent, tightRect);
  if (centeredAncestor) {
    return centeredAncestor;
  }

  if (shouldUseOwnTextContainer(style, tightRect, parentRect)) {
    return {
      element: parent,
      style,
      rect: parentRect,
    };
  }

  return null;
}

function shouldUseOwnTextContainer(style, tightRect, parentRect) {
  if (!parentRect) {
    return false;
  }

  const declaredAlign = normalizeTextAlignKeyword(style.textAlign);
  if (["center", "right", "justify"].includes(declaredAlign)) {
    return true;
  }

  const widthRatio = parentRect.width / Math.max(1, tightRect.width);
  return widthRatio >= 1.25;
}

function findCenteredTextAncestor(parent, tightRect) {
  let current = parent.parentElement;
  let depth = 0;

  while (current && depth < 4) {
    const style = window.getComputedStyle(current);
    const rect = getDocumentRect(current.getBoundingClientRect());
    const declaredAlign = normalizeTextAlignKeyword(style.textAlign);

    if (
      rect &&
      rect.width > tightRect.width + 8 &&
      ["center", "right", "justify"].includes(declaredAlign)
    ) {
      return {
        element: current,
        style,
        rect,
      };
    }

    current = current.parentElement;
    depth += 1;
  }

  return null;
}

function isEligibleContainerTextTag(parent) {
  const tagName = parent.tagName.toLowerCase();
  const eligibleTags = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "button", "a"];
  return eligibleTags.includes(tagName);
}

function getTextContainerRect(containerRect, style, contentRect) {
  const padding = parsePaddingPayload(style);
  const x = containerRect.x + padding.left;
  const y = contentRect.y + padding.top;
  const width = Math.max(1, containerRect.width - padding.left - padding.right);
  const height = Math.max(1, contentRect.height - padding.top - padding.bottom);

  return {
    x,
    y,
    width,
    height,
  };
}

function determineContainerTextAlign(parent, style, tightRect, parentRect) {
  const declaredAlign = normalizeTextAlignKeyword(style.textAlign);
  if (declaredAlign && declaredAlign !== "left") {
    return declaredAlign;
  }

  const tagName = parent.tagName.toLowerCase();
  if (!parentRect) {
    return "left";
  }

  if (["h1", "h2", "h3", "h4", "h5", "h6", "p"].includes(tagName)) {
    const widthRatio = parentRect.width / Math.max(1, tightRect.width);
    if (widthRatio >= 1.35) {
      return "center";
    }
  }

  return "left";
}

function normalizeTextAlignKeyword(value) {
  const normalized = String(value || "").toLowerCase();
  if (!normalized || normalized === "initial" || normalized === "start") {
    return "left";
  }

  if (normalized === "end") {
    return "right";
  }

  return normalized;
}

function hasRenderableBox(style, tagName) {
  const hasFill = Boolean(buildFillsPayload(style));
  const hasStroke = Boolean(buildStrokePayload(style));
  const hasShadow = style.boxShadow && style.boxShadow !== "none";
  const semanticBoxTags = [
    "button",
    "input",
    "textarea",
    "select",
    "svg",
    "canvas",
    "video",
    "form",
  ];

  return hasFill || hasStroke || hasShadow || semanticBoxTags.includes(tagName);
}

function buildFillsPayload(style) {
  const fills = [];
  const backgroundImageFill = parseBackgroundImageFill(style.backgroundImage);

  if (backgroundImageFill) {
    fills.push(backgroundImageFill);
  }

  if (isVisibleColor(style.backgroundColor)) {
    fills.push({
      type: "solid",
      color: toSerializableColor(style.backgroundColor) || style.backgroundColor,
    });
  }

  return fills.length > 0 ? fills : null;
}

function parseBackgroundImageFill(backgroundImage) {
  const value = String(backgroundImage || "").trim();
  if (!value || value === "none") {
    return null;
  }

  const gradient = parseLinearGradient(value);
  if (!gradient) {
    return null;
  }

  return {
    type: "solid",
    color: gradient.representativeColor,
    source: "linear-gradient",
    original: value,
  };
}

function parseLinearGradient(input) {
  const match = input.match(/linear-gradient\((.+)\)/i);
  if (!match) {
    return null;
  }

  const parts = splitTopLevelCommaList(match[1]);
  if (parts.length < 2) {
    return null;
  }

  let stopsStartIndex = 0;
  if (/deg$/i.test(parts[0].trim())) {
    stopsStartIndex = 1;
  }

  const stops = [];
  for (const stopText of parts.slice(stopsStartIndex)) {
    const stop = parseGradientStop(stopText);
    if (stop) {
      stops.push(stop);
    }
  }

  if (stops.length === 0) {
    return null;
  }

  return {
    representativeColor: chooseRepresentativeGradientColor(stops),
    stops,
  };
}

function splitTopLevelCommaList(input) {
  const parts = [];
  let depth = 0;
  let current = "";

  for (const char of String(input || "")) {
    if (char === "(") {
      depth += 1;
      current += char;
      continue;
    }

    if (char === ")") {
      depth = Math.max(0, depth - 1);
      current += char;
      continue;
    }

    if (char === "," && depth === 0) {
      if (current.trim()) {
        parts.push(current.trim());
      }
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

function parseGradientStop(stopText) {
  const positionMatch = stopText.match(/(-?\d*\.?\d+)%\s*$/);
  const colorText = positionMatch
    ? stopText.slice(0, positionMatch.index).trim()
    : stopText.trim();
  const color = toSerializableColor(colorText);
  if (!color) {
    return null;
  }

  return {
    color,
    position: positionMatch ? clamp(parseFloat(positionMatch[1]) / 100, 0, 1, 0) : null,
  };
}

function chooseRepresentativeGradientColor(stops) {
  const normalizedStops = normalizeGradientStopPositions(stops);
  const midpoint = 0.5;

  for (let index = 0; index < normalizedStops.length - 1; index += 1) {
    const current = normalizedStops[index];
    const next = normalizedStops[index + 1];

    if (midpoint >= current.position && midpoint <= next.position) {
      const span = next.position - current.position || 1;
      const localProgress = (midpoint - current.position) / span;
      return interpolateColor(current.color, next.color, localProgress);
    }
  }

  return normalizedStops[Math.floor(normalizedStops.length / 2)].color;
}

function normalizeGradientStopPositions(stops) {
  return stops.map((stop, index) => {
    if (typeof stop.position === "number") {
      return stop;
    }

    if (stops.length === 1) {
      return { ...stop, position: 0 };
    }

    return {
      ...stop,
      position: index / (stops.length - 1),
    };
  });
}

function interpolateColor(startColor, endColor, progress) {
  const start = parseCssColor(startColor);
  const end = parseCssColor(endColor);

  if (!start || !end) {
    return startColor;
  }

  const alpha = start.a + (end.a - start.a) * progress;
  const red = Math.round((start.r + (end.r - start.r) * progress) * 255);
  const green = Math.round((start.g + (end.g - start.g) * progress) * 255);
  const blue = Math.round((start.b + (end.b - start.b) * progress) * 255);

  return `rgba(${red}, ${green}, ${blue}, ${round(alpha)})`;
}

function parseCssColor(input) {
  const value = String(input || "").trim();
  if (!value || value === "transparent") {
    return null;
  }

  if (value.startsWith("#")) {
    return parseHexColor(value);
  }

  const rgbaMatch = value.match(/rgba?\(([^)]+)\)/i);
  if (rgbaMatch) {
    const parts = rgbaMatch[1].split(",").map((part) => part.trim());
    const [r, g, b] = parts;
    const a = parts.length >= 4 ? parseFloat(parts[3]) : 1;
    return {
      r: clamp((parseFloat(r) || 0) / 255, 0, 1, 0),
      g: clamp((parseFloat(g) || 0) / 255, 0, 1, 0),
      b: clamp((parseFloat(b) || 0) / 255, 0, 1, 0),
      a: clamp(a, 0, 1, 1),
    };
  }

  return null;
}

function parseHexColor(value) {
  const normalized = value.replace("#", "").trim();

  if (normalized.length === 3) {
    const r = normalized[0] + normalized[0];
    const g = normalized[1] + normalized[1];
    const b = normalized[2] + normalized[2];
    return {
      r: parseInt(r, 16) / 255,
      g: parseInt(g, 16) / 255,
      b: parseInt(b, 16) / 255,
      a: 1,
    };
  }

  if (normalized.length === 6 || normalized.length === 8) {
    const r = parseInt(normalized.slice(0, 2), 16) / 255;
    const g = parseInt(normalized.slice(2, 4), 16) / 255;
    const b = parseInt(normalized.slice(4, 6), 16) / 255;
    const a =
      normalized.length === 8 ? parseInt(normalized.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }

  return null;
}

function buildStrokePayload(style) {
  const width = Math.max(
    parseFloat(style.borderTopWidth) || 0,
    parseFloat(style.borderRightWidth) || 0,
    parseFloat(style.borderBottomWidth) || 0,
    parseFloat(style.borderLeftWidth) || 0,
  );

  if (!width || !isVisibleColor(style.borderTopColor)) {
    return null;
  }

  return {
    width,
    color: toSerializableColor(style.borderTopColor) || style.borderTopColor,
  };
}

function buildEffectsPayload(style) {
  const shadows = parseBoxShadowPayload(style.boxShadow);
  const backdropBlur = parseBackdropBlurPayload(style.backdropFilter || style.webkitBackdropFilter);
  const effects = [...shadows];

  if (backdropBlur) {
    effects.push(backdropBlur);
  }

  return effects.length > 0 ? effects : null;
}

function parseBoxShadowPayload(boxShadow) {
  const value = String(boxShadow || "").trim();
  if (!value || value === "none") {
    return [];
  }

  const shadows = [];
  for (const shadowText of splitTopLevelCommaList(value)) {
    const shadow = parseSingleBoxShadow(shadowText);
    if (shadow) {
      shadows.push(shadow);
    }
  }

  return shadows;
}

function parseSingleBoxShadow(shadowText) {
  const normalized = String(shadowText || "").trim();
  if (!normalized) {
    return null;
  }

  const colorMatch = normalized.match(
    /(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8}|[a-zA-Z]+)\s*$/,
  );
  const colorToken = colorMatch ? colorMatch[1] : "rgba(0, 0, 0, 0.2)";
  const numericPart = colorMatch
    ? normalized.slice(0, colorMatch.index).trim()
    : normalized;
  const values = numericPart
    .split(/\s+/)
    .map((token) => parseFloat(token))
    .filter((value) => Number.isFinite(value));

  if (values.length < 3) {
    return null;
  }

  return {
    type: "drop-shadow",
    color: toSerializableColor(colorToken) || colorToken,
    offsetX: values[0],
    offsetY: values[1],
    blur: values[2],
    spread: values[3] || 0,
  };
}

function parseBackdropBlurPayload(backdropFilter) {
  const value = String(backdropFilter || "").trim();
  if (!value || value === "none") {
    return null;
  }

  const blurMatch = value.match(/blur\(([\d.]+)px\)/i);
  if (!blurMatch) {
    return null;
  }

  return {
    type: "background-blur",
    radius: Math.max(0, parseFloat(blurMatch[1]) || 0),
  };
}

function parseBorderRadiusPayload(style, rect) {
  const width = rect ? rect.width : 0;
  const height = rect ? rect.height : 0;

  const topLeft = parseRadiusValue(style.borderTopLeftRadius, width, height);
  const topRight = parseRadiusValue(style.borderTopRightRadius, width, height);
  const bottomRight = parseRadiusValue(style.borderBottomRightRadius, width, height);
  const bottomLeft = parseRadiusValue(style.borderBottomLeftRadius, width, height);

  return {
    topLeft,
    topRight,
    bottomRight,
    bottomLeft,
  };
}

function parseRadiusValue(value, width, height) {
  const token = String(value || "")
    .trim()
    .split(/\s+/)[0];

  if (!token) {
    return 0;
  }

  if (token.endsWith("%")) {
    const percentage = parseFloat(token);
    if (!Number.isFinite(percentage)) {
      return 0;
    }

    return (Math.min(width, height) * percentage) / 100;
  }

  const parsed = parseFloat(token);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createUniformRadius(value) {
  return {
    topLeft: value,
    topRight: value,
    bottomRight: value,
    bottomLeft: value,
  };
}

function buildLayoutPayload(style, element) {
  return {
    display: style.display,
    position: style.position,
    overflowX: style.overflowX,
    overflowY: style.overflowY,
    flexDirection: style.flexDirection,
    justifyContent: style.justifyContent,
    alignItems: style.alignItems,
    alignContent: style.alignContent,
    gap: parseFloat(style.gap) || 0,
    rowGap: parseFloat(style.rowGap) || 0,
    columnGap: parseFloat(style.columnGap) || 0,
    padding: parsePaddingPayload(style),
    isFormField: isFieldElement(element),
  };
}

function parsePaddingPayload(style) {
  return {
    top: parseFloat(style.paddingTop) || 0,
    right: parseFloat(style.paddingRight) || 0,
    bottom: parseFloat(style.paddingBottom) || 0,
    left: parseFloat(style.paddingLeft) || 0,
  };
}

function parseLineHeight(lineHeight, fontSize) {
  if (!lineHeight || lineHeight === "normal") {
    return Math.round((parseFloat(fontSize) || 16) * 1.4);
  }

  const parsed = parseFloat(lineHeight);
  return Number.isFinite(parsed)
    ? parsed
    : Math.round((parseFloat(fontSize) || 16) * 1.4);
}

function normalizeFontWeight(fontWeight) {
  const parsed = parseInt(fontWeight, 10);
  return Number.isFinite(parsed) ? parsed : 400;
}

function normalizeText(textContent) {
  return String(textContent || "")
    .replace(/\s+/g, " ")
    .trim();
}

function isVisibleColor(value) {
  if (!value || value === "transparent") {
    return false;
  }

  const match = value.match(/rgba?\(([^)]+)\)/i);
  if (!match) {
    return true;
  }

  const parts = match[1].split(",").map((part) => part.trim());
  if (parts.length < 4) {
    return true;
  }

  return parseFloat(parts[3]) > 0.01;
}

function normalizeZIndex(zIndex) {
  if (zIndex === "auto") {
    return 0;
  }

  const parsed = parseInt(zIndex, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampOpacity(value) {
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }

  if (parsed < 0) {
    return 0;
  }

  if (parsed > 1) {
    return 1;
  }

  return parsed;
}

function getPageBackgroundColor() {
  const bodyColor = window.getComputedStyle(document.body).backgroundColor;
  if (isVisibleColor(bodyColor)) {
    return toSerializableColor(bodyColor) || bodyColor;
  }

  const rootColor = window.getComputedStyle(document.documentElement).backgroundColor;
  if (isVisibleColor(rootColor)) {
    return toSerializableColor(rootColor) || rootColor;
  }

  return "#ffffff";
}

function buildDocumentFills() {
  return [
    {
      type: "solid",
      color: getPageBackgroundColor(),
    },
  ];
}

function deriveNodeName(element, fallback) {
  const tagName = element.tagName.toLowerCase();
  const id = element.getAttribute("id");
  const ariaLabel = element.getAttribute("aria-label");
  const dataTestId = element.getAttribute("data-testid");
  const placeholder = element.getAttribute("placeholder");
  const className =
    typeof element.className === "string" ? element.className : "";
  const primaryClass = className.split(/\s+/).filter(Boolean)[0];

  return (
    ariaLabel ||
    dataTestId ||
    (id ? `${tagName}#${id}` : "") ||
    (placeholder ? `${tagName}:${placeholder}` : "") ||
    primaryClass ||
    fallback ||
    tagName
  );
}

function isImageLikeElement(element) {
  return (
    element instanceof HTMLImageElement ||
    element instanceof SVGElement ||
    element instanceof HTMLCanvasElement
  );
}

function isFieldElement(element) {
  const tagName = element.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select";
}

function isLayoutContainer(style) {
  return (
    style.display === "flex" ||
    style.display === "inline-flex" ||
    style.display === "grid" ||
    style.display === "inline-grid"
  );
}

function isSemanticContainer(tagName) {
  return [
    "form",
    "main",
    "section",
    "article",
    "header",
    "footer",
    "aside",
    "nav",
    "button",
    "label",
    "a",
    "ul",
    "ol",
    "li",
  ].includes(tagName);
}

function isExplicitStructuralElement(tagName) {
  return ["form", "main", "section", "article", "header", "footer", "nav", "aside"].includes(
    String(tagName || "").toLowerCase(),
  );
}

function sortLayers(layers) {
  return [...layers].sort((left, right) => {
    if (left.zIndex !== right.zIndex) {
      return left.zIndex - right.zIndex;
    }

    if (left.y !== right.y) {
      return left.y - right.y;
    }

    if (left.x !== right.x) {
      return left.x - right.x;
    }

    return left.id.localeCompare(right.id);
  });
}

function nextLayerId(context) {
  context.order += 1;
  return `node-${context.order}`;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function clamp(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function toPlaceholderColor(colorValue) {
  const parsed = parseCssColor(colorValue);
  if (!parsed) {
    return "rgba(100, 116, 139, 0.7)";
  }

  const alpha = clamp(parsed.a * 0.65, 0, 1, 0.7);
  return `rgba(${Math.round(parsed.r * 255)}, ${Math.round(parsed.g * 255)}, ${Math.round(parsed.b * 255)}, ${round(alpha)})`;
}

function toSerializableColor(value) {
  const parsed = parseCssColor(value);
  if (parsed) {
    return toRgbaString(parsed);
  }

  const browserColor = readBrowserNormalizedColor(value);
  if (!browserColor) {
    return null;
  }

  const reparsed = parseCssColor(browserColor);
  return reparsed ? toRgbaString(reparsed) : browserColor;
}

function toRgbaString(color) {
  return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${round(color.a)})`;
}

function readBrowserNormalizedColor(value) {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue || normalizedValue === "transparent") {
    return null;
  }

  if (typeof CSS !== "undefined" && CSS.supports && !CSS.supports("color", normalizedValue)) {
    return null;
  }

  const context = getColorCanvasContext();
  if (!context) {
    return null;
  }

  context.fillStyle = "#010203";
  context.fillStyle = normalizedValue;
  return context.fillStyle || null;
}

let colorCanvasContext = null;

function getColorCanvasContext() {
  if (colorCanvasContext) {
    return colorCanvasContext;
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  colorCanvasContext = context;
  return colorCanvasContext;
}

async function captureImageElement(element) {
  if (element instanceof HTMLCanvasElement) {
    return {
      type: "canvas",
      dataUrl: element.toDataURL("image/png"),
    };
  }

  if (element instanceof SVGElement) {
    const rasterizedDataUrl = await rasterizeSvgElementToPngDataUrl(element).catch(
      () => null,
    );

    return {
      type: "svg",
      dataUrl: rasterizedDataUrl,
      sourceDataUrl: serializeSvgToDataUrl(element),
    };
  }

  if (element instanceof HTMLImageElement) {
    const imageData = await imageToDataUrl(element).catch(() => null);

    return {
      type: "image",
      dataUrl: imageData,
      srcUrl: element.currentSrc || element.src || "",
      alt: element.alt || "",
    };
  }

  return {
    type: "unknown",
    dataUrl: null,
  };
}

async function imageToDataUrl(imageElement) {
  if (
    !imageElement.complete ||
    !imageElement.naturalWidth ||
    !imageElement.naturalHeight
  ) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = imageElement.naturalWidth;
  canvas.height = imageElement.naturalHeight;
  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  context.drawImage(imageElement, 0, 0);
  return canvas.toDataURL("image/png");
}

function serializeSvgToDataUrl(svgElement) {
  const xml = new XMLSerializer().serializeToString(svgElement);
  const encoded = window.btoa(unescape(encodeURIComponent(xml)));
  return `data:image/svg+xml;base64,${encoded}`;
}

async function rasterizeSvgElementToPngDataUrl(svgElement) {
  const rect = svgElement.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width || 1));
  const height = Math.max(1, Math.round(rect.height || 1));
  const dataUrl = serializeSvgToDataUrl(svgElement);
  const image = await loadImage(dataUrl);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not create a canvas context for SVG rasterization.");
  }

  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/png");
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image resource."));
    image.src = src;
  });
}
