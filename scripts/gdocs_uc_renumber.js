/**
 * Google Docs Apps Script helper for UC numbering.
 *
 * How to use:
 * 1) Open your Google Doc.
 * 2) Extensions -> Apps Script.
 * 3) Paste this file.
 * 4) Run previewHeadingMappingFromProvidedUcList() first.
 * 5) If preview looks correct, run applyHeadingMappingFromProvidedUcList().
 */

const PROVIDED_UC_LIST_RAW = `
UC-01 View Public Landing Page
UC-02 Register Account
UC-03 Login
UC-04 Logout
UC-05 View Profile
UC-06 View Others Feedback
UC-07 Report Feedback
UC-08 Delete Account
UC-09 Edit Profile
UC-10 Forgot password
UC-11 Check KYC Status
UC-12 Register KYC
UC-13 Create Request
UC-14 Post Request To Marketplace
UC-15 Make Request Private
UC-16 Delete Request
UC-17 View List Current Request
UC-18 View Request Detail
UC-19 View Contract
UC-20 Sign Contract
UC-21 Edit Request
UC-22 View Application
UC-23 Approve/Reject Application
UC-24 Review Final Specification
UC-25 Review Client Specification
UC-26 View List Available Broker
UC-27 View Profile Detail
UC-28 Invite To Request
UC-29 View List Freelancer Recommendation
UC-30 View Subscription
UC-31 Register New Subscription
UC-32 Cancel Subscription
UC-33 View List Current Project
UC-34 View Project Detail
UC-35 View List Milestone
UC-36 View Milestone Detail
UC-37 Finalize Milestones
UC-38 View Current Progress
UC-39 Chat Drawer
UC-40 View Kanban Board
UC-41 Drag Item
UC-42 Cancel Project
UC-43 Rate Other User
UC-44 View List Of Active Dispute
UC-45 Create Dispute
UC-46 View Dispute Information
UC-47 Add Evidence
UC-48 Report Dispute
UC-49 Export Dispute Log
UC-50 View Wallet
UC-51 Choose Payment Method
UC-52 Payment
UC-53 View List Cashout Item
UC-54 Cashout
UC-55 View Request Invitation
UC-56 View Invitation Detail
UC-57 Accept/Deny Invitation
UC-58 View Broker's Spec workspace
UC-59 Update Project Specification
UC-60 Submit Final Specification
UC-61 Create Client Specification
UC-62 Finalize Specification
UC-63 View Public Request
UC-64 View Public Request Detail
UC-65 Apply To Public Request
UC-66 Delete Board Item
UC-67 Edit Board Item
UC-68 Create New Board Item
UC-69 Create New Milestone
UC-70 Edit Milestone
UC-71 Delete Milestone
UC-72 Create Contract
UC-73 View Board Item Detail
UC-74 Edit Board Comment Item
UC-75 Delete Board Comment Item
UC-76 Export Workspace Chat Log
UC-77 Create Board Comment Item
UC-78 Submit Done Item
UC-79 View Notification
UC-80 Staff leave request form
UC-81 View Statistic Staff
UC-82 View List User KYC Request
UC-83 View List User KYC Request Detail
UC-84 Approve/Reject Request
UC-85 View Hearing List
UC-86 View Hearing Detail
UC-87 Control Hearing Session
UC-88 Control Hearing Phase & Speaker
UC-89 Manage Hearing Statements & Q&A
UC-90 Manage Hearing Evidence Intake
UC-91 Issue Hearing Verdict
UC-92 View List Dispute
UC-93 View Dispute Specific Information
UC-94 Solve Dispute
UC-95 View List Feedback Report
UC-96 View List Feedback Report Detail
UC-97 Delete Feedback
UC-98 Restore Feedback
UC-99 Review Done Item
UC-100 Edit Client's Spec
UC-101 Reviewing leave requests for staff
UC-102 View List User Account
UC-103 View Account Detail
UC-104 Ban/Unban Account
UC-105 View System Log
UC-106 Export Log
UC-107 View Statistic
UC-108 View Current Wizard Question
UC-109 View Detail Wizard Question
UC-110 Edit Wizard Question
UC-111 View List Available Freelancer
`;

