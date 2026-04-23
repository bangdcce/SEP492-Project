/* eslint-disable no-console */
require('reflect-metadata');

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const { getMetadataArgsStorage } = require('typeorm');

const serverRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(serverRoot, '..');
const outputDir = path.join(repoRoot, 'docs', 'DataFileDesign');

const outMaster = path.join(outputDir, 'interdev_master.dbml');
const outViews = path.join(outputDir, 'interdev_domain_views.dbml');
const outReport = path.join(outputDir, 'interdev_dbdiagram_validation_report.md');
const tabsDir = path.join(outputDir, 'interdev_tabs');

function targetName(target) {
  if (!target) return '';
  if (typeof target === 'function') return target.name || '';
  if (typeof target === 'string') return target;
  return String(target);
}

function resolveRelationTypeName(typeRef) {
  if (!typeRef) return '';
  if (typeof typeRef === 'string') return typeRef;

  if (typeof typeRef === 'function') {
    if (typeRef.name) return typeRef.name;

    // Relation decorators often store anonymous arrow functions: () => UserEntity or () => 'UserEntity'.
    // Execute safely to get the actual class/string target name.
    try {
      const resolved = typeRef();
      if (typeof resolved === 'string') return resolved;
      if (typeof resolved === 'function') return resolved.name || '';
      if (resolved && typeof resolved === 'object' && resolved.name) return String(resolved.name);
    } catch (_) {
      // ignore and fall through
    }
  }

  return '';
}

function sanitizeIdentifier(value) {
  return String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(/^_+/, '')
    .replace(/_+$/, '');
}

