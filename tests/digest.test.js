'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const digest = require('../scripts/digest');

function freshTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'remember-digest-'));
}

test('parseLogLine: valid PROMOTE line', () => {
  const line = '2026-05-04T15:32:14.000Z  PROMOTE  Notes/x.md → Persona.Top conf=0.87 sources=6';
  const out = digest.parseLogLine(line);
  assert.equal(out.type, 'PROMOTE');
  assert.equal(out.message, 'Notes/x.md → Persona.Top conf=0.87 sources=6');
  assert.ok(out.timestamp instanceof Date);
  assert.equal(out.timestamp.toISOString(), '2026-05-04T15:32:14.000Z');
});

test('parseLogLine: returns null for malformed line', () => {
  assert.equal(digest.parseLogLine(''), null);
  assert.equal(digest.parseLogLine('garbage'), null);
  assert.equal(digest.parseLogLine('2026-05-04 not a real timestamp'), null);
});

test('parseLog: multi-line text returns parsed entries, skips blanks/garbage', () => {
  const text = [
    '2026-05-04T15:32:14.000Z  PROMOTE  Notes/x.md',
    '',
    'garbage line',
    '2026-05-04T15:33:01.000Z  REFLECT  Notes/y.md conf 0.7→0.8',
  ].join('\n');
  const entries = digest.parseLog(text);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].type, 'PROMOTE');
  assert.equal(entries[1].type, 'REFLECT');
});

test('filterByDateRange: includes entries in [start, end), excludes outside', () => {
  const entries = [
    { timestamp: new Date('2026-04-30T00:00:00Z'), type: 'X', message: 'a' },
    { timestamp: new Date('2026-05-01T00:00:00Z'), type: 'X', message: 'b' },
    { timestamp: new Date('2026-05-04T12:00:00Z'), type: 'X', message: 'c' },
    { timestamp: new Date('2026-05-08T00:00:00Z'), type: 'X', message: 'd' },
  ];
  const start = new Date('2026-05-01T00:00:00Z');
  const end = new Date('2026-05-08T00:00:00Z');
  const out = digest.filterByDateRange(entries, start, end);
  assert.deepEqual(out.map(e => e.message), ['b', 'c']);
});

test('summarize: groups entries by type', () => {
  const entries = [
    { timestamp: new Date(), type: 'PROMOTE', message: 'a' },
    { timestamp: new Date(), type: 'PROMOTE', message: 'b' },
    { timestamp: new Date(), type: 'DEMOTE', message: 'c' },
    { timestamp: new Date(), type: 'CONSOLIDATE', message: 'd' },
    { timestamp: new Date(), type: 'STALE', message: 'e' },
  ];
  const s = digest.summarize(entries);
  assert.equal(s.promoted.length, 2);
  assert.equal(s.demoted.length, 1);
  assert.equal(s.consolidated.length, 1);
  assert.equal(s.stale.length, 1);
  assert.equal(s.reflected.length, 0);
});

test('weekRange: returns Monday 00:00 UTC start, +7 days end (ISO week)', () => {
  // 2026-05-04 is a Monday
  const r = digest.weekRange(new Date('2026-05-06T15:00:00Z')); // Wed of week 19
  assert.equal(r.start.toISOString(), '2026-05-04T00:00:00.000Z');
  assert.equal(r.end.toISOString(), '2026-05-11T00:00:00.000Z');
});

test('weekRange: Sunday goes to its preceding Monday', () => {
  // 2026-05-03 is a Sunday → should go to 2026-04-27 (prior Monday)
  const r = digest.weekRange(new Date('2026-05-03T08:00:00Z'));
  assert.equal(r.start.toISOString(), '2026-04-27T00:00:00.000Z');
  assert.equal(r.end.toISOString(), '2026-05-04T00:00:00.000Z');
});

test('isoWeekLabel: returns YYYY-WNN string', () => {
  // 2026-05-04 is Monday of ISO week 19
  assert.equal(digest.isoWeekLabel(new Date('2026-05-04T00:00:00Z')), '2026-W19');
});

test('readLogForRange: tolerates missing file', () => {
  const tmp = freshTmp();
  const out = digest.readLogForRange(
    path.join(tmp, 'nope.log'),
    new Date(),
    new Date(),
  );
  assert.deepEqual(out, []);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('readLogForRange: end-to-end on a real log file', () => {
  const tmp = freshTmp();
  const logPath = path.join(tmp, 'evolution.log');
  fs.writeFileSync(
    logPath,
    [
      '2026-04-29T10:00:00.000Z  PROMOTE  Notes/old.md',
      '2026-05-04T10:00:00.000Z  PROMOTE  Notes/a.md',
      '2026-05-05T10:00:00.000Z  REFLECT  Notes/b.md conf 0.7→0.8',
      '2026-05-12T10:00:00.000Z  PROMOTE  Notes/future.md',
      '',
    ].join('\n'),
    'utf-8',
  );
  const out = digest.readLogForRange(
    logPath,
    new Date('2026-05-04T00:00:00Z'),
    new Date('2026-05-11T00:00:00Z'),
  );
  assert.equal(out.length, 2);
  assert.equal(out[0].message, 'Notes/a.md');
  assert.equal(out[1].message, 'Notes/b.md conf 0.7→0.8');
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('renderDigest: produces a markdown summary with sections per type', () => {
  const summary = {
    promoted: [{ message: 'Notes/a.md → Persona.Top' }, { message: 'Notes/b.md → Persona.Top' }],
    demoted: [{ message: 'Notes/c.md ← Persona.Top reason=stale' }],
    consolidated: [{ message: 'People/x.md touches=+3' }],
    reflected: [{ message: 'Notes/d.md conf 0.7→0.85' }],
    stale: [],
    contradicted: [{ message: 'Notes/e.md counter=2' }],
    archive_candidates: [],
  };
  const md = digest.renderDigest({ label: '2026-W19', start: new Date('2026-05-04Z'), end: new Date('2026-05-11Z'), summary });
  assert.match(md, /^# Brain digest — 2026-W19/m);
  assert.match(md, /## Promoted to Persona Top \(2\)/);
  assert.match(md, /## Demoted from Persona Top \(1\)/);
  assert.match(md, /## Consolidated \(1\)/);
  assert.match(md, /## Reflected \(1\)/);
  assert.match(md, /## Contradicted \(1\)/);
});

test('renderDigest: empty summary still renders cleanly', () => {
  const empty = { promoted: [], demoted: [], consolidated: [], reflected: [], stale: [], contradicted: [], archive_candidates: [] };
  const md = digest.renderDigest({ label: '2026-W20', start: new Date(), end: new Date(), summary: empty });
  assert.match(md, /No changes this week/);
});
