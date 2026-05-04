#!/usr/bin/env node
'use strict';

// Aggregation helpers for /remember:digest. Reads ~/.local/state/remember/evolution.log
// and produces structured weekly/monthly summaries. Pure data manipulation —
// the digest skill formats the output and writes Journal/digests/<label>.md.

const fs = require('node:fs');
const path = require('node:path');

const LOG_LINE_RE = /^(\S+T\S+Z)\s+(\S+)\s+(.*)$/;

function parseLogLine(line) {
  if (!line || typeof line !== 'string') return null;
  const m = line.match(LOG_LINE_RE);
  if (!m) return null;
  const ts = new Date(m[1]);
  if (Number.isNaN(ts.getTime())) return null;
  return { timestamp: ts, type: m[2], message: m[3] };
}

function parseLog(text) {
  const out = [];
  for (const line of text.split('\n')) {
    const parsed = parseLogLine(line);
    if (parsed) out.push(parsed);
  }
  return out;
}

function filterByDateRange(entries, start, end) {
  return entries.filter(e => e.timestamp >= start && e.timestamp < end);
}

function summarize(entries) {
  const out = {
    promoted: [],
    demoted: [],
    consolidated: [],
    reflected: [],
    stale: [],
    contradicted: [],
    archive_candidates: [],
  };
  const map = {
    PROMOTE: 'promoted',
    DEMOTE: 'demoted',
    CONSOLIDATE: 'consolidated',
    REFLECT: 'reflected',
    STALE: 'stale',
    CONTRADICT: 'contradicted',
    ARCHIVE_CANDIDATE: 'archive_candidates',
  };
  for (const e of entries) {
    const bucket = map[e.type];
    if (bucket) out[bucket].push(e);
  }
  return out;
}

function weekRange(date) {
  const d = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  ));
  // ISO weekday: Mon=1 ... Sun=7. JS getUTCDay: Sun=0, Mon=1, ..., Sat=6.
  const isoDay = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - (isoDay - 1));
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return { start, end };
}

function isoWeekLabel(date) {
  // ISO week year + week number per https://en.wikipedia.org/wiki/ISO_week_date
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const isoDay = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + 4 - isoDay);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function readLogForRange(logPath, start, end) {
  if (!fs.existsSync(logPath)) return [];
  const text = fs.readFileSync(logPath, 'utf-8');
  const entries = parseLog(text);
  return filterByDateRange(entries, start, end);
}

function renderSection(title, entries) {
  if (!entries.length) return '';
  const lines = entries.map(e => `- ${e.message}`);
  return `## ${title} (${entries.length})\n\n${lines.join('\n')}\n\n`;
}

function renderDigest({ label, start, end, summary }) {
  const lines = [];
  lines.push(`# Brain digest — ${label}\n`);
  lines.push(`Range: ${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)}\n`);

  const total =
    summary.promoted.length +
    summary.demoted.length +
    summary.consolidated.length +
    summary.reflected.length +
    summary.stale.length +
    summary.contradicted.length +
    summary.archive_candidates.length;

  if (total === 0) {
    lines.push('\n_No changes this week — brain is quiet. Run `/remember:remember` or `/remember:process` to capture more material._\n');
    return lines.join('\n');
  }

  lines.push('');
  lines.push(renderSection('Promoted to Persona Top', summary.promoted));
  lines.push(renderSection('Demoted from Persona Top', summary.demoted));
  lines.push(renderSection('Consolidated', summary.consolidated));
  lines.push(renderSection('Reflected', summary.reflected));
  lines.push(renderSection('Marked stale', summary.stale));
  lines.push(renderSection('Contradicted', summary.contradicted));
  lines.push(renderSection('Archive candidates', summary.archive_candidates));

  return lines.join('').trimEnd() + '\n';
}

module.exports = {
  parseLogLine,
  parseLog,
  filterByDateRange,
  summarize,
  weekRange,
  isoWeekLabel,
  readLogForRange,
  renderDigest,
};

if (require.main === module) {
  // CLI: node digest.js [--week | --month] [path-to-log]
  const args = process.argv.slice(2);
  const monthMode = args.includes('--month');
  const customLog = args.find(a => !a.startsWith('--'));
  const STATE_DIR = path.join(
    process.env.XDG_STATE_HOME || path.join(require('node:os').homedir(), '.local', 'state'),
    'remember',
  );
  const logPath = customLog || path.join(STATE_DIR, 'evolution.log');

  const now = new Date();
  let start;
  let end;
  let label;
  if (monthMode) {
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    label = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`;
  } else {
    ({ start, end } = weekRange(now));
    label = isoWeekLabel(start);
  }

  const entries = readLogForRange(logPath, start, end);
  const summary = summarize(entries);
  process.stdout.write(renderDigest({ label, start, end, summary }));
}
