#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const TYPES = Object.freeze({
  WORLD_FACT: 'world-fact',
  BELIEF: 'belief',
  OBSERVATION: 'observation',
  EXPERIENCE: 'experience',
});

const FRESHNESS = Object.freeze({
  STABLE: 'stable',
  STRENGTHENING: 'strengthening',
  WEAKENING: 'weakening',
  STALE: 'stale',
  CONTRADICTED: 'contradicted',
});

const DEFAULT_THRESHOLDS = Object.freeze({
  promotion_confidence: 0.85,
  promotion_sources: 5,
  stale_days: 90,
  consolidate_touches: 5,
  top_beliefs_n: 10,
});

// Cold-start: relaxed thresholds applied when total beliefs in the brain
// are below `bootstrap_max_beliefs`. Without this, a fresh brain never has
// anything in `Persona.md ## Top Beliefs` because reaching 5 sources × 0.85
// confidence on a single belief takes weeks of disciplined capture.
//
// `promotion_sources: 1` is intentional — when the user explicitly captures
// with `remember this: ...`, they've already opted in. Requiring two
// captures of the same idea before it counts is patronising. Ranking still
// rewards repetition via `confidence × log(sources_count + 1)`.
//
// Bootstrap takes the MORE permissive of (user_config, bootstrap_defaults)
// — user can never accidentally make bootstrap stricter than intended.
// Disable entirely with `bootstrap: false` in the evolution config.
const BOOTSTRAP_THRESHOLDS = Object.freeze({
  promotion_confidence: 0.7,
  promotion_sources: 1,
  bootstrap_max_beliefs: 20,
});

const PERSONA_SECTIONS = Object.freeze(['Mission', 'Directives', 'Top Beliefs', 'Evidence Log']);

const BELIEF_MARKERS = [
  /\bprefer(?:s|red|ence)?\b/i,
  /\bprobably\b/i,
  /\bI think\b/i,
  /\bseems? (?:like|to)\b/i,
  /\bbetter (?:to|than|if)\b/i,
];

const DECISION_MARKERS = [
  /\b(?:we|I) (?:decided|chose|picked|went with|choose)\b/i,
  /\bgoing with\b/i,
  /\bdecision[: ]/i,
  /\bchose\s+\S+\s+over\b/i,
];

const EXPERIENCE_MARKERS = [
  /\b\d{4}-\d{2}-\d{2}\b/,
  /\b(?:on|at)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i,
  /\bmet (?:with|today|yesterday)\b/i,
  /\bcalled\s+\S+\s+about\b/i,
];

const ENTITY_MARKERS = [
  /\bworks as\b/i,
  /\blives in\b/i,
  /\bbased in\b/i,
  /\bleads (?:the |a )?(?:team|project|company|product)\b/i,
  /\b(?:cofounder|founder|cto|ceo|director|manager) (?:of|at)\b/i,
];

function detectType(text) {
  const t = (text || '').trim();
  if (!t) return TYPES.WORLD_FACT;

  for (const re of EXPERIENCE_MARKERS) if (re.test(t)) return TYPES.EXPERIENCE;
  for (const re of DECISION_MARKERS) if (re.test(t)) return TYPES.WORLD_FACT;
  for (const re of ENTITY_MARKERS) if (re.test(t)) return TYPES.OBSERVATION;
  for (const re of BELIEF_MARKERS) if (re.test(t)) return TYPES.BELIEF;

  return TYPES.WORLD_FACT;
}

const VALID_TYPES = new Set(Object.values(TYPES));
const VALID_FRESHNESS = new Set(Object.values(FRESHNESS));

function validateFrontmatter(meta) {
  const errors = [];
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    return { valid: false, errors: ['frontmatter must be an object'] };
  }

  if (!meta.type) {
    errors.push('missing required field: type');
  } else if (!VALID_TYPES.has(meta.type)) {
    errors.push(`invalid type: "${meta.type}" (allowed: ${[...VALID_TYPES].join(', ')})`);
  }

  if (meta.freshness !== undefined && !VALID_FRESHNESS.has(meta.freshness)) {
    errors.push(`invalid freshness: "${meta.freshness}" (allowed: ${[...VALID_FRESHNESS].join(', ')})`);
  }

  if (meta.confidence !== undefined) {
    if (typeof meta.confidence !== 'number' || Number.isNaN(meta.confidence) || meta.confidence < 0 || meta.confidence > 1) {
      errors.push(`invalid confidence: "${meta.confidence}" (must be a number 0.0–1.0)`);
    }
  }

  if (meta.type === TYPES.BELIEF && meta.confidence === undefined) {
    errors.push('confidence is required for type=belief');
  }

  return { valid: errors.length === 0, errors };
}

