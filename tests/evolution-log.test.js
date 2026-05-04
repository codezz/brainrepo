'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const log = require('../scripts/evolution-log');

function freshTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'remember-evolog-'));
}

test('appendEvent writes a line in TIMESTAMP TYPE MESSAGE format', () => {
  const dir = freshTmpDir();
  const file = path.join(dir, 'evolution.log');

  log.appendEvent('PROMOTE', 'Notes/x → Persona.Top conf=0.87', { logPath: file });

  const text = fs.readFileSync(file, 'utf-8');
  const lines = text.trim().split('\n');
  assert.equal(lines.length, 1);

  const line = lines[0];
  assert.match(line, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\s+PROMOTE\s+Notes\/x → Persona\.Top conf=0\.87$/);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('appendEvent appends — preserves prior lines', () => {
  const dir = freshTmpDir();
  const file = path.join(dir, 'evolution.log');

  log.appendEvent('REFLECT', 'first', { logPath: file });
  log.appendEvent('PROMOTE', 'second', { logPath: file });

  const text = fs.readFileSync(file, 'utf-8');
  const lines = text.trim().split('\n');
  assert.equal(lines.length, 2);
  assert.match(lines[0], /\bREFLECT\s+first$/);
  assert.match(lines[1], /\bPROMOTE\s+second$/);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('appendEvent creates parent dir if missing', () => {
  const dir = freshTmpDir();
  const file = path.join(dir, 'nested', 'state', 'evolution.log');

  log.appendEvent('STALE', 'note', { logPath: file });
  assert.ok(fs.existsSync(file));

  fs.rmSync(dir, { recursive: true, force: true });
});

test('appendEvent rejects unknown type', () => {
  const dir = freshTmpDir();
  const file = path.join(dir, 'evolution.log');

  assert.throws(
    () => log.appendEvent('NOPE', 'msg', { logPath: file }),
    /unknown event type/i,
  );

  fs.rmSync(dir, { recursive: true, force: true });
});