const PROVIDED_UC_ENTRIES = parseProvidedUcEntries_(PROVIDED_UC_LIST_RAW);

const HEADING_MAPPING_CONFIG = {
  onlyHeadingParagraphs: true,
  allowedHeadings: [
    DocumentApp.ParagraphHeading.HEADING2,
    DocumentApp.ParagraphHeading.HEADING3,
    DocumentApp.ParagraphHeading.HEADING4,
    DocumentApp.ParagraphHeading.HEADING5,
    DocumentApp.ParagraphHeading.HEADING6,
  ],
  sectionPattern: /^3\.(\d+)\s+/, // e.g. "3.58 ..."
  includeUcCodeSuffix: false, // true -> "3.58 Title (UC-58)"
  enforceHeadingStyle: true,
  targetHeadingLevel: DocumentApp.ParagraphHeading.HEADING3,
  // Based on docs/system_detailed_design.html h3 style.
  textStyle: {
    [DocumentApp.Attribute.FONT_FAMILY]: "Arial",
    [DocumentApp.Attribute.FONT_SIZE]: 13,
    [DocumentApp.Attribute.BOLD]: true,
    [DocumentApp.Attribute.ITALIC]: false,
    [DocumentApp.Attribute.FOREGROUND_COLOR]: "#000000",
    [DocumentApp.Attribute.UNDERLINE]: false,
  },
};

const UC_RENUMBER_CONFIG = {
  startAt: 1,
  onlyHeadingParagraphs: true,
  allowedHeadings: [
    DocumentApp.ParagraphHeading.HEADING2,
    DocumentApp.ParagraphHeading.HEADING3,
    DocumentApp.ParagraphHeading.HEADING4,
    DocumentApp.ParagraphHeading.HEADING5,
    DocumentApp.ParagraphHeading.HEADING6,
  ],
  ucPattern: /\bUC-(\d{1,3})\b/i,
};

function previewUcRenumbering() {
  const matches = getUcParagraphs_(DocumentApp.getActiveDocument().getBody());
  const lines = [];

  for (let i = 0; i < matches.length; i += 1) {
    const expected = formatUcCode_(UC_RENUMBER_CONFIG.startAt + i);
    lines.push(`${i + 1}. ${matches[i].token} -> ${expected} | ${matches[i].text}`);
  }

  Logger.log(`Found ${matches.length} UC headings.`);
  Logger.log(lines.join("\n"));
}

function renumberUcInActiveDoc() {
  const body = DocumentApp.getActiveDocument().getBody();
  const matches = getUcParagraphs_(body);
  let changed = 0;

  for (let i = 0; i < matches.length; i += 1) {
    const item = matches[i];
    const newToken = formatUcCode_(UC_RENUMBER_CONFIG.startAt + i);

    if (item.token === newToken) {
      continue;
    }

    // Replace only the UC token range; this keeps the rest of content unchanged.
    const textEditor = item.paragraph.editAsText();
    const start = item.tokenStart;
    const end = item.tokenStart + item.token.length - 1;
    textEditor.deleteText(start, end);
    textEditor.insertText(start, newToken);
    changed += 1;
  }

  Logger.log(`UC renumber complete. Updated ${changed}/${matches.length} headings.`);
}

/**
 * Preview remapping for section headings like: "3.58 ...".
 * This does not change the document.
 */
function previewHeadingMappingFromProvidedUcList() {
  validateProvidedUcList();

  const headings = getSystemDetailedDesignHeadings_();
  const totalMapped = Math.min(headings.length, PROVIDED_UC_ENTRIES.length);
  const lines = [];

  for (let i = 0; i < totalMapped; i += 1) {
    const expected = buildMappedHeadingText_(i + 1, PROVIDED_UC_ENTRIES[i]);
    lines.push(`${i + 1}. ${headings[i].text} -> ${expected}`);
  }

  Logger.log(
    `Preview complete. Headings found: ${headings.length}. UC list entries: ${PROVIDED_UC_ENTRIES.length}.` +
      ` Will map: ${totalMapped}.`,
  );
  Logger.log(lines.join("\n"));

  if (headings.length !== PROVIDED_UC_ENTRIES.length) {
    Logger.log(
      `Count mismatch: headings=${headings.length}, ucEntries=${PROVIDED_UC_ENTRIES.length}. ` +
        `Extra items will be left unchanged.`,
    );
  }
}