function fallbackSnakeCase(name) {
  return String(name || '')
    .replace(/Entity$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

function inferTypeFromDesignMetadata(col) {
  try {
    const dt = Reflect.getMetadata('design:type', col.target.prototype, col.propertyName);
    if (dt === String) return 'varchar';
    if (dt === Number) return 'int';
    if (dt === Boolean) return 'boolean';
    if (dt === Date) return 'timestamp';
    if (dt === Array) return 'jsonb';
    if (dt && dt.name === 'Object') return 'jsonb';
  } catch (_) {
    // ignore
  }
  return 'text';
}

function normalizeType(rawType, col, tableName, columnName, enumRegistry) {
  const opts = col.options || {};
  let typeName = rawType;

  if (typeof typeName === 'function') {
    typeName = (typeName.name || '').toLowerCase();
  }

  if (!typeName) {
    typeName = inferTypeFromDesignMetadata(col);
  }

  typeName = String(typeName || 'text').toLowerCase();

  const basicMap = {
    string: 'varchar',
    number: 'int',
    boolean: 'boolean',
    date: 'timestamp',
    datetime: 'timestamp',
    simple_array: 'text',
    'simple-array': 'text',
    simple_json: 'json',
    'simple-json': 'json',
  };

  typeName = basicMap[typeName] || typeName;

  if (typeName === 'enum') {
    const enumName = sanitizeIdentifier(opts.enumName || `${tableName}_${columnName}_enum`);
    const enumValues = Array.from(
      new Set(
        Object.values(opts.enum || {})
          .filter((v) => typeof v === 'string' || typeof v === 'number')
          .map((v) => String(v)),
      ),
    );

    if (!enumRegistry.has(enumName)) {
      enumRegistry.set(enumName, enumValues);
    }

    return enumName;
  }

  let withSize = typeName;
  if (opts.length !== undefined && opts.length !== null) {
    withSize = `${withSize}(${opts.length})`;
  } else if (opts.precision !== undefined && opts.precision !== null) {
    if (opts.scale !== undefined && opts.scale !== null) {
      withSize = `${withSize}(${opts.precision},${opts.scale})`;
    } else {
      withSize = `${withSize}(${opts.precision})`;
    }
  }

  if (opts.array === true) {
    withSize += '[]';
  }

  return withSize;
}

function formatDefaultValue(rawDefault) {
  if (rawDefault === undefined) return '';
  if (rawDefault === null) return 'default: null';

  if (typeof rawDefault === 'function') {
    try {
      const expr = String(rawDefault()).trim();
      const normalized = expr.replace(/^'+|'+$/g, '');
      return `default: \`${normalized}\``;
    } catch (_) {
      const fnText = String(rawDefault).replace(/\s+/g, ' ').trim();
      return `default: '${escapeSingleQuoted(fnText)}'`;
    }
  }

  if (typeof rawDefault === 'number' || typeof rawDefault === 'bigint') {
    return `default: ${rawDefault}`;
  }

  if (typeof rawDefault === 'boolean') {
    return `default: ${rawDefault ? 'true' : 'false'}`;
  }

  if (typeof rawDefault === 'string') {
    const v = rawDefault.trim();
    const expressionLike = /CURRENT_TIMESTAMP|NOW\(|uuid_generate_v4\(|gen_random_uuid\(|\(|\)|::/i.test(v);
    if (expressionLike) {
      return `default: \`${v.replace(/`/g, '')}\``;
    }
    return `default: '${escapeSingleQuoted(v)}'`;
  }

  return `default: '${escapeSingleQuoted(JSON.stringify(rawDefault))}'`;
}

function quoteEnumValue(v) {
  const value = String(v);
  if (/^[A-Za-z0-9_]+$/.test(value)) return value;
  return `"${escapeDoubleQuoted(value)}"`;
}

function escapeSingleQuoted(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function escapeDoubleQuoted(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function loadEntities() {
  const entityFiles = [
    ...glob.sync(path.join(serverRoot, 'src/database/entities/*.entity.ts').replace(/\\/g, '/')),
    ...glob.sync(path.join(serverRoot, 'src/modules/tasks/entities/*.entity.ts').replace(/\\/g, '/')),
  ];

  for (const file of entityFiles) {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    require(file);
  }

  return entityFiles;
}

function buildGroups(tableNamesSorted) {
  const groups = [
    {
      key: 'g1_user_auth_identity',
      note: 'User, auth, profile, identity and onboarding',
      tables: [
        'users',
        'profiles',
        'social_accounts',
        'auth_sessions',
        'user_tokens',
        'user_signing_credentials',
        'verification_documents',
        'kyc_verifications',
        'staff_applications',
        'saved_freelancers',
      ],
    },
    {
      key: 'g2_project_intake_spec',
      note: 'Project intake, wizard, request, proposal and specification',
      tables: [
        'wizard_questions',
        'wizard_options',
        'project_requests',
        'project_request_answers',
        'project_request_proposals',
        'broker_proposals',
        'project_specs',
        'project_spec_signatures',
        'request_messages',
        'project_categories',
      ],
    },
    {
      key: 'g3_project_delivery_workspace',
      note: 'Project execution, tasks, workspace messaging and documents',
      tables: [
        'projects',
        'milestones',
        'tasks',
        'task_comments',
        'task_history',
        'task_attachments',
        'task_links',
        'task_submissions',
        'workspace_messages',
        'documents',
      ],
    },
    {
      key: 'g4_contracts_legal',
      note: 'Contracts and legal signature flow',
      tables: ['contracts', 'digital_signatures', 'legal_signatures'],
    },
    {
      key: 'g5_wallet_payment_escrow',
      note: 'Wallet, transaction, funding, payout and payment configuration',
      tables: [
        'wallets',
        'transactions',
        'escrows',
        'payment_methods',
        'payout_methods',
        'payout_requests',
        'funding_intents',
        'fee_configs',
        'platform_settings',
      ],
    },
    {
      key: 'g6_dispute_core',
      note: 'Dispute core records and operational state',
      tables: [
        'disputes',
        'dispute_parties',
        'dispute_notes',
        'dispute_activities',
        'dispute_messages',
        'dispute_ledgers',
        'dispute_view_states',
        'dispute_internal_memberships',
        'dispute_schedule_proposals',
      ],
    },
    {
      key: 'g7_dispute_hearing_resolution',
      note: 'Dispute hearing lifecycle, evidence, settlement and verdict',
      tables: [
        'dispute_hearings',
        'hearing_participants',
        'hearing_statements',
        'hearing_questions',
        'dispute_evidences',
        'dispute_settlements',
        'dispute_verdicts',
        'dispute_resolution_feedbacks',
        'dispute_skill_requirements',
        'hearing_reminder_deliveries',
      ],
    },
    {
      key: 'g8_skills_taxonomy_matching',
      note: 'Skill taxonomy and matching-related entities',
      tables: [
        'skill_domains',
        'skills',
        'user_skills',
        'user_skill_domains',
        'skill_mapping_rules',
        'staff_expertise',
      ],
    },
    {
      key: 'g9_trust_moderation_feedback',
      note: 'Trust score, moderation, reviews and reporting',
      tables: ['trust_score_history', 'user_flags', 'reviews', 'reports', 'notifications', 'audit_logs'],
    },
    {
      key: 'g10_calendar_staff_subscription',
      note: 'Calendar scheduling, staff operation, subscription and quota',
      tables: [
        'calendar_events',
        'event_participants',
        'event_reschedule_requests',
        'user_availabilities',
        'auto_schedule_rules',
        'staff_performances',
        'staff_workloads',
        'staff_leave_policies',
        'staff_leave_requests',
        'subscription_plans',
        'user_subscriptions',
        'quota_usage_logs',
      ],
    },
  ];

  const existing = new Set(tableNamesSorted);
  for (const group of groups) {
    group.tables = group.tables.filter((t) => existing.has(t));
  }

  const assigned = new Set(groups.flatMap((g) => g.tables));
  const unassigned = tableNamesSorted.filter((t) => !assigned.has(t));
  if (unassigned.length > 0) {
    groups[groups.length - 1].tables.push(...unassigned);
  }

  return { groups, unassigned };
}

function main() {
  const entityFiles = loadEntities();
  const storage = getMetadataArgsStorage();

  const tables = storage.tables.filter((t) => t.type === 'regular');

  const classToTable = new Map();
  for (const t of tables) {
    const cls = targetName(t.target);
    const tableName = sanitizeIdentifier(t.name || fallbackSnakeCase(cls));
    classToTable.set(cls, tableName);
  }

  const columnMap = new Map();
  const propertyToColumn = new Map();
  const enumRegistry = new Map();

  for (const t of tables) {
    const cls = targetName(t.target);
    const tableName = classToTable.get(cls);
    columnMap.set(tableName, []);
    propertyToColumn.set(tableName, new Map());
  }

  const singleUniqueSet = new Set();
  for (const u of storage.uniques) {
    const tableName = classToTable.get(targetName(u.target));
    if (!tableName || !Array.isArray(u.columns) || u.columns.length !== 1) continue;
    singleUniqueSet.add(`${tableName}.${u.columns[0]}`);
  }
  for (const idx of storage.indices) {
    const tableName = classToTable.get(targetName(idx.target));
    if (!tableName || !idx.unique || !Array.isArray(idx.columns) || idx.columns.length !== 1) continue;
    singleUniqueSet.add(`${tableName}.${idx.columns[0]}`);
  }

  for (const col of storage.columns) {
    const cls = targetName(col.target);
    const tableName = classToTable.get(cls);
    if (!tableName) continue;

    const colName = sanitizeIdentifier(col.options.name || col.propertyName);
    const propToCol = propertyToColumn.get(tableName);
    propToCol.set(col.propertyName, colName);

    const type = normalizeType(col.options.type, col, tableName, colName, enumRegistry);

    const settings = [];
    if (col.options.primary) settings.push('pk');

    const isDeleteDate = col.mode === 'deleteDate';
    const nullable = col.options.nullable === true || isDeleteDate;
    if (!nullable) settings.push('not null');

    const uniqueByOption = col.options.unique === true;
    const uniqueByMetadata = singleUniqueSet.has(`${tableName}.${col.propertyName}`);
    if (uniqueByOption || uniqueByMetadata) settings.push('unique');

    const defaultSetting = formatDefaultValue(col.options.default);
    if (defaultSetting) settings.push(defaultSetting);

    columnMap.get(tableName).push({
      name: colName,
      property: col.propertyName,
      type,
      settings,
      inferred: false,
    });
  }

  const relationLookup = new Map();
  for (const rel of storage.relations) {
    relationLookup.set(`${targetName(rel.target)}.${rel.propertyName}`, rel);
  }

  const refs = [];
  const refSet = new Set();
  const unresolvedRefs = [];

  for (const jc of storage.joinColumns) {
    const sourceClass = targetName(jc.target);
    const sourceTable = classToTable.get(sourceClass);
    if (!sourceTable) continue;

    const relation = relationLookup.get(`${sourceClass}.${jc.propertyName}`);
    if (!relation) {
      unresolvedRefs.push({ reason: 'missing_relation', sourceClass, property: jc.propertyName });
      continue;
    }

    const targetClass = resolveRelationTypeName(relation.type);
    const targetTable = classToTable.get(targetClass);
    if (!targetTable) {
      unresolvedRefs.push({
        reason: 'missing_target_table',
        sourceTable,
        relationProperty: jc.propertyName,
        targetClass,
      });
      continue;
    }

    const sourceColumn = sanitizeIdentifier(jc.name || `${jc.propertyName}Id`);
    const targetColumn = sanitizeIdentifier(jc.referencedColumnName || 'id');

    const refLine = `Ref: ${sourceTable}.${sourceColumn} > ${targetTable}.${targetColumn}`;
    if (!refSet.has(refLine)) {
      refSet.add(refLine);
      refs.push(refLine);
    }

    const sourceColumns = columnMap.get(sourceTable);
    if (!sourceColumns.some((c) => c.name === sourceColumn)) {
      // Add inferred FK column if relation column exists physically but was implicit in decorators.
      const targetColumns = columnMap.get(targetTable) || [];
      const targetColType = targetColumns.find((c) => c.name === targetColumn)?.type || 'uuid';
      sourceColumns.push({
        name: sourceColumn,
        property: sourceColumn,
        type: targetColType,
        settings: relation.options?.nullable === true ? [] : ['not null'],
        inferred: true,
      });
    }
  }

  for (const [tableName, cols] of columnMap.entries()) {
    cols.sort((a, b) => {
      if (a.settings.includes('pk') && !b.settings.includes('pk')) return -1;
      if (!a.settings.includes('pk') && b.settings.includes('pk')) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  const tableNames = Array.from(columnMap.keys()).sort((a, b) => a.localeCompare(b));
  const { groups, unassigned } = buildGroups(tableNames);

  // Index serialization (confidently known only).
  const indexMap = new Map();
  for (const t of tableNames) indexMap.set(t, new Set());

  const addIndexLine = (tableName, indexLine) => {
    if (!tableName || !indexLine) return;
    indexMap.get(tableName).add(indexLine);
  };

  const resolveColumnName = (tableName, propertyName) => {
    const map = propertyToColumn.get(tableName);
    return map?.get(propertyName) || sanitizeIdentifier(propertyName);
  };

  for (const idx of storage.indices) {
    const tableName = classToTable.get(targetName(idx.target));
    if (!tableName || !Array.isArray(idx.columns) || idx.columns.length === 0) continue;

    const cols = idx.columns.map((c) => resolveColumnName(tableName, c));
    const colExpr = cols.length === 1 ? cols[0] : `(${cols.join(', ')})`;
    const settings = [];
    if (idx.unique) settings.push('unique');
    if (idx.name) settings.push(`name: '${escapeSingleQuoted(idx.name)}'`);
    const line = settings.length > 0 ? `${colExpr} [${settings.join(', ')}]` : colExpr;
    addIndexLine(tableName, line);
  }

  for (const uq of storage.uniques) {
    const tableName = classToTable.get(targetName(uq.target));
    if (!tableName || !Array.isArray(uq.columns) || uq.columns.length <= 1) continue;
    const cols = uq.columns.map((c) => resolveColumnName(tableName, c));
    addIndexLine(tableName, `(${cols.join(', ')}) [unique]`);
  }

  const emittedLines = [];
  emittedLines.push('Project interdev {');
  emittedLines.push("  database_type: 'PostgreSQL'");
  emittedLines.push("  Note: 'Generated from real TypeORM entity metadata and relation decorators. Auto-generated join table project_category_map is excluded unless backed by real entity table.'");
  emittedLines.push('}');
  emittedLines.push('');

  const enumNames = Array.from(enumRegistry.keys()).sort((a, b) => a.localeCompare(b));
  for (const enumName of enumNames) {
    emittedLines.push(`Enum ${enumName} {`);
    const values = enumRegistry.get(enumName) || [];
    for (const val of values) {
      emittedLines.push(`  ${quoteEnumValue(val)}`);
    }
    emittedLines.push('}');
    emittedLines.push('');
  }

  for (const tableName of tableNames) {
    emittedLines.push(`Table ${tableName} {`);
    const cols = columnMap.get(tableName) || [];
    for (const col of cols) {
      const settings = col.settings.length > 0 ? ` [${col.settings.join(', ')}]` : '';
      emittedLines.push(`  ${col.name} ${col.type}${settings}`);
    }

    const idxSet = indexMap.get(tableName);
    if (idxSet && idxSet.size > 0) {
      emittedLines.push('');
      emittedLines.push('  indexes {');
      for (const idxLine of Array.from(idxSet).sort((a, b) => a.localeCompare(b))) {
        emittedLines.push(`    ${idxLine}`);
      }
      emittedLines.push('  }');
    }

    emittedLines.push('}');
    emittedLines.push('');
  }

  emittedLines.push('// Foreign key relationships (column-to-column, deduplicated)');
  for (const ref of refs.sort((a, b) => a.localeCompare(b))) {
    emittedLines.push(ref);
  }
  emittedLines.push('');

  // TableGroups.
  for (const g of groups) {
    emittedLines.push(`TableGroup ${g.key} [note: '${escapeSingleQuoted(g.note)}'] {`);
    for (const t of Array.from(new Set(g.tables)).sort((a, b) => a.localeCompare(b))) {
      emittedLines.push(`  ${t}`);
    }
    emittedLines.push('}');
    emittedLines.push('');
  }

  emittedLines.push("// Domain tabs are exported as separate DBML files under docs/DataFileDesign/interdev_tabs");
  emittedLines.push('');

  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(tabsDir, { recursive: true });

  const fullDbml = emittedLines.join('\n');
  fs.writeFileSync(outMaster, fullDbml, 'utf8');
  fs.writeFileSync(outViews, fullDbml, 'utf8');

  const tabFiles = [];
  for (let i = 0; i < groups.length; i += 1) {
    const g = groups[i];
    const tabTables = Array.from(new Set(g.tables)).sort((a, b) => a.localeCompare(b));
    const tabTableSet = new Set(tabTables);

    const tabEnums = new Set();
    for (const t of tabTables) {
      const cols = columnMap.get(t) || [];
      for (const c of cols) {
        if (enumRegistry.has(c.type)) tabEnums.add(c.type);
      }
    }

    const tabLines = [];
    tabLines.push('Project interdev {');
    tabLines.push("  database_type: 'PostgreSQL'");
    tabLines.push(`  Note: 'Domain tab ${i + 1}/10 - ${g.key}'`);
    tabLines.push('}');
    tabLines.push('');

    for (const enumName of Array.from(tabEnums).sort((a, b) => a.localeCompare(b))) {
      tabLines.push(`Enum ${enumName} {`);
      const values = enumRegistry.get(enumName) || [];
      for (const val of values) {
        tabLines.push(`  ${quoteEnumValue(val)}`);
      }
      tabLines.push('}');
      tabLines.push('');
    }

    for (const tableName of tabTables) {
      tabLines.push(`Table ${tableName} {`);
      const cols = columnMap.get(tableName) || [];
      for (const col of cols) {
        const settings = col.settings.length > 0 ? ` [${col.settings.join(', ')}]` : '';
        tabLines.push(`  ${col.name} ${col.type}${settings}`);
      }

      const idxSet = indexMap.get(tableName);
      if (idxSet && idxSet.size > 0) {
        tabLines.push('');
        tabLines.push('  indexes {');
        for (const idxLine of Array.from(idxSet).sort((a, b) => a.localeCompare(b))) {
          tabLines.push(`    ${idxLine}`);
        }
        tabLines.push('  }');
      }

      tabLines.push('}');
      tabLines.push('');
    }

    tabLines.push('// Relationships within this domain tab');
    for (const ref of refs) {
      const m = ref.match(/^Ref:\s+([^.]+)\.([^.]+)\s+>\s+([^.]+)\.([^.]+)$/);
      if (!m) continue;
      const sourceTable = m[1];
      const targetTable = m[3];
      if (tabTableSet.has(sourceTable) && tabTableSet.has(targetTable)) {
        tabLines.push(ref);
      }
    }
    tabLines.push('');

    tabLines.push(`TableGroup ${g.key} [note: '${escapeSingleQuoted(g.note)}'] {`);
    for (const t of tabTables) tabLines.push(`  ${t}`);
    tabLines.push('}');
    tabLines.push('');

    const tabFileName = `interdev_tab_${String(i + 1).padStart(2, '0')}_${g.key}.dbml`;
    const tabPath = path.join(tabsDir, tabFileName);
    fs.writeFileSync(tabPath, tabLines.join('\n'), 'utf8');
    tabFiles.push(tabPath);
  }

  const columnTotal = tableNames.reduce((acc, t) => acc + (columnMap.get(t)?.length || 0), 0);
  const inferredColumnCount = tableNames.reduce(
    (acc, t) => acc + (columnMap.get(t)?.filter((c) => c.inferred).length || 0),
    0,
  );

  const joinTables = storage.joinTables.map((jt) => jt.name).filter(Boolean);
  const excludedVirtualTables = joinTables.filter((n) => !tableNames.includes(n));

  const reportLines = [];
  reportLines.push('# InterDev DBML Validation Report');
  reportLines.push('');
  reportLines.push(`- Generated at: ${new Date().toISOString()}`);
  reportLines.push(`- Source entity files loaded: ${entityFiles.length}`);
  reportLines.push(`- Included real tables: ${tableNames.length}`);
  reportLines.push(`- Included columns: ${columnTotal}`);
  reportLines.push(`- Inferred FK columns added (missing explicit scalar columns): ${inferredColumnCount}`);
  reportLines.push(`- Included FK refs (deduplicated): ${refs.length}`);
  reportLines.push(`- Unresolved FK mappings: ${unresolvedRefs.length}`);
  reportLines.push(`- Diagram domain groups: ${groups.length}`);
  reportLines.push(`- Domain tab files generated: ${groups.length}`);
  reportLines.push('');

  reportLines.push('## Excluded Virtual Join Tables');
  reportLines.push('');
  if (excludedVirtualTables.length === 0) {
    reportLines.push('- None');
  } else {
    for (const t of excludedVirtualTables) {
      reportLines.push(`- ${t} (excluded because no dedicated real entity table)`);
    }
  }
  reportLines.push('');

  reportLines.push('## Domain Groups');
  reportLines.push('');
  for (const g of groups) {
    reportLines.push(`- ${g.key}: ${Array.from(new Set(g.tables)).length} tables`);
  }
  reportLines.push('');

  if (unassigned.length > 0) {
    reportLines.push('## Initially Unassigned Tables (auto-appended to Group 10)');
    reportLines.push('');
    for (const t of unassigned) {
      reportLines.push(`- ${t}`);
    }
    reportLines.push('');
  }

  if (unresolvedRefs.length > 0) {
    reportLines.push('## Unresolved FK Mappings');
    reportLines.push('');
    for (const item of unresolvedRefs.slice(0, 200)) {
      reportLines.push(`- ${JSON.stringify(item)}`);
    }
    reportLines.push('');
  }

  reportLines.push('## Files');
  reportLines.push('');
  reportLines.push(`- ${path.relative(repoRoot, outMaster).replace(/\\/g, '/')}`);
  reportLines.push(`- ${path.relative(repoRoot, outViews).replace(/\\/g, '/')}`);
  reportLines.push(`- ${path.relative(repoRoot, outReport).replace(/\\/g, '/')}`);
  for (const tabPath of tabFiles) {
    reportLines.push(`- ${path.relative(repoRoot, tabPath).replace(/\\/g, '/')}`);
  }

  fs.writeFileSync(outReport, reportLines.join('\n'), 'utf8');

  console.log('Generated DBML and report:');
  console.log(`- ${outMaster}`);
  console.log(`- ${outViews}`);
  console.log(`- ${outReport}`);
  console.log(`- ${tabsDir}`);
  console.log(`Tables: ${tableNames.length}, Columns: ${columnTotal}, Refs: ${refs.length}, Domain tabs: ${groups.length}`);
}

main();
