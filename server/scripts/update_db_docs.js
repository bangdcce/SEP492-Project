const fs = require('fs');
const path = require('path');

const ENTITIES_DIR = path.join('d:/Đồ án/InterDev/server/src/database/entities');
const HTML_FILE = path.join('d:/Đồ án/InterDev/database_structure.html');

const COMMON_DESCRIPTIONS = {
  // Base
  id: 'Unique identifier for the record.',
  createdAt: 'Timestamp when the record was created.',
  updatedAt: 'Timestamp when the record was last updated.',
  deletedAt: 'Timestamp when the record was soft-deleted.',
  version: 'Version number for optimistic locking.',

  // User & Auth
  email: "User's email address.",
  passwordHash: 'Encrypted password string.',
  fullName: 'Full legal name of the user.',
  role: 'Role of the user in the system (e.g., Client, Freelancer, Admin).',
  phoneNumber: 'Contact phone number.',
  isVerified: 'Indicates if the user/entity identity has been verified.',
  isBanned: 'Indicates if the user is currently banned.',
  banReason: 'Reason for banning the user.',
  bannedAt: 'Timestamp when the user was banned.',
  bannedBy: 'ID of the administrator who banned the user.',
  currentTrustScore: 'Current calculated trust score of the user.',
  totalProjectsFinished: 'Total number of projects successfully completed.',
  totalProjectsCancelled: 'Total number of projects cancelled by the user.',
  totalDisputesLost: 'Total number of disputes lost by the user.',
  totalLateProjects: 'Total number of projects completed after the deadline.',
  resetPasswordOtp: 'One-time password for password reset.',
  resetPasswordOtpExpires: 'Expiration timestamp for the reset OTP.',
  avatarUrl: 'URL to the avatar image.',
  address: 'Physical address string.',
  city: 'City name.',
  country: 'Country name.',
  zipCode: 'Postal or ZIP code.',

  // Auth Session
  userId: 'Reference to the associated User.',
  refreshTokenHash: 'Hashed refresh token.',
  userAgent: 'User agent string of the client device.',
  ipAddress: 'IP address of the client/user.',
  ip_address: 'IP address of the client/user.',
  user_agent: 'User agent string.',
  isRevoked: 'Indicates if the session/token has been revoked.',
  revokedAt: 'Timestamp when the session/token was revoked.',
  expiresAt: 'Timestamp when the record expires.',
  lastUsedAt: 'Timestamp when the session was last active.',
  replacedBySessionId: 'ID of the session that replaced this one.',
  validAccessFrom: 'Timestamp from when the access is valid.',

  // Disputes
  disputeId: 'Reference to the parent Dispute entity.',
  projectId: 'Reference to the associated Project.',
  milestoneId: 'Reference to the specific Milestone in dispute.',
  raisedById: 'ID of the user who raised the dispute.',
  raiserRole: 'Role of the user who raised the dispute.',
  defendantId: 'ID of the user against whom the dispute is raised.',
  defendantRole: 'Role of the defendant.',
  disputeType: 'Type of dispute (e.g., Client vs Freelancer).',
  category: 'Category of the dispute (e.g., Quality, Deadline, Payment).',
  priority: 'Priority level of the dispute.',
  disputedAmount: 'The monetary amount in dispute.',
  reason: 'The primary reason or claim for the dispute.',
  messages: 'Serialized messages associated with the dispute claim.',
  evidence: 'List of URLs pointing to evidence files uploaded by the raiser.',
  defendantResponse: "The defendant's response or counter-argument.",
  defendantEvidence: 'List of URLs pointing to evidence files uploaded by the defendant.',
  defendantRespondedAt: 'Timestamp when the defendant responded.',
  responseDeadline: 'Deadline for the defendant to respond.',
  resolutionDeadline: 'Target deadline for resolving the dispute.',
  isOverdue: 'Indicates if the dispute resolution is overdue.',
  status: 'Current status of the process (e.g., Open, Resolved).',
  result: 'Final result of the dispute (e.g., Win Client, Split).',
  adminComment: 'Public comment from the administrator regarding the resolution.',
  resolvedById: 'ID of the user (admin/staff) who resolved the dispute.',
  resolvedAt: 'Timestamp when the dispute was resolved.',
  parentDisputeId: 'ID of a parent dispute if this is a sub-dispute.',
  groupId: 'ID for grouping related disputes.',
  assignedStaffId: 'ID of the staff member assigned to handle this dispute.',
  assignedAt: 'Timestamp when the staff was assigned.',
  currentTier: 'Current escalation tier of the dispute.',
  escalatedToAdminId: 'ID of the admin if the dispute was escalated.',
  escalatedAt: 'Timestamp when the dispute was escalated.',
  escalationReason: 'Reason for escalating the dispute.',
  acceptedSettlementId: 'ID of the settlement offer that was accepted.',
  isAutoResolved: 'Indicates if the dispute was automatically resolved.',
  settlementAttempts: 'Number of settlement attempts made.',
  isAppealed: 'Indicates if the dispute resolution has been appealed.',
  appealReason: 'Reason for the appeal.',
  appealedAt: 'Timestamp when the appeal was made.',
  appealDeadline: 'Deadline for submitting an appeal.',
  appealResolvedById: 'ID of the user who resolved the appeal.',
  appealResolution: 'Details of the appeal resolution.',
  appealResolvedAt: 'Timestamp when the appeal was resolved.',

  // Dispute Activities & Hearings
  actorId: 'ID of the user or system performing the action.',
  actorRole: 'Role of the actor in the context of the activity.',
  action: 'The specific action performed.',
  description: 'Detailed description of the activity or entity.',
  isInternal: 'Indicates if this record is for internal use only.',
  timestamp: 'Timestamp of the activity.',
  scheduledAt: 'Timestamp when the hearing is scheduled to start.',
  startedAt: 'Timestamp when the hearing actually started.',
  endedAt: 'Timestamp when the hearing ended.',
  agenda: 'Agenda items for the meeting/hearing.',
  externalMeetingLink: 'Link to an external meeting tool (e.g., Zoom, Google Meet).',
  requiredDocuments: 'List of documents required for the process.',
  moderatorId: 'ID of the moderator conducting the hearing.',
  currentSpeakerRole: 'Role of the current speaker in the hearing.',

  // Financial
  walletId: 'ID of the wallet associated with this record.',
  amount: 'The monetary amount.',
  fee: 'Transaction or processing fee.',
  netAmount: 'The net amount after fees.',
  currency: 'Currency code (e.g., VND, USD).',
  transactionId: 'Reference to the associated transaction.',
  referenceType: 'Type of external entity referenced (polymorphic).',
  referenceId: 'ID of the external entity referenced.',
  paymentMethod: 'Method of payment (e.g., Bank Transfer, Credit Card).',
  externalTransactionId: 'Transaction ID from the external payment provider.',
  balanceAfter: 'Wallet balance after the transaction.',
  initiatedBy: 'Who initiated the transaction.',
  relatedTransactionId: 'ID of a related transaction (e.g., hold/release).',
  completedAt: 'Timestamp when the transaction was completed.',
  payoutMethodId: 'ID of the localized payout method used.',
  approvedAt: 'Timestamp when the request was approved.',
  approvedBy: 'ID of the user who approved the request.',
  rejectedAt: 'Timestamp when the request was rejected.',
  rejectedBy: 'ID of the user who rejected the request.',
  rejectionReason: 'Reason for rejection.',
  processedAt: 'Timestamp when the request was processed.',
  processedBy: 'ID of the user who processed the request.',
  externalReference: 'External reference number (e.g., bank ref).',
  note: 'General note or comment.',
  adminNote: 'Note visible only to admins.',
  requestedAt: 'Timestamp when the request was made.',
  pricingModel: 'Pricing model used (e.g., Fixed Price, Hourly).',
  totalBudget: 'Total allocated budget.',

  // Staff Performance
  staffId: 'ID of the staff member.',
  period: 'Time period for the performance record (e.g., 2024-01).',
  totalDisputesAssigned: 'Total disputes assigned during the period.',
  totalDisputesResolved: 'Total disputes resolved during the period.',
  totalDisputesPending: 'Total disputes currently pending.',
  totalAppealed: 'Total number of decisions appealed.',
  totalOverturnedByAdmin: 'Number of decisions overturned by an admin.',
  appealRate: 'Percentage of resolved cases that were appealed.',
  overturnRate: 'Percentage of appealed cases that were overturned.',
  avgResolutionTimeHours: 'Average time taken to resolve a dispute (in hours).',
  avgUserRating: 'Average rating received from users.',
  totalUserRatings: 'Total number of ratings received.',
  totalHearingsConducted: 'Total number of hearings conducted.',
  totalHearingsRescheduled: 'Total number of hearings rescheduled.',
  pendingAppealCases: 'Number of cases currently in appeal.',
  totalCasesFinalized: 'Total number of cases fully finalized.',

  // Auto Schedule Rules
  eventType: 'The type of event this rule applies to.',
  strategy: 'The scheduling strategy used (e.g., Balanced, Urgent First).',
  defaultDurationMinutes: 'Default duration of the event in minutes.',
  bufferMinutes: 'Minimum buffer time required between events in minutes.',
  maxStaffUtilizationRate: 'Maximum allowable daily utilization rate for staff (percentage).',
  maxEventsPerStaffPerDay: 'Maximum number of events assigned to a staff member per day.',
  workingHoursStart: 'Start time of the working day.',
  workingHoursEnd: 'End time of the working day.',
  workingDays: 'List of days of the week considered as working days.',
  respectUserPreferredSlots: 'Whether to prioritize slots marked as preferred by the user.',
  avoidLunchHours: 'Whether to avoid scheduling events during lunch hours.',
  lunchStartTime: 'Start time of the lunch break.',
  lunchEndTime: 'End time of the lunch break.',
  maxRescheduleCount: 'Maximum allowed number of reschedules for an event.',
  minRescheduleNoticeHours: 'Minimum notice period required before rescheduling (in hours).',
  autoAssignStaff: 'Whether to automatically assign staff when creating an event.',
  isDefault: 'Indicates if this is the default rule/setting.',

  // General / Misc
  metadata: 'Additional JSON metadata.',
  name: 'Name of the entity.',
  title: 'Title of the entity.',
  content: 'Main content or body text.',
  slug: 'URL-friendly string identifier.',
  type: 'Type or classification.',
  isActive: 'Indicates if the record is currently active.',

  // External Provider / OAuth
  provider: 'Service provider name (e.g., Google, Facebook).',
  providerId: 'Unique ID from the external provider.',
  accessToken: 'OAuth access token.',
  refreshToken: 'OAuth refresh token.',

  // Files / Audit
  signatureHash: 'Cryptographic hash of the digital signature.',
  fileHash: 'Cryptographic hash of the file content.',
  mimeType: 'MIME type of the file.',
  fileSize: 'Size of the file in bytes.',
  storagePath: 'Path where the file is stored in the storage system.',
  fileName: 'Name of the file.',
  uploadedAt: 'Timestamp when the file was uploaded.',
  isFlagged: 'Indicates if the content has been flagged for moderation.',
  flagReason: 'Reason for flagging the content.',
  flaggedById: 'ID of the user who flagged the content.',
  flaggedAt: 'Timestamp when the content was flagged.',

  // Contracts
  contractId: 'ID of the associated contract.',
  contractUrl: 'URL to the contract document.',
  termsContent: 'Text content of the contract terms.',
  coverLetter: 'Cover letter or introductory text.',

  // Audit Logs
  before_data: 'Data state before the action was performed.',
  after_data: 'Data state after the action was performed.',

  // IDs (Generic)
  clientId: 'Reference to the Client.',
  brokerId: 'Reference to the Broker.',
  freelancerId: 'Reference to the Freelancer.',
  requestId: 'Reference to the Request.',
  organizerId: 'ID of the event organizer.',
  previousEventId: 'ID of the previous event (for rescheduling history).',
  uploaderId: 'ID of the user who uploaded the file.',
  uploaderRole: 'Role of the uploader.',

  // Additional from common patterns
  startDate: 'Scheduled start date.',
  endDate: 'Scheduled end date.',
  location: 'Location or meeting link for the event.',
  reminderMinutes: 'Configuration for reminders (e.g., minutes before event).',
  notes: 'Internal notes or comments.',
  createdBy: 'ID of the user who created the record.',
  startTime: 'Start time of the event/period.',
  endTime: 'End time of the event/period.',
  durationMinutes: 'Duration in minutes.',
};

