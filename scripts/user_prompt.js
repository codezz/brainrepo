#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { getBrainRoot, loadConfig } = require('./config');
const { buildCaptureContext } = require('./build-context');

if (process.env.REMEMBER_PROCESSING === '1') process.exit(0);

let input = '';
try {
  input = fs.readFileSync(0, 'utf-8');
} catch {
  process.exit(0);
}

const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
const brain = getBrainRoot();

if (!fs.existsSync(brain)) process.exit(0);

const config = loadConfig();
const keywords = config.session?.brain_dump_keywords || [
  'save this', 'remember this', 'brain dump', 'note to self',
  'capture this', 'save to brain', 'write to brain', 'add to brain',
  'salvează', 'notează', 'reține',
];

const inputLower = input.toLowerCase();
if (!keywords.some(k => inputLower.includes(k))) process.exit(0);

const context = buildCaptureContext(brain, pluginRoot);

const output = {
  hookSpecificOutput: {
    hookEventName: 'UserPromptSubmit',
    additionalContext: context,
  },
};

console.log(JSON.stringify(output, null, 0));
