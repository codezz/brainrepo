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
gently suggest at the end of your response, **showing the exact content
you'd save** so the user can verify before confirming:

> 💡 Want me to remember this?
> "<the verbatim or near-verbatim phrasing you'd capture>"

Format the quoted content faithfully. Trim it to one or two lines if the
original is long, but keep the technical specifics (paths, commands, names,
numbers) intact. Don't paraphrase away the precision.

Rules:
- Only nudge for content that is stable, opinionated, or factual — NOT for
  ongoing exploration, hypotheticals, or things the user is still figuring out.
- Never nudge twice for the same topic in one session.
- Skip the nudge entirely if the user's message already starts with a
  capture keyword (remember this, save this, brain dump, salvează, notează…).
- On a short affirmative response ("yes", "da", "ok", "save it", "go ahead",
  "sigur", "salveaza", etc.) immediately following your nudge, invoke the
  capture skill using the quoted content from the nudge as the input.
- If the user replies with edits ("yes but change X to Y", "save it as Z
  instead"), apply the edits and then capture the corrected version.
- On a negative or non-committal response ("no", "nu", "later", "skip",
  silence + new topic), drop the nudge silently — never re-prompt.
- Never auto-capture without explicit affirmative confirmation.
- Be brief. The nudge is two lines max (the question + the quoted content).
  Don't disrupt the flow of the answer itself.
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