/**
 * Apply remapping to section headings only.
 * It updates heading text and preserves non-heading content, images, and diagrams.
 */
function applyHeadingMappingFromProvidedUcList() {
  validateProvidedUcList();

  const headings = getSystemDetailedDesignHeadings_();
  if (headings.length === 0) {
    throw new Error(
      "No matching section headings found. Please ensure your target lines start with '3.x ' and run previewHeadingMappingFromProvidedUcList() first.",
    );
  }

  const totalMapped = Math.min(headings.length, PROVIDED_UC_ENTRIES.length);
  let changed = 0;

  for (let i = 0; i < totalMapped; i += 1) {
    const block = headings[i];
    const expected = buildMappedHeadingText_(i + 1, PROVIDED_UC_ENTRIES[i]);

    const needsTextUpdate = block.text !== expected;

    if (needsTextUpdate) {
      replaceParagraphText_(block.paragraph, expected);
      changed += 1;
    }

    if (HEADING_MAPPING_CONFIG.enforceHeadingStyle) {
      applyHeadingStyle_(block.paragraph);
    }
  }

  // Normalize style for any remaining 3.x headings not covered by the UC list.
  if (HEADING_MAPPING_CONFIG.enforceHeadingStyle && headings.length > totalMapped) {
    for (let i = totalMapped; i < headings.length; i += 1) {
      applyHeadingStyle_(headings[i].paragraph);
    }
  }

  Logger.log(
    `Mapping complete. Updated ${changed}/${totalMapped} heading(s). ` +
      `Found ${headings.length} heading(s), UC list has ${PROVIDED_UC_ENTRIES.length} item(s).`,
  );

  if (headings.length > PROVIDED_UC_ENTRIES.length) {
    Logger.log(
      `Left unchanged ${headings.length - PROVIDED_UC_ENTRIES.length} trailing heading(s) because UC list is shorter.`,
    );
  }

  if (PROVIDED_UC_ENTRIES.length > headings.length) {
    Logger.log(
      `UC list has ${PROVIDED_UC_ENTRIES.length - headings.length} extra item(s) not applied because heading count is shorter.`,
    );
  }
}

/**
 * Backward-compatibility shim.
 * Some old menus/triggers may still call clearFigures().
 * Keep this function so legacy calls do not fail.
 */
function clearFigures() {
  Logger.log(
    "clearFigures() is deprecated. Running applyHeadingMappingFromProvidedUcList() instead.",
  );
  applyHeadingMappingFromProvidedUcList();
}

/**
 * Optional maintenance helper:
 * remove any old installable triggers that still point to clearFigures.
 */
function cleanupLegacyClearFiguresTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;

  for (let i = 0; i < triggers.length; i += 1) {
    if (triggers[i].getHandlerFunction() === "clearFigures") {
      ScriptApp.deleteTrigger(triggers[i]);
      removed += 1;
    }
  }

  Logger.log(`Removed ${removed} legacy clearFigures trigger(s).`);
}

function validateUcOrderInActiveDoc() {
  const matches = getUcParagraphs_(DocumentApp.getActiveDocument().getBody());

  if (matches.length === 0) {
    Logger.log("No UC token found.");
    return;
  }

  let hasIssue = false;
  const issues = [];

  for (let i = 1; i < matches.length; i += 1) {
    const prev = extractUcNumber_(matches[i - 1].token);
    const curr = extractUcNumber_(matches[i].token);

    if (curr <= prev) {
      hasIssue = true;
      issues.push(
        `Non-increasing at #${i + 1}: ${matches[i - 1].token} -> ${matches[i].token} | ${matches[i].text}`,
      );
    }

    if (curr - prev > 1) {
      hasIssue = true;
      issues.push(
        `Gap after ${matches[i - 1].token}: expected ${formatUcCode_(prev + 1)}, got ${matches[i].token}`,
      );
    }
  }

  if (!hasIssue) {
    Logger.log(`UC order is strictly increasing. Count: ${matches.length}`);
    return;
  }

  Logger.log(`UC order has issues. Count: ${issues.length}`);
  Logger.log(issues.join("\n"));
}

