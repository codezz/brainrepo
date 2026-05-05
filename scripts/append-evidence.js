#!/usr/bin/env node
'use strict';

// Dedup-aware evidence appender. When `remember`/`process` skills detect
// that a belief or world-fact they're about to write already exists,
// they call this helper instead — appending the new evidence entry and
// incrementing sources_count rather than creating a duplicate file.
//
// Refuses to add an evidence entry whose `source` is already present
// (idempotent for retried captures).

const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('./config');

const COUNTER_EVIDENCE_RE = /^counter_evidence:.*$/m;
const SOURCES_COUNT_RE = /^sources_count:\s*(\d+)\s*$/m;
const UPDATED_RE = /^updated:\s*\S+\s*$/m;
// Match `field:` followed by either inline `[]` (empty list) or block-style entries.
const EVIDENCE_BLOCK_RE = /^evidence:[ \t]*(?:\[[ \t]*\])?((?:\r?\n[ \t]+[^\n]*)*)/m;
const COUNTER_EVIDENCE_BLOCK_RE = /^counter_evidence:[ \t]*(?:\[[ \t]*\])?((?:\r?\n[ \t]+[^\n]*)*)/m;
const FRESHNESS_RE = /^freshness:\s*\S+\s*$/m;

function appendEvidence(filepath, entry, { today } = {}) {
  if (!entry || !entry.source || !entry.quote || !entry.date) {
    throw new Error('appendEvidence: entry must have source, quote, date');
  }
  const todayStr = today || new Date().toISOString().slice(0, 10);

  let text = fs.readFileSync(filepath, 'utf-8');
  if (!text.startsWith('---')) {
    return { changed: false, reason: 'no frontmatter' };
  }
  const fmEnd = text.indexOf('\n---', 4);
  if (fmEnd === -1) return { changed: false, reason: 'malformed frontmatter' };
  let fm = text.slice(4, fmEnd);
  const body = text.slice(fmEnd + 4);

  // Idempotency: same source already present?
  const sourceLineRe = new RegExp(`^\\s*-\\s*source:\\s*${escapeRegex(entry.source)}\\s*$`, 'm');
  if (sourceLineRe.test(fm)) {
    return { changed: false, reason: `source already present: ${entry.source}` };
  }

  // sources_count: increment or initialize
  let newCount;
  if (SOURCES_COUNT_RE.test(fm)) {
    fm = fm.replace(SOURCES_COUNT_RE, (_m, n) => {
      newCount = Number(n) + 1;
      return `sources_count: ${newCount}`;
    });
  } else {
    newCount = 1;
    // Insert before counter_evidence if present, else at end of fm
    if (COUNTER_EVIDENCE_RE.test(fm)) {
      fm = fm.replace(COUNTER_EVIDENCE_RE, `sources_count: ${newCount}\ncounter_evidence:$&`).replace('counter_evidence:counter_evidence:', 'counter_evidence:');
    } else {
      fm = `${fm.replace(/\s+$/, '')}\nsources_count: ${newCount}`;
    }
  }

  // updated:
  if (UPDATED_RE.test(fm)) {
    fm = fm.replace(UPDATED_RE, `updated: ${todayStr}`);
  }

  // Append evidence entry
  const entryYaml = formatEvidenceEntry(entry);
  if (EVIDENCE_BLOCK_RE.test(fm)) {
    fm = fm.replace(EVIDENCE_BLOCK_RE, (m, existing) => {
      // Trim trailing whitespace/newlines from existing block, then append
      const trimmed = (existing || '').replace(/\s+$/, '');
      return `evidence:${trimmed}\n${entryYaml}`;
    });
  } else {
    // No evidence: line — add a fresh block before counter_evidence:
    const block = `evidence:\n${entryYaml}\n`;
    if (COUNTER_EVIDENCE_RE.test(fm)) {
      fm = fm.replace(COUNTER_EVIDENCE_RE, `${block}counter_evidence:`);
    } else {
      fm = `${fm.replace(/\s+$/, '')}\n${block}`;
    }
  }

  const newText = `---\n${fm}\n---${body}`;
  fs.writeFileSync(filepath, newText, 'utf-8');
  return { changed: true, newSourcesCount: newCount };
}

