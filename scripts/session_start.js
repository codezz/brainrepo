#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { getBrainRoot, loadConfig } = require('./config');

const MAX_EVIDENCE_LINES = 10;

const PASSIVE_NUDGE_INSTRUCTION = `
CAPTURE NUDGE (apply silently throughout this session):
If during this conversation the user reveals a stable preference, technical
decision they're committing to, or a recurring pattern worth remembering
(in any language — English, Romanian, mixed), at most ONCE per topic,
gently suggest at the end of your response:

> 💡 Want me to remember this? Reply: \`remember this: <verbatim phrasing>\`

Rules:
- Only nudge for content that is stable, opinionated, or factual — NOT for
  ongoing exploration, hypotheticals, or things the user is still figuring out.
- Never nudge twice for the same topic in one session.
- Never auto-capture. The user always confirms with their next message.
- Skip the nudge entirely if the user's message already starts with a
  capture keyword (remember this, save this, brain dump, salvează, notează…).
- Be brief. One short suggestion line at the very end. Don't disrupt the flow
  of the answer itself.
`.trim();

const brain = getBrainRoot();
if (!fs.existsSync(brain)) process.exit(0);

const config = loadConfig();
const passiveNudgeEnabled = config.session?.passive_nudge !== false;

const personaPath = path.join(brain, 'Persona.md');
let persona;
try { persona = fs.readFileSync(personaPath, 'utf-8'); } catch { process.exit(0); }
if (!persona.trim()) process.exit(0);

// Truncate evidence log to last N entries to prevent context bloat
const evidenceHeader = /^###?\s*Evidence\s*Log/im;
const match = persona.match(evidenceHeader);
if (match) {
  const headerIdx = persona.indexOf(match[0]);
  const beforeEvidence = persona.slice(0, headerIdx + match[0].length);
  const afterHeader = persona.slice(headerIdx + match[0].length);

  // Find where next section starts (or end of file)
  const nextSection = afterHeader.match(/^##\s/m);
  const evidenceBlock = nextSection ? afterHeader.slice(0, nextSection.index) : afterHeader;
  const afterEvidence = nextSection ? afterHeader.slice(nextSection.index) : '';

  const evidenceLines = evidenceBlock.split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('['));
  if (evidenceLines.length > MAX_EVIDENCE_LINES) {
    const truncated = evidenceLines.slice(-MAX_EVIDENCE_LINES);
    persona = beforeEvidence + '\n' + truncated.join('\n') + '\n\n' + afterEvidence;
  }
}

const nudgeBlock = passiveNudgeEnabled ? `${PASSIVE_NUDGE_INSTRUCTION}\n\n` : '';

process.stdout.write(
  `REMEMBER BRAIN LOADED. Brain: ${brain}\n\n` +
  `PERSONA (apply throughout session):\n${persona}\n\n` +
  nudgeBlock +
  `Commands: /remember:process, /remember:status, 'remember this: ...'\n`
);
