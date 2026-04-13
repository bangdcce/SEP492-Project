figma.showUI(__html__, {
  width: 420,
  height: 520,
  themeColors: true,
});

figma.ui.onmessage = async (message) => {
  if (!message || !message.type) {
    return;
  }

  if (message.type === "CLOSE_PLUGIN") {
    figma.closePlugin();
    return;
  }

  if (message.type !== "IMPORT_CAPTURE") {
    return;
  }

  try {
    const payload = message.payload;
    validatePayload(payload);

    const fontIndex = await buildFontIndex();
    const rootFrame = createDocumentFrame(payload);
    const sourceLayers = getSourceLayers(payload);
    const skippedNodes = [];
    let importedCount = 0;

    for (const layer of sourceLayers) {
      const sceneNode = await createSceneNode(layer, fontIndex, { x: 0, y: 0 }, skippedNodes);
      if (!sceneNode) {
        continue;
      }

      rootFrame.appendChild(sceneNode);
      importedCount += countSourceLayerTree(layer);
    }

    figma.currentPage.appendChild(rootFrame);
    figma.currentPage.selection = [rootFrame];
    figma.viewport.scrollAndZoomIntoView([rootFrame]);

    if (skippedNodes.length > 0) {
      rootFrame.setPluginData("skippedLayerCount", String(skippedNodes.length));
      rootFrame.setPluginData(
        "skippedLayerSummary",
        JSON.stringify(skippedNodes.slice(0, 50)),
      );
    }

    const summary =
      skippedNodes.length > 0
        ? `Imported ${importedCount} layers into "${rootFrame.name}" with ${skippedNodes.length} skipped layers.`
        : `Imported ${importedCount} layers into "${rootFrame.name}".`;

    figma.notify(summary);
    figma.ui.postMessage({
      type: "IMPORT_COMPLETE",
      summary,
    });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    figma.notify(messageText, { error: true });
    figma.ui.postMessage({
      type: "IMPORT_ERROR",
      error: messageText,
    });
  }
};

function validatePayload(payload) {
  if (!payload || payload.format !== "html-capture-kit") {
    throw new Error("Unsupported capture file.");
  }

  if (!payload.document) {
    throw new Error("Capture file is missing document metadata.");
  }

  if (!payload.root && !Array.isArray(payload.nodes)) {
    throw new Error("Capture file has no importable layers.");
  }
}

function getSourceLayers(payload) {
  if (payload.root && Array.isArray(payload.root.children)) {
    return payload.root.children;
  }

  if (Array.isArray(payload.nodes)) {
    return payload.nodes;
  }

  return [];
}

function createDocumentFrame(payload) {
  const frame = figma.createFrame();
  frame.name =
    (payload.root && payload.root.name) ||
    payload.source.title ||
    "Imported HTML Capture";
  frame.resize(
    Math.max(1, Math.round(payload.document.width || 1)),
    Math.max(1, Math.round(payload.document.height || 1)),
  );
  frame.clipsContent = false;

  const rootFills = payload.root && Array.isArray(payload.root.fills) ? payload.root.fills : null;
  const paints = buildPaints(rootFills);

  if (paints.length > 0) {
    frame.fills = paints;
  } else {
    const backgroundColor = parseCssColor(payload.document.backgroundColor || "#ffffff");
    frame.fills = backgroundColor
      ? [
          {
            type: "SOLID",
            color: toFigmaRgb(backgroundColor),
            opacity: backgroundColor.a,
          },
        ]
      : [];
  }

  const stamp = new Date(payload.capturedAt || Date.now())
    .toISOString()
    .replace("T", " ")
    .replace("Z", " UTC");

  frame.setPluginData("sourceUrl", String(payload.source.url || ""));
  frame.setPluginData("capturedAt", stamp);
  frame.setPluginData("captureVersion", String(payload.version || "unknown"));
  return frame;
}