function formatEvidenceEntry({ source, quote, date }) {
  const safeQuote = JSON.stringify(quote);
  return `  - source: ${source}\n    quote: ${safeQuote}\n    date: ${date}`;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function appendCounterEvidence(filepath, entry, { today } = {}) {
  if (!entry || !entry.source || !entry.quote || !entry.date) {
    throw new Error('appendCounterEvidence: entry must have source, quote, date');
  }
  const todayStr = today || new Date().toISOString().slice(0, 10);

  let text = fs.readFileSync(filepath, 'utf-8');
  if (!text.startsWith('---')) {
    return { changed: false, reason: 'no frontmatter' };
  }
  const fmEnd = text.indexOf('\n---', 4);
  if (fmEnd === -1) return { changed: false, reason: 'malformed frontmatter' };
  let fm = text.slice(4, fmEnd);
  const body = text.slice(fmEnd + 4);

  // Idempotency: same source already present in counter_evidence?
  const existingCounter = fm.match(COUNTER_EVIDENCE_BLOCK_RE);
  if (existingCounter && existingCounter[1]) {
    const sourceLineRe = new RegExp(`^\\s*-\\s*source:\\s*${escapeRegex(entry.source)}\\s*$`, 'm');
    if (sourceLineRe.test(existingCounter[1])) {
      return { changed: false, reason: `source already present in counter_evidence: ${entry.source}` };
    }
  }

  // updated:
  if (UPDATED_RE.test(fm)) {
    fm = fm.replace(UPDATED_RE, `updated: ${todayStr}`);
  }

  // Append counter_evidence entry (do NOT touch sources_count — counter is tracked separately)
  const entryYaml = formatEvidenceEntry(entry);
  if (COUNTER_EVIDENCE_BLOCK_RE.test(fm)) {
    fm = fm.replace(COUNTER_EVIDENCE_BLOCK_RE, (m, existing) => {
      const trimmed = (existing || '').replace(/\s+$/, '');
      return `counter_evidence:${trimmed}\n${entryYaml}`;
    });
  } else {
    fm = `${fm.replace(/\s+$/, '')}\ncounter_evidence:\n${entryYaml}`;
  }

  // Compute counts after edit to decide freshness flip
  const newFm = fm;
  const evidenceCount = countYamlListItems(newFm.match(EVIDENCE_BLOCK_RE)?.[1] || '');
  const counterCount = countYamlListItems(newFm.match(COUNTER_EVIDENCE_BLOCK_RE)?.[1] || '');

  let freshnessChanged = null;
  if (counterCount > evidenceCount && FRESHNESS_RE.test(fm)) {
    fm = fm.replace(FRESHNESS_RE, 'freshness: contradicted');
    freshnessChanged = 'contradicted';
  }

  const newText = `---\n${fm}\n---${body}`;
  fs.writeFileSync(filepath, newText, 'utf-8');
  return {
    changed: true,
    evidenceCount,
    counterCount,
    freshnessChanged,
  };
}

function countYamlListItems(block) {
  if (!block) return 0;
  return (block.match(/^\s*-\s+source:/gm) || []).length;
}

function findSimilarBelief(brainRoot, slug, { typeFilter = null } = {}) {
  const notesDir = path.join(brainRoot, 'Notes');
  if (!fs.existsSync(notesDir)) return null;

  // Exact slug match first
  const exactPath = path.join(notesDir, `${slug}.md`);
  if (fs.existsSync(exactPath)) {
    if (typeFilter) {
      const fm = parseFrontmatter(exactPath);
      if (fm.type !== typeFilter) return null;
    }
    return exactPath;
  }

  // Fuzzy: filename contains slug or slug contains filename stem
  const slugLower = slug.toLowerCase();
  for (const f of fs.readdirSync(notesDir)) {
    if (!f.endsWith('.md')) continue;
    const stem = f.slice(0, -3).toLowerCase();
    if (stem.includes(slugLower) || slugLower.includes(stem)) {
      const fp = path.join(notesDir, f);
      if (typeFilter) {
        const fm = parseFrontmatter(fp);
        if (fm.type !== typeFilter) continue;
      }
      return fp;
    }
  }

  return null;
}

module.exports = { appendEvidence, appendCounterEvidence, findSimilarBelief };

if (require.main === module) {
  const args = process.argv.slice(2);
  if ((args[0] === 'append' || args[0] === 'append-counter') && args[1] && args[2]) {
    const filepath = args[1];
    let entry;
    try {
      entry = JSON.parse(args[2]);
    } catch {
      process.stderr.write('error: entry arg must be valid JSON\n');
      process.exit(1);
    }
    const fn = args[0] === 'append-counter' ? appendCounterEvidence : appendEvidence;
    const result = fn(filepath, entry);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(0);
  }
  if (args[0] === 'find-similar' && args[1] && args[2]) {
    const result = findSimilarBelief(args[1], args[2], { typeFilter: args[3] || null });
    process.stdout.write((result || '(none)') + '\n');
    process.exit(0);
  }
  process.stderr.write('Usage:\n  node append-evidence.js append <filepath> <entry-json>\n  node append-evidence.js append-counter <filepath> <entry-json>\n  node append-evidence.js find-similar <brain-root> <slug> [type]\n');
  process.exit(1);
}