/**
 * Validate the provided UC list itself (strictly increasing, no duplicates, no gaps).
 */
function validateProvidedUcList() {
  if (PROVIDED_UC_ENTRIES.length === 0) {
    throw new Error("Provided UC list is empty.");
  }

  const issues = [];

  for (let i = 1; i < PROVIDED_UC_ENTRIES.length; i += 1) {
    const prev = PROVIDED_UC_ENTRIES[i - 1].ucNumber;
    const curr = PROVIDED_UC_ENTRIES[i].ucNumber;

    if (curr <= prev) {
      issues.push(
        `Non-increasing order at index ${i + 1}: ${PROVIDED_UC_ENTRIES[i - 1].ucCode} -> ${PROVIDED_UC_ENTRIES[i].ucCode}`,
      );
    }

    if (curr - prev > 1) {
      issues.push(
        `Gap after ${PROVIDED_UC_ENTRIES[i - 1].ucCode}: missing ${formatUcCode_(prev + 1)}.`,
      );
    }
  }

  const seen = new Set();
  for (let i = 0; i < PROVIDED_UC_ENTRIES.length; i += 1) {
    const num = PROVIDED_UC_ENTRIES[i].ucNumber;
    if (seen.has(num)) {
      issues.push(`Duplicate UC code: ${PROVIDED_UC_ENTRIES[i].ucCode}`);
    }
    seen.add(num);
  }

  if (issues.length > 0) {
    Logger.log("Provided UC list has issues:\n" + issues.join("\n"));
    throw new Error("Provided UC list validation failed. Check logs for details.");
  }

  Logger.log(
    `Provided UC list is valid. Count=${PROVIDED_UC_ENTRIES.length}, range=${PROVIDED_UC_ENTRIES[0].ucCode}..${PROVIDED_UC_ENTRIES[PROVIDED_UC_ENTRIES.length - 1].ucCode}`,
  );
}

function getSystemDetailedDesignHeadings_() {
  const blocks = [];
  collectParagraphLikeElements_(DocumentApp.getActiveDocument().getBody(), blocks);

  const allowedHeadingSet = new Set(HEADING_MAPPING_CONFIG.allowedHeadings);
  const output = [];
  const fallbackOutput = [];

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    const text = block.getText();

    if (!text || !HEADING_MAPPING_CONFIG.sectionPattern.test(text)) {
      continue;
    }

    if (hasInlineImage_(block)) {
      continue;
    }

    // Fallback bucket: text looks like 3.x heading even if style is Normal Text.
    fallbackOutput.push({ paragraph: block, text });

    if (HEADING_MAPPING_CONFIG.onlyHeadingParagraphs) {
      const heading = getHeadingSafely_(block);
      if (!allowedHeadingSet.has(heading)) {
        continue;
      }
    }

    output.push({ paragraph: block, text });
  }

  // If no styled headings are found, use fallback 3.x lines so mapping still works.
  if (output.length === 0) {
    Logger.log(
      `No styled heading found for 3.x sections. Falling back to ${fallbackOutput.length} plain paragraph match(es).`,
    );
    return fallbackOutput;
  }

  return output;
}

function buildMappedHeadingText_(sectionIndex, ucEntry) {
  const base = `3.${sectionIndex} ${ucEntry.title}`;
  if (HEADING_MAPPING_CONFIG.includeUcCodeSuffix) {
    return `${base} (${ucEntry.ucCode})`;
  }
  return base;
}