async function buildFontIndex() {
  const fonts = await figma.listAvailableFontsAsync();
  const exact = new Map();
  const families = new Map();

  for (const font of fonts) {
    const key = createFontKey(font.fontName.family, font.fontName.style);
    const familyKey = normalizeFontFamilyName(font.fontName.family);
    exact.set(key, font.fontName);

    if (!families.has(familyKey)) {
      families.set(familyKey, []);
    }

    families.get(familyKey).push(font.fontName);
  }

  return {
    exact,
    families,
  };
}

async function createSceneNode(layer, fontIndex, parentOrigin, skippedNodes) {
  if (!layer || !layer.kind) {
    return null;
  }

  try {
    switch (layer.kind) {
      case "frame":
        return await createFrameNode(layer, fontIndex, parentOrigin, skippedNodes);
      case "text":
        return await createTextNode(layer, fontIndex, parentOrigin);
      case "image":
        return createImageNode(layer, parentOrigin);
      case "box":
        return createLegacyBoxNode(layer, parentOrigin);
      default:
        skippedNodes.push({
          name: layer.name || "unknown",
          reason: `unsupported kind: ${layer.kind}`,
        });
        return null;
    }
  } catch (error) {
    skippedNodes.push({
      name: layer.name || "unknown",
      reason: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function createFrameNode(layer, fontIndex, parentOrigin, skippedNodes) {
  const node = figma.createFrame();
  applyGeometry(node, layer, parentOrigin);
  node.name = layer.name || layer.tagName || "Frame";
  node.opacity = clamp(layer.opacity, 0, 1, 1);
  node.clipsContent = shouldClipLayer(layer);

  applyPaintsToNode(node, layer.fills);
  applyStrokeToNode(node, layer.stroke);
  applyBorderRadius(node, layer.borderRadius);
  applyEffectsToNode(node, layer.effects);
  applyLayerMetadata(node, layer);

  const childOrigin = {
    x: numberOrZero(layer.x),
    y: numberOrZero(layer.y),
  };

  const children = Array.isArray(layer.children) ? layer.children : [];
  for (const child of children) {
    const childNode = await createSceneNode(child, fontIndex, childOrigin, skippedNodes);
    if (childNode) {
      node.appendChild(childNode);
    }
  }

  return node;
}

async function createTextNode(layer, fontIndex, parentOrigin) {
  const node = figma.createText();
  const box = resolveTextBoxMetrics(layer);
  node.x = box.x - numberOrZero(parentOrigin.x);
  node.y = box.y - numberOrZero(parentOrigin.y);
  node.name = layer.name || "Text";
  node.opacity = clamp(layer.opacity, 0, 1, 1);

  const requestedFont = resolveFontName(layer.text || {}, fontIndex);
  await figma.loadFontAsync(requestedFont);

  node.fontName = requestedFont;
  node.characters = String(layer.text && layer.text.content ? layer.text.content : "");
  node.fontSize = Math.max(1, numberOrZero(layer.text && layer.text.fontSize) || 16);
  node.textAlignHorizontal = box.align;
  node.textAutoResize = box.mode === "container" ? "HEIGHT" : "WIDTH_AND_HEIGHT";
  if (box.mode === "container") {
    node.resize(box.width, box.height);
  }
  node.lineHeight = {
    unit: "PIXELS",
    value: Math.max(1, numberOrZero(layer.text && layer.text.lineHeight) || 22),
  };
  node.letterSpacing = {
    unit: "PIXELS",
    value: numberOrZero(layer.text && layer.text.letterSpacing),
  };

  const textColor = parseCssColor(layer.text && layer.text.color ? layer.text.color : "#111111");
  node.fills = textColor
    ? [
        {
          type: "SOLID",
          color: toFigmaRgb(textColor),
          opacity: textColor.a,
        },
      ]
    : [];

  applyLayerMetadata(node, layer);
  return node;
}

function createImageNode(layer, parentOrigin) {
  const node = figma.createRectangle();
  applyGeometry(node, layer, parentOrigin);
  node.name = layer.name || layer.tagName || "Image";
  node.opacity = clamp(layer.opacity, 0, 1, 1);
  applyBorderRadius(node, layer.borderRadius);
  applyEffectsToNode(node, layer.effects);

  const dataUrl = layer.image && layer.image.dataUrl;
  if (!dataUrl) {
    applyImagePlaceholderFill(node);
    applyLayerMetadata(node, layer);
    return node;
  }

  try {
    const imageBytes = dataUrlToBytes(dataUrl);
    const image = figma.createImage(imageBytes);
    node.fills = [
      {
        type: "IMAGE",
        imageHash: image.hash,
        scaleMode: "FILL",
      },
    ];
  } catch (error) {
    applyImagePlaceholderFill(node);
    node.setPluginData(
      "imageImportError",
      error instanceof Error ? error.message : String(error),
    );
    if (layer.image && layer.image.srcUrl) {
      node.setPluginData("imageSourceUrl", String(layer.image.srcUrl));
    }
  }

  applyLayerMetadata(node, layer);
  return node;
}

function createLegacyBoxNode(layer, parentOrigin) {
  const node = figma.createRectangle();
  applyGeometry(node, layer, parentOrigin);
  node.name = layer.name || layer.tagName || "Box";
  node.opacity = clamp(layer.opacity, 0, 1, 1);
  applyPaintsToNode(node, layer.fills);
  applyStrokeToNode(node, layer.stroke);
  applyBorderRadius(node, layer.borderRadius || createUniformRadius(layer.radius || 0));
  applyEffectsToNode(node, layer.effects);
  applyLayerMetadata(node, layer);
  return node;
}

function applyGeometry(node, layer, parentOrigin) {
  node.x = numberOrZero(layer.x) - numberOrZero(parentOrigin.x);
  node.y = numberOrZero(layer.y) - numberOrZero(parentOrigin.y);
  node.resize(
    Math.max(1, numberOrZero(layer.width)),
    Math.max(1, numberOrZero(layer.height)),
  );
}

function applyLayerMetadata(node, layer) {
  node.setPluginData("sourceLayerId", String(layer.id || ""));
  node.setPluginData("sourceTag", String(layer.tagName || ""));
  node.setPluginData("sourceKind", String(layer.kind || ""));

  if (layer.layout) {
    node.setPluginData("sourceLayout", JSON.stringify(layer.layout));
  }
}

function shouldClipLayer(layer) {
  const layout = layer.layout || {};
  return (
    layout.overflowX === "hidden" ||
    layout.overflowY === "hidden" ||
    layout.overflowX === "clip" ||
    layout.overflowY === "clip"
  );
}

function applyPaintsToNode(node, fillPayload) {
  const paints = buildPaints(fillPayload);
  node.fills = paints;
}

function buildPaints(fillPayload) {
  if (!Array.isArray(fillPayload) || fillPayload.length === 0) {
    return [];
  }

  const paints = [];
  for (const fill of fillPayload) {
    if (!fill || fill.type !== "solid" || !fill.color) {
      continue;
    }

    const parsed = parseCssColor(fill.color);
    if (!parsed) {
      continue;
    }

    paints.push({
      type: "SOLID",
      color: toFigmaRgb(parsed),
      opacity: parsed.a,
    });
  }

  return paints;
}

function applyStrokeToNode(node, strokePayload) {
  if (!strokePayload || !strokePayload.color) {
    node.strokes = [];
    return;
  }

  const parsed = parseCssColor(strokePayload.color);
  if (!parsed) {
    node.strokes = [];
    return;
  }

  node.strokes = [
    {
      type: "SOLID",
      color: toFigmaRgb(parsed),
      opacity: parsed.a,
    },
  ];
  node.strokeWeight = Math.max(1, numberOrZero(strokePayload.width) || 1);
}

function applyBorderRadius(node, radiusPayload) {
  const radius = normalizeRadiusPayload(radiusPayload);

  if (
    radius.topLeft === radius.topRight &&
    radius.topLeft === radius.bottomRight &&
    radius.topLeft === radius.bottomLeft
  ) {
    if ("cornerRadius" in node) {
      node.cornerRadius = radius.topLeft;
    }
    return;
  }

  if ("topLeftRadius" in node) {
    node.topLeftRadius = radius.topLeft;
    node.topRightRadius = radius.topRight;
    node.bottomRightRadius = radius.bottomRight;
    node.bottomLeftRadius = radius.bottomLeft;
  } else if ("cornerRadius" in node) {
    node.cornerRadius = Math.max(
      radius.topLeft,
      radius.topRight,
      radius.bottomRight,
      radius.bottomLeft,
    );
  }
}

function applyEffectsToNode(node, effectsPayload) {
  if (!Array.isArray(effectsPayload) || effectsPayload.length === 0) {
    node.effects = [];
    return;
  }

  const effects = [];

  for (const effect of effectsPayload) {
    if (!effect) {
      continue;
    }

    if (effect.type === "background-blur") {
      effects.push({
        type: "BACKGROUND_BLUR",
        visible: true,
        radius: Math.max(0, numberOrZero(effect.radius)),
      });
      continue;
    }

    if (effect.type !== "drop-shadow" || !effect.color) {
      continue;
    }

    const parsed = parseCssColor(effect.color);
    if (!parsed) {
      continue;
    }

    effects.push({
      type: "DROP_SHADOW",
      visible: true,
      blendMode: "NORMAL",
      color: {
        r: parsed.r,
        g: parsed.g,
        b: parsed.b,
        a: parsed.a,
      },
      offset: {
        x: numberOrZero(effect.offsetX),
        y: numberOrZero(effect.offsetY),
      },
      radius: Math.max(0, numberOrZero(effect.blur)),
    });
  }

  node.effects = effects;
}

function normalizeRadiusPayload(radiusPayload) {
  if (!radiusPayload || typeof radiusPayload !== "object") {
    return createUniformRadius(0);
  }

  return {
    topLeft: numberOrZero(radiusPayload.topLeft),
    topRight: numberOrZero(radiusPayload.topRight),
    bottomRight: numberOrZero(radiusPayload.bottomRight),
    bottomLeft: numberOrZero(radiusPayload.bottomLeft),
  };
}

function createUniformRadius(value) {
  return {
    topLeft: numberOrZero(value),
    topRight: numberOrZero(value),
    bottomRight: numberOrZero(value),
    bottomLeft: numberOrZero(value),
  };
}

function countSourceLayerTree(layer) {
  if (!layer || typeof layer !== "object") {
    return 0;
  }

  const children = Array.isArray(layer.children) ? layer.children : [];
  return 1 + children.reduce((sum, child) => sum + countSourceLayerTree(child), 0);
}

function resolveTextBoxMetrics(layer) {
  const text = layer && layer.text ? layer.text : {};
  const mode = String(text.boxMode || "tight").toLowerCase() === "container" ? "container" : "tight";
  const align = mapTextAlign(text.textAlign);
  const fontSize = Math.max(1, numberOrZero(text.fontSize) || 16);
  const lineHeight = Math.max(1, numberOrZero(text.lineHeight) || fontSize * 1.4);
  const lineCount = Math.max(1, numberOrZero(text.lineCount) || 1);

  if (mode !== "container") {
    return {
      mode,
      align,
      x: numberOrZero(layer.x),
      y: numberOrZero(layer.y),
      width: Math.max(1, numberOrZero(layer.width)),
      height: Math.max(1, numberOrZero(layer.height)),
    };
  }

  const widthBuffer = getTextWidthBuffer(fontSize, lineCount, align);
  const xOffset = align === "CENTER" ? widthBuffer / 2 : align === "RIGHT" ? widthBuffer : 0;

  return {
    mode,
    align,
    x: numberOrZero(layer.x) - xOffset,
    y: numberOrZero(layer.y),
    width: Math.max(1, numberOrZero(layer.width) + widthBuffer),
    height: Math.max(1, Math.max(numberOrZero(layer.height), lineHeight * lineCount)),
  };
}

function getTextWidthBuffer(fontSize, lineCount, align) {
  const baseBuffer = Math.ceil(fontSize * 0.35);
  const singleLineBonus = lineCount <= 1 ? Math.ceil(fontSize * 0.25) : Math.ceil(fontSize * 0.1);
  const alignBonus = align === "CENTER" ? 4 : align === "RIGHT" ? 2 : 0;
  return Math.max(6, baseBuffer + singleLineBonus + alignBonus);
}

function applyImagePlaceholderFill(node) {
  node.fills = [
    {
      type: "SOLID",
      color: {
        r: 0.91,
        g: 0.94,
        b: 0.97,
      },
    },
  ];
}

function resolveFontName(textLayer, fontIndex) {
  const familyCandidates = buildFontFamilyCandidates(textLayer.fontFamily);
  const targetWeight = Number(textLayer.fontWeight) || 400;
  const targetItalic = String(textLayer.fontStyle || "").toLowerCase() === "italic";

  for (const family of familyCandidates) {
    const familyMatch = findBestFontForFamily(family, targetWeight, targetItalic, fontIndex);
    if (familyMatch) {
      return familyMatch;
    }
  }

  const interFallback = findBestFontForFamily("Inter", targetWeight, targetItalic, fontIndex);
  if (interFallback) {
    return interFallback;
  }

  const robotoFallback = findBestFontForFamily("Roboto", targetWeight, targetItalic, fontIndex);
  if (robotoFallback) {
    return robotoFallback;
  }

  const firstFamily = fontIndex.families.values().next().value;
  return Array.isArray(firstFamily) && firstFamily.length > 0
    ? firstFamily[0]
    : { family: "Inter", style: "Regular" };
}

function createFontKey(family, style) {
  return `${String(family || "").trim().toLowerCase()}::${String(style || "")
    .trim()
    .toLowerCase()}`;
}

function extractPrimaryFontFamily(fontFamily) {
  const first = String(fontFamily || "Inter")
    .split(",")[0]
    .replace(/["']/g, "")
    .trim();

  return first || "Inter";
}

function buildFontFamilyCandidates(fontFamily) {
  const rawCandidates = String(fontFamily || "Inter")
    .split(",")
    .map((part) => part.replace(/["']/g, "").trim())
    .filter(Boolean);
  const candidates = [];

  for (const family of rawCandidates) {
    pushUnique(candidates, family);

    const aliases = getFontFamilyAliases(family);
    for (const alias of aliases) {
      pushUnique(candidates, alias);
    }
  }

  pushUnique(candidates, extractPrimaryFontFamily(fontFamily));
  pushUnique(candidates, "Inter");
  return candidates;
}

function getFontFamilyAliases(family) {
  const normalized = normalizeFontFamilyName(family);

  const aliases = {
    geist: ["Inter"],
    "geist mono": ["Roboto Mono"],
    "geist mono fallback": ["Roboto Mono"],
    "system-ui": ["Inter", "Roboto", "Arial"],
    "ui-sans-serif": ["Inter", "Roboto", "Arial"],
    "sans-serif": ["Inter", "Roboto", "Arial"],
    "ui-serif": ["Georgia", "Times New Roman"],
    serif: ["Georgia", "Times New Roman"],
    "ui-monospace": ["Roboto Mono", "Courier New"],
    monospace: ["Roboto Mono", "Courier New"],
  };

  return aliases[normalized] || [];
}

function normalizeFontFamilyName(family) {
  return String(family || "")
    .replace(/["']/g, "")
    .trim()
    .toLowerCase();
}

function pushUnique(target, value) {
  if (!value) {
    return;
  }

  if (!target.includes(value)) {
    target.push(value);
  }
}

function findBestFontForFamily(family, targetWeight, targetItalic, fontIndex) {
  const requestedStyle = mapFontStyle(targetWeight, targetItalic ? "italic" : "normal");
  const exactKey = createFontKey(family, requestedStyle);

  if (fontIndex.exact.has(exactKey)) {
    return fontIndex.exact.get(exactKey);
  }

  const availableFonts = fontIndex.families.get(normalizeFontFamilyName(family));
  if (!Array.isArray(availableFonts) || availableFonts.length === 0) {
    return null;
  }

  let bestFont = availableFonts[0];
  let bestScore = Number.POSITIVE_INFINITY;

  for (const fontName of availableFonts) {
    const score = scoreFontStyle(fontName.style, targetWeight, targetItalic);
    if (score < bestScore) {
      bestScore = score;
      bestFont = fontName;
    }
  }

  return bestFont;
}

function scoreFontStyle(styleName, targetWeight, targetItalic) {
  const normalizedStyle = String(styleName || "").toLowerCase();
  const styleWeight = estimateFontWeightFromStyle(normalizedStyle);
  const styleItalic = normalizedStyle.includes("italic") || normalizedStyle.includes("oblique");
  const italicPenalty = styleItalic === targetItalic ? 0 : 200;
  return Math.abs(styleWeight - targetWeight) + italicPenalty;
}

function estimateFontWeightFromStyle(styleName) {
  if (styleName.includes("thin")) {
    return 100;
  }

  if (styleName.includes("extra light") || styleName.includes("ultra light")) {
    return 200;
  }

  if (styleName.includes("light")) {
    return 300;
  }

  if (styleName.includes("medium")) {
    return 500;
  }

  if (styleName.includes("semi bold") || styleName.includes("semibold") || styleName.includes("demi")) {
    return 600;
  }

  if (styleName.includes("extra bold") || styleName.includes("ultra bold")) {
    return 800;
  }

  if (styleName.includes("black") || styleName.includes("heavy")) {
    return 900;
  }

  if (styleName.includes("bold")) {
    return 700;
  }

  return 400;
}

function mapFontStyle(weight, fontStyle) {
  const numericWeight = Number(weight) || 400;
  const isItalic = String(fontStyle || "").toLowerCase() === "italic";

  let style = "Regular";
  if (numericWeight >= 700) {
    style = "Bold";
  } else if (numericWeight >= 600) {
    style = "Semi Bold";
  } else if (numericWeight >= 500) {
    style = "Medium";
  }

  if (isItalic) {
    return style === "Regular" ? "Italic" : `${style} Italic`;
  }

  return style;
}

function mapTextAlign(value) {
  switch (String(value || "").toLowerCase()) {
    case "center":
      return "CENTER";
    case "right":
      return "RIGHT";
    case "justified":
      return "JUSTIFIED";
    default:
      return "LEFT";
  }
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
      normalized.length === 8
        ? parseInt(normalized.slice(6, 8), 16) / 255
        : 1;
    return { r, g, b, a };
  }

  return null;
}

function toFigmaRgb(color) {
  return {
    r: color.r,
    g: color.g,
    b: color.b,
  };
}

function dataUrlToBytes(dataUrl) {
  const parts = String(dataUrl || "").split(",");
  if (parts.length < 2) {
    throw new Error("Invalid image data URL.");
  }

  const base64 = parts[1].replace(/\s+/g, "");
  return decodeBase64ToBytes(base64);
}

function decodeBase64ToBytes(base64) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup = new Uint8Array(256);

  for (let index = 0; index < lookup.length; index += 1) {
    lookup[index] = 255;
  }

  for (let index = 0; index < alphabet.length; index += 1) {
    lookup[alphabet.charCodeAt(index)] = index;
  }

  const sanitized = String(base64 || "").replace(/=+$/, "");
  if (sanitized.length === 0) {
    return new Uint8Array(0);
  }

  const outputLength = Math.floor((sanitized.length * 3) / 4);
  const bytes = new Uint8Array(outputLength);
  let buffer = 0;
  let bits = 0;
  let offset = 0;

  for (let index = 0; index < sanitized.length; index += 1) {
    const code = sanitized.charCodeAt(index);
    const value = lookup[code];

    if (value === 255) {
      throw new Error("Invalid base64 image data.");
    }

    buffer = (buffer << 6) | value;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      bytes[offset] = (buffer >> bits) & 0xff;
      offset += 1;
    }
  }

  return offset === bytes.length ? bytes : bytes.slice(0, offset);
}

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}