// --- validate-and-upgrade helpers ---

function inferExpectedSchema(filepath, { brainRoot } = {}) {
  if (!brainRoot) return { kind: 'passthrough' };
  const abs = path.resolve(filepath);
  const root = path.resolve(brainRoot);
  if (!abs.startsWith(root + path.sep) && abs !== root) {
    return { kind: 'passthrough' };
  }
  const rel = path.relative(root, abs);

  if (rel === 'Persona.md') {
    return { kind: 'persona-sections', requiredSections: [...PERSONA_SECTIONS] };
  }

  // Journal/<date>.md → experience
  if (rel.startsWith(`Journal${path.sep}`)) {
    const base = path.basename(rel, '.md');
    if (/^\d{4}-\d{2}-\d{2}$/.test(base)) {
      return {
        kind: 'l2-typed',
        defaultType: TYPES.EXPERIENCE,
        requiredFields: ['type'],
        defaults: { type: TYPES.EXPERIENCE },
      };
    }
    return { kind: 'passthrough' };
  }

  // People/<x>.md → observation
  if (rel.startsWith(`People${path.sep}`)) {
    return {
      kind: 'l2-typed',
      defaultType: TYPES.OBSERVATION,
      requiredFields: ['type', 'last_consolidated', 'sources_count', 'freshness'],
      defaults: {
        type: TYPES.OBSERVATION,
        last_consolidated: '{TODAY}',
        sources_count: 1,
        freshness: FRESHNESS.STABLE,
      },
    };
  }

  // Areas/<x>.md → observation
  if (rel.startsWith(`Areas${path.sep}`)) {
    return {
      kind: 'l2-typed',
      defaultType: TYPES.OBSERVATION,
      requiredFields: ['type', 'last_consolidated', 'sources_count', 'freshness'],
      defaults: {
        type: TYPES.OBSERVATION,
        last_consolidated: '{TODAY}',
        sources_count: 1,
        freshness: FRESHNESS.STABLE,
      },
    };
  }

  // Projects/<x>/<y>.md
  // path.sep on Windows is '\', which is invalid unescaped inside a RegExp character class.
  const sep = path.sep.replace(/\\/g, '\\\\');
  const projMatch = rel.match(new RegExp(`^Projects${sep}([^${sep}]+)${sep}(.+)$`));
  if (projMatch) {
    const projName = projMatch[1];
    const subPath = projMatch[2];
    // Projects/<x>/<x>.md → observation
    if (subPath === `${projName}.md`) {
      return {
        kind: 'l2-typed',
        defaultType: TYPES.OBSERVATION,
        requiredFields: ['type', 'last_consolidated', 'sources_count', 'freshness'],
        defaults: {
          type: TYPES.OBSERVATION,
          last_consolidated: '{TODAY}',
          sources_count: 1,
          freshness: FRESHNESS.STABLE,
        },
      };
    }
    // Projects/<x>/decisions/*.md or meetings/*.md → world-fact
    if (subPath.startsWith(`decisions${path.sep}`) || subPath.startsWith(`meetings${path.sep}`)) {
      return {
        kind: 'l2-typed',
        defaultType: TYPES.WORLD_FACT,
        requiredFields: ['type', 'freshness', 'sources_count'],
        defaults: {
          type: TYPES.WORLD_FACT,
          freshness: FRESHNESS.STABLE,
          sources_count: 1,
        },
      };
    }
    // Other Project sub-files: passthrough
    return { kind: 'passthrough' };
  }

  // Notes/<x>.md → world-fact (or belief, decided per content)
  if (rel.startsWith(`Notes${path.sep}`)) {
    return {
      kind: 'l2-typed',
      defaultType: TYPES.WORLD_FACT,
      requiredFields: ['type', 'freshness', 'sources_count'],
      defaults: {
        type: TYPES.WORLD_FACT,
        freshness: FRESHNESS.STABLE,
        sources_count: 1,
      },
    };
  }

  return { kind: 'passthrough' };
}

function splitFrontmatter(text) {
  if (!text.startsWith('---\n') && !text.startsWith('---\r\n')) {
    return { frontmatter: '', body: text, hadFrontmatter: false };
  }
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { frontmatter: '', body: text, hadFrontmatter: false };
  return {
    frontmatter: m[1],
    body: text.slice(m[0].length),
    hadFrontmatter: true,
  };
}

function parseFmKeys(fmText) {
  const keys = new Set();
  for (const line of fmText.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:/);
    if (m) keys.add(m[1]);
  }
  return keys;
}

