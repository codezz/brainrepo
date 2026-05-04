#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const STATE_DIR = path.join(
  process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state'),
  'remember',
);
const DEFAULT_LOG_PATH = path.join(STATE_DIR, 'evolution.log');

const VALID_TYPES = new Set([
  'PROMOTE',
  'DEMOTE',
  'CONSOLIDATE',
  'REFLECT',
  'STALE',
  'CONTRADICT',
  'ARCHIVE_CANDIDATE',
]);

function appendEvent(type, message, { logPath = DEFAULT_LOG_PATH } = {}) {
  if (!VALID_TYPES.has(type)) {
    throw new Error(`unknown event type: ${type} (allowed: ${[...VALID_TYPES].join(', ')})`);
  }

  fs.mkdirSync(path.dirname(logPath), { recursive: true });

  const ts = new Date().toISOString();
  const line = `${ts}  ${type}  ${message}\n`;
  fs.appendFileSync(logPath, line, 'utf-8');
}

module.exports = {
  VALID_TYPES,
  DEFAULT_LOG_PATH,
  appendEvent,
};

// CLI: node evolution-log.js <TYPE> <message...>
if (require.main === module) {
  const [, , type, ...rest] = process.argv;
  if (!type || !rest.length) {
    process.stderr.write('Usage: evolution-log.js <TYPE> <message...>\n');
    process.stderr.write(`Types: ${[...VALID_TYPES].join(', ')}\n`);
    process.exit(1);
  }
  appendEvent(type, rest.join(' '));
}
