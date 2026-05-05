#!/usr/bin/env node
'use strict';

// PostToolUse hook handler for Write|Edit. Receives the tool invocation JSON
// on stdin, locates the affected file, and runs validateAndUpgrade if it
// belongs to the user's brain. Self-healing schema/sections without burdening
// skill prompts.
//
// Skipped silently outside the brain or when REMEMBER_BRAIN_PATH is unset.

const fs = require('node:fs');
const path = require('node:path');
const { getBrainRoot } = require('./config');
const { validateAndUpgrade } = require('./schema');

let raw = '';
try {
  raw = fs.readFileSync(0, 'utf-8');
} catch {
  process.exit(0);
}

let input;
try {
  input = JSON.parse(raw || '{}');
} catch {
  process.exit(0);
}

const filePath = input?.tool_input?.file_path;
if (!filePath) process.exit(0);

let brainRoot;
try {
  brainRoot = getBrainRoot();
} catch {
  process.exit(0);
}

const abs = path.resolve(filePath);
const root = path.resolve(brainRoot);
if (abs !== root && !abs.startsWith(root + path.sep)) {
  // Outside brain — silent no-op
  process.exit(0);
}

let result;
try {
  result = validateAndUpgrade(abs, { brainRoot: root });
} catch (err) {
  // Never block the user's edit — log to stderr only.
  process.stderr.write(`[remember post_write] error: ${err.message}\n`);
  process.exit(0);
}

if (!result.changed && !result.warnings.length) process.exit(0);

const lines = [];
if (result.addedFields.length) {
  lines.push(`schema fields added: ${result.addedFields.join(', ')}`);
}
if (result.addedSections.length) {
  lines.push(`Persona sections added: ${result.addedSections.join(', ')}`);
}
for (const w of result.warnings) lines.push(`warning: ${w}`);

const output = {
  hookSpecificOutput: {
    hookEventName: 'PostToolUse',
    additionalContext: `[remember] auto-upgraded ${path.relative(root, abs)}\n  ${lines.join('\n  ')}`,
  },
};
process.stdout.write(JSON.stringify(output));