function formatValue(v) {
  if (typeof v === 'string') {
    if (v === '' || /[:#\[\]&*?{}|>!%@`,]/.test(v)) {
      return JSON.stringify(v);
    }
    return v;
  }
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    return JSON.stringify(v);
  }
  if (typeof v === 'object' && v !== null) {
    return JSON.stringify(v);
  }
  return String(v);
}

function applyMissingFrontmatterFields(text, defaults, today) {
  const { frontmatter, body, hadFrontmatter } = splitFrontmatter(text);
  const existing = parseFmKeys(frontmatter);

  const additions = [];
  for (const [k, v] of Object.entries(defaults)) {
    if (existing.has(k)) continue;
    let value = v === '{TODAY}' ? today : v;
    additions.push(`${k}: ${formatValue(value)}`);
  }

  if (!additions.length) {
    return { text, addedFields: [] };
  }

  const addedFields = additions.map(a => a.split(':')[0]);

  if (hadFrontmatter) {
    const newFm = `---\n${frontmatter}\n${additions.join('\n')}\n---\n`;
    const newText = newFm + body;
    return { text: newText, addedFields };
  }

  const newFm = `---\n${additions.join('\n')}\n---\n\n`;
  return { text: newFm + body, addedFields };
}

function findExistingSections(text) {
  const present = new Set();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) present.add(m[1].trim());
  }
  return present;
}

function appendMissingPersonaSections(text, requiredSections) {
  const present = findExistingSections(text);
  const missing = requiredSections.filter(s => !present.has(s));
  if (!missing.length) return { text, addedSections: [] };

  const placeholders = {
    Mission: '_to be filled in (Name / Timezone / Languages / Role)_',
    Directives: '_Hard rules and explicit preferences. Edit by hand. The plugin never overwrites this section._',
    'Top Beliefs': '_Auto-managed by promote.js (runs after every capture). Empty until your first belief meets the threshold._',
    'Evidence Log': '_Append-only behavioural evidence with `[{date}]` prefix._',
  };

  const blocks = missing.map(s => `## ${s}\n\n${placeholders[s] || '_…_'}\n`);
  const trimmed = text.replace(/\s+$/, '');
  const newText = `${trimmed}\n\n${blocks.join('\n')}`;
  return { text: newText, addedSections: missing };
}

function validateAndUpgrade(filepath, { brainRoot, today } = {}) {
  const todayStr = today || new Date().toISOString().slice(0, 10);
  const result = { changed: false, addedFields: [], addedSections: [], warnings: [] };

  if (!fs.existsSync(filepath)) return result;

  const expected = inferExpectedSchema(filepath, { brainRoot });
  if (expected.kind === 'passthrough') return result;

  let text;
  try {
    text = fs.readFileSync(filepath, 'utf-8');
  } catch {
    return result;
  }

  if (expected.kind === 'l2-typed') {
    const upgrade = applyMissingFrontmatterFields(text, expected.defaults, todayStr);
    text = upgrade.text;
    result.addedFields = upgrade.addedFields;

    // Belief without confidence → default 0.5 + warning
    const fm = splitFrontmatter(text).frontmatter;
    const fmKeys = parseFmKeys(fm);
    const typeMatch = fm.match(/^type:\s*(\S+)/m);
    if (typeMatch && typeMatch[1] === TYPES.BELIEF && !fmKeys.has('confidence')) {
      const upgrade2 = applyMissingFrontmatterFields(text, { confidence: 0.5 }, todayStr);
      text = upgrade2.text;
      result.addedFields.push(...upgrade2.addedFields);
      result.warnings.push(`confidence defaulted to 0.5 — review ${path.relative(brainRoot || '.', filepath)}`);
    }
  } else if (expected.kind === 'persona-sections') {
    const upgrade = appendMissingPersonaSections(text, expected.requiredSections);
    text = upgrade.text;
    result.addedSections = upgrade.addedSections;
  }

  const original = fs.readFileSync(filepath, 'utf-8');
  if (text !== original) {
    fs.writeFileSync(filepath, text, 'utf-8');
    result.changed = true;
  }

  return result;
}

module.exports = {
  TYPES,
  FRESHNESS,
  DEFAULT_THRESHOLDS,
  BOOTSTRAP_THRESHOLDS,
  PERSONA_SECTIONS,
  detectType,
  validateFrontmatter,
  inferExpectedSchema,
  validateAndUpgrade,
};

// CLI: node schema.js validate <filepath>
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === 'validate' && args[1]) {
    const { getBrainRoot } = require('./config');
    const result = validateAndUpgrade(args[1], { brainRoot: getBrainRoot() });
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(0);
  }
  process.stderr.write('Usage: node schema.js validate <filepath>\n');
  process.exit(1);
}