function parseExistingHtml(html) {
  const descriptions = {};
  const tableRegex = /<h2[^>]*>\d+\.\s*TABLE:\s*([\w_]+)<\/h2>[\s\S]*?<table[\s\S]*?<\/table>/gi;
  let match;

  while ((match = tableRegex.exec(html)) !== null) {
    const tableName = match[1];
    const tableBlock = match[0];
    descriptions[tableName] = {};

    const rowRegex = /<tr>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(tableBlock)) !== null) {
      const rowContent = rowMatch[1];
      const cols = rowContent.match(/<td[^>]*>(.*?)<\/td>/gi);
      if (cols && cols.length >= 8) {
        const nameMatch = cols[0].replace(/<[^>]+>/g, '').trim();
        const descMatch = cols[cols.length - 1]
          .replace(/<td[^>]*>/, '')
          .replace('</td>', '')
          .trim();
        if (
          descMatch &&
          descMatch !== 'Reference to related entity.' &&
          !descMatch.startsWith('Unique identifier')
        ) {
          descriptions[tableName][nameMatch] = descMatch;
        }
      }
    }
  }
  return descriptions;
}

function parseEntityFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  const entityMatch = content.match(/@Entity\(['"]([^'"]+)['"]\)/);
  if (!content.includes('@Entity')) return null;

  const tableName = entityMatch ? entityMatch[1] : path.basename(filePath, '.entity.ts');

  const columns = [];
  let currentDecorators = [];
  let currentComments = [];

  const fkMap = new Set();

  let inClass = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.includes(`class `)) {
      inClass = true;
    }

    if (!inClass) continue;

    if (line.startsWith('//')) {
      const c = line.replace(/^\/\/\s*/, '').trim();
      // SKIP SECTION HEADERS (=== ... ===)
      if (!c.startsWith('===')) {
        currentComments.push(c);
      }
      continue;
    }

    if (line.startsWith('/**')) {
      if (line.includes('*/')) {
        const comment = line
          .replace(/^\/\*\*\s*/, '')
          .replace(/\s*\*\/$/, '')
          .trim();
        currentComments.push(comment);
      }
      continue;
    }

    if (line.startsWith('@')) {
      currentDecorators.push(line);
      let openParen = (line.match(/\(/g) || []).length;
      let closeParen = (line.match(/\)/g) || []).length;
      while (openParen > closeParen && i < lines.length - 1) {
        i++;
        const nextLine = lines[i].trim();
        currentDecorators[currentDecorators.length - 1] += ' ' + nextLine;
        openParen += (nextLine.match(/\(/g) || []).length;
        closeParen += (nextLine.match(/\)/g) || []).length;
      }
      continue;
    }

    if (line.endsWith(';') || line.includes(';')) {
      const propMatch = line.match(/^(\w+)\s*:/);
      if (propMatch) {
        const propName = propMatch[1];
        let isColumn = false;
        let explicitName = null;
        let colData = {
          name: propName,
          type: '',
          size: '',
          pk: '',
          fk: '',
          notNull: '',
          unique: '',
          description: '',
        };

        const getOpts = (d) => {
          const opts = {};

          const lenMatch = d.match(/length:\s*(\d+)/);
          if (lenMatch) opts.length = lenMatch[1];

          const precisionMatch = d.match(/precision:\s*(\d+)/);
          const scaleMatch = d.match(/scale:\s*(\d+)/);
          if (precisionMatch) opts.precision = precisionMatch[1];
          if (scaleMatch) opts.scale = scaleMatch[1];

          const uniqueMatch = d.match(/unique:\s*true/);
          if (uniqueMatch) opts.unique = true;

          const nullableMatch = d.match(/nullable:\s*true/);
          if (nullableMatch) opts.nullable = true;

          const nameMatch = d.match(/name:\s*['"]([^'"]+)['"]/);
          if (nameMatch) opts.name = nameMatch[1];

          const enumMatch = d.match(/enum:\s*([\w]+)/);
          if (enumMatch) opts.type = 'ENUM';

          const commentMatch = d.match(/comment:\s*['"]([^'"]+)['"]/);
          if (commentMatch) opts.comment = commentMatch[1];

          return opts;
        };

        currentDecorators.forEach((dec) => {
          if (dec.includes('@PrimaryGeneratedColumn')) {
            isColumn = true;
            colData.pk = 'PK';
            colData.notNull = 'Not Null';
            if (dec.includes('uuid')) colData.type = 'UUID';
            else colData.type = 'INT';
          } else if (dec.includes('@Column')) {
            isColumn = true;
            const opts = getOpts(dec);
            if (opts.name) explicitName = opts.name;
            if (opts.type) colData.type = opts.type.toUpperCase();
            if (opts.length) colData.size = opts.length;
            if (opts.precision)
              colData.size = `${opts.precision}${opts.scale ? ',' + opts.scale : ''}`;
            if (opts.unique) colData.unique = 'Unique';
            if (opts.nullable) colData.notNull = '';
            else colData.notNull = 'Not Null';

            if (opts.comment) {
              currentComments.push(opts.comment);
            }
          } else if (dec.includes('@CreateDateColumn')) {
            isColumn = true;
            colData.type = 'TIMESTAMP';
            colData.notNull = 'Not Null';
            const opts = getOpts(dec);
            if (opts.name) explicitName = opts.name;
          } else if (dec.includes('@UpdateDateColumn')) {
            isColumn = true;
            colData.type = 'TIMESTAMP';
            colData.notNull = 'Not Null';
            const opts = getOpts(dec);
            if (opts.name) explicitName = opts.name;
          } else if (dec.includes('@DeleteDateColumn')) {
            isColumn = true;
            colData.type = 'TIMESTAMP';
            colData.notNull = '';
            const opts = getOpts(dec);
            if (opts.name) explicitName = opts.name;
          }

          if (dec.includes('@JoinColumn')) {
            const nameMatch = dec.match(/name:\s*['"]([^'"]+)['"]/);
            if (nameMatch) {
              fkMap.add(nameMatch[1]);
            }
          }
        });

        if (isColumn) {
          if (explicitName) colData.name = explicitName;

          if (!colData.type) {
            if (line.includes('string')) colData.type = 'VARCHAR';
            else if (line.includes('number')) colData.type = 'INT/DECIMAL';
            else if (line.includes('boolean')) colData.type = 'BOOLEAN';
            else if (line.includes('Date')) colData.type = 'TIMESTAMP';
          }

          // Description Priority
          if (COMMON_DESCRIPTIONS[colData.name]) {
            colData.description = COMMON_DESCRIPTIONS[colData.name];
          }

          if (!colData.description) {
            const humanized = colData.name.replace(/([A-Z])/g, ' $1').trim();
            const capitalized = humanized.charAt(0).toUpperCase() + humanized.slice(1);
            colData.description = `${capitalized}.`;
          }

          columns.push(colData);
        }
      }
      currentDecorators = [];
      currentComments = [];
    }
  }

  columns.forEach((col) => {
    if (fkMap.has(col.name)) {
      col.fk = 'FK';
      if (!col.description.includes('Reference to')) {
        const refName = col.name.replace('Id', '');
        const capitalizedRef = refName.charAt(0).toUpperCase() + refName.slice(1);
        if (
          col.name.endsWith('Id') &&
          col.description === `${col.name.replace(/([A-Z])/g, ' $1').trim()}.`
        ) {
          col.description = `Reference to the ${capitalizedRef} entity.`;
        }
      }
    }
  });

  return { tableName, columns };
}