function replaceParagraphText_(paragraphLike, newText) {
  const textEditor = paragraphLike.editAsText();
  const oldText = paragraphLike.getText();

  if (oldText.length > 0) {
    textEditor.deleteText(0, oldText.length - 1);
  }

  textEditor.insertText(0, newText);
}

function applyHeadingStyle_(paragraphLike) {
  // Ensure this line is a proper heading level (H3 like the source HTML).
  try {
    if (typeof paragraphLike.setHeading === "function") {
      paragraphLike.setHeading(HEADING_MAPPING_CONFIG.targetHeadingLevel);
    }
  } catch (error) {
    // Ignore if element does not support heading assignment.
  }

  const textEditor = paragraphLike.editAsText();
  const text = paragraphLike.getText();

  if (!text || text.length === 0) {
    return;
  }

  textEditor.setAttributes(0, text.length - 1, HEADING_MAPPING_CONFIG.textStyle);
}

function getUcParagraphs_(body) {
  const blocks = [];
  collectParagraphLikeElements_(body, blocks);

  const allowedHeadingSet = new Set(UC_RENUMBER_CONFIG.allowedHeadings);
  const matches = [];

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];

    if (hasInlineImage_(block)) {
      // Safety: skip paragraphs containing inline images.
      continue;
    }

    if (UC_RENUMBER_CONFIG.onlyHeadingParagraphs) {
      const heading = block.getHeading();
      if (!allowedHeadingSet.has(heading)) {
        continue;
      }
    }

    const text = block.getText();
    if (!text) {
      continue;
    }

    const match = text.match(UC_RENUMBER_CONFIG.ucPattern);
    if (!match || typeof match.index !== "number") {
      continue;
    }

    matches.push({
      paragraph: block,
      text,
      token: match[0].toUpperCase(),
      tokenStart: match.index,
    });
  }

  return matches;
}

function collectParagraphLikeElements_(container, output) {
  const count = container.getNumChildren();

  for (let i = 0; i < count; i += 1) {
    const child = container.getChild(i);
    const type = child.getType();

    if (type === DocumentApp.ElementType.PARAGRAPH) {
      output.push(child.asParagraph());
      continue;
    }

    if (type === DocumentApp.ElementType.LIST_ITEM) {
      // Keep list items for legacy UC token scanning.
      // Mapping flow only uses lines matched by sectionPattern.
      output.push(child.asListItem());
      continue;
    }

    if (type === DocumentApp.ElementType.TABLE) {
      collectParagraphLikeElements_(child.asTable(), output);
      continue;
    }

    if (type === DocumentApp.ElementType.TABLE_ROW) {
      collectParagraphLikeElements_(child.asTableRow(), output);
      continue;
    }

    if (type === DocumentApp.ElementType.TABLE_CELL) {
      collectParagraphLikeElements_(child.asTableCell(), output);
    }
  }
}

function getHeadingSafely_(paragraphLike) {
  try {
    if (typeof paragraphLike.getHeading === "function") {
      return paragraphLike.getHeading();
    }
  } catch (error) {
    // Ignore and treat as non-heading element.
  }

  return null;
}

function hasInlineImage_(paragraphLike) {
  const childCount = paragraphLike.getNumChildren();
  for (let i = 0; i < childCount; i += 1) {
    if (paragraphLike.getChild(i).getType() === DocumentApp.ElementType.INLINE_IMAGE) {
      return true;
    }
  }
  return false;
}

function extractUcNumber_(token) {
  const m = token.match(/UC-(\d{1,3})/i);
  return m ? parseInt(m[1], 10) : NaN;
}

function formatUcCode_(num) {
  return `UC-${String(num).padStart(2, "0")}`;
}

function parseProvidedUcEntries_(rawText) {
  const lines = String(rawText || "").split(/\r?\n/);
  const entries = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) {
      continue;
    }

    const match = line.match(/^UC-(\d{2,3})\s+(.+)$/);
    if (!match) {
      continue;
    }

    entries.push({
      ucCode: `UC-${match[1]}`,
      ucNumber: parseInt(match[1], 10),
      title: match[2].trim(),
    });
  }

  return entries;
}