function generateHtml(entities) {
  const date = new Date().toLocaleString();
  let html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Database Documentation</title>
  </head>
  <body style="font-family: 'Segoe UI', Calibri, Arial, sans-serif; line-height: 1.5; color: #000; max-width: 1200px; margin: 0 auto; padding: 30px;">
    <h1 style="text-align: center; color: #000; margin-bottom: 40px;">Database Structure Documentation</h1>
    <p>Last Updated: ${date}</p>
  `;

  let tableCount = 1;
  for (const entity of entities) {
    html += `<h2 style="color: #000 !important; font-weight: 800; border-bottom: 3px solid #000; padding-bottom: 8px; margin-top: 50px; text-transform: uppercase; font-size: 20px; letter-spacing: 0.5px;">${tableCount}. TABLE: ${entity.tableName}</h2>`;
    html += `<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #000;">`;
    html += `<thead><tr style="background-color: #f0f0f0;">`;
    html += `<th style="border: 1px solid #000; padding: 12px 15px; text-align: left; color: #000; font-weight: bold; width: 20%;">Attribute</th>`;
    html += `<th style="border: 1px solid #000; padding: 12px 15px; text-align: left; color: #000; font-weight: bold; width: 10%;">Data Type</th>`;
    html += `<th style="border: 1px solid #000; padding: 12px 15px; text-align: left; color: #000; font-weight: bold; width: 10%;">Size</th>`;
    html += `<th style="border: 1px solid #000; padding: 12px 15px; text-align: left; color: #000; font-weight: bold; width: 5%;">PK</th>`;
    html += `<th style="border: 1px solid #000; padding: 12px 15px; text-align: left; color: #000; font-weight: bold; width: 5%;">FK</th>`;
    html += `<th style="border: 1px solid #000; padding: 12px 15px; text-align: left; color: #000; font-weight: bold; width: 10%;">NOT Null</th>`;
    html += `<th style="border: 1px solid #000; padding: 12px 15px; text-align: left; color: #000; font-weight: bold; width: 10%;">Unique</th>`;
    html += `<th style="border: 1px solid #000; padding: 12px 15px; text-align: left; color: #000; font-weight: bold;">Description</th>`;
    html += `</tr></thead><tbody>`;

    for (const col of entity.columns) {
      html += `<tr>`;
      html += `<td style="border: 1px solid #000; padding: 12px 15px; vertical-align: top; color: #000 !important;"><b>${col.name}</b></td>`;
      html += `<td style="border: 1px solid #000; padding: 12px 15px; vertical-align: top; color: #000 !important;">${col.type || ''}</td>`;
      html += `<td style="border: 1px solid #000; padding: 12px 15px; vertical-align: top; color: #000 !important;">${col.size || ''}</td>`;
      html += `<td style="border: 1px solid #000; padding: 12px 15px; vertical-align: top; color: #000 !important;">${col.pk || ''}</td>`;
      html += `<td style="border: 1px solid #000; padding: 12px 15px; vertical-align: top; color: #000 !important;">${col.fk || ''}</td>`;
      html += `<td style="border: 1px solid #000; padding: 12px 15px; vertical-align: top; color: #000 !important;">${col.notNull || ''}</td>`;
      html += `<td style="border: 1px solid #000; padding: 12px 15px; vertical-align: top; color: #000 !important;">${col.unique || ''}</td>`;
      html += `<td style="border: 1px solid #000; padding: 12px 15px; vertical-align: top; color: #000 !important;">${col.description || ''}</td>`;
      html += `</tr>`;
    }

    html += `</tbody></table>`;
    tableCount++;
  }

  html += `</body></html>`;
  return html;
}

console.log('Reading existing documentation...');
console.log('Reading entities...');
if (!fs.existsSync(ENTITIES_DIR)) {
  console.error(`Entities directory not found: ${ENTITIES_DIR}`);
  process.exit(1);
}

const files = fs.readdirSync(ENTITIES_DIR).filter((f) => f.endsWith('.ts'));
console.log(`Found ${files.length} files in entities directory.`);

const entities = [];
for (const file of files) {
  const result = parseEntityFile(path.join(ENTITIES_DIR, file));
  if (result) {
    entities.push(result);
  }
}

console.log(`Parsed ${entities.length} entities.`);

const newHtml = generateHtml(entities);
fs.writeFileSync(HTML_FILE, newHtml);
console.log('Documentation updated successfully!');
