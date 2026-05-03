const fs = require('fs');
const path = require('path');
const { getBrainRoot } = require('./scripts/config');
const { formatCompact } = require('./scripts/build-index');
const { buildCaptureContext } = require('./scripts/build-context');

const MAX_EVIDENCE_LINES = 20;

function truncateEvidence(persona) {
  const evidenceHeader = /^###?\s*Evidence\s*Log/im;
  const match = persona.match(evidenceHeader);
  if (!match) return persona;

  const headerIdx = persona.indexOf(match[0]);
  const beforeEvidence = persona.slice(0, headerIdx + match[0].length);
  const afterHeader = persona.slice(headerIdx + match[0].length);

  const nextSection = afterHeader.match(/^##\s/m);
  const evidenceBlock = nextSection ? afterHeader.slice(0, nextSection.index) : afterHeader;
  const afterEvidence = nextSection ? afterHeader.slice(nextSection.index) : '';

  const lines = evidenceBlock.split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('['));
  if (lines.length <= MAX_EVIDENCE_LINES) return persona;

  const truncated = lines.slice(-MAX_EVIDENCE_LINES);
  return beforeEvidence + '\n' + truncated.join('\n') + '\n\n' + afterEvidence;
}

const plugin = {
  id: 'remember',
  name: 'Remember',
  description: 'Portable knowledge base — one brain, every AI tool. Extract decisions, people, and insights from your AI sessions into organized local markdown.',
  version: '2.0.6',

  configSchema: {
    type: 'object',
    properties: {
      brainPath: {
        type: 'string',
        default: '~/remember',
        description: 'Path to your Remember brain (markdown knowledge base)',
      },
    },
    additionalProperties: false,
  },

  register(api) {
    // Read plugin config and set environment for scripts
    const pluginCfg = api.pluginConfig || {};
    const brainPath = pluginCfg.brainPath || process.env.REMEMBER_BRAIN_PATH || '~/remember';
    const expandedPath = brainPath.startsWith('~')
      ? path.join(require('os').homedir(), brainPath.slice(1))
      : path.resolve(brainPath);
    process.env.REMEMBER_BRAIN_PATH = expandedPath;

    // Hook: Inject Persona.md on session_start
    // (migrated from openclaw-hooks/persona-loader/handler.js)
    api.on('session_start', async (event) => {
      const brain = getBrainRoot();
      if (!brain || !fs.existsSync(brain)) return;

      const personaPath = path.join(brain, 'Persona.md');
      let persona;
      try {
        persona = fs.readFileSync(personaPath, 'utf-8');
      } catch {
        return;
      }
      if (!persona || !persona.trim()) return;

      persona = truncateEvidence(persona);

      return {
        prependContext:
          `# REMEMBER BRAIN LOADED\nBrain: ${brain}\n\n` +
          `## PERSONA\n${persona}\n\n` +
          `Commands: /remember:process, /remember:status, 'remember this: ...'`,
      };
    });

    // Tool: remember_brain_dump_context
    // Returns brain index + processing instructions when the agent needs to save knowledge
    api.registerTool({
      name: 'remember_brain_dump_context',
      description: 'Get brain dump context with index and processing instructions. Call this when the user says "remember this", "save this", "brain dump", or similar.',
      parameters: {
        type: 'object',
        properties: {
          userMessage: {
            type: 'string',
            description: 'The user message that triggered the brain dump',
          },
        },
        required: ['userMessage'],
      },
      async execute(_id, _params) {
        const brain = getBrainRoot();
        if (!fs.existsSync(brain)) {
          return { content: [{ type: 'text', text: 'Brain not found. Run /remember:init first.' }] };
        }
        const context = buildCaptureContext(brain, __dirname);
        return { content: [{ type: 'text', text: context }] };
      },
    });

    // Tool: remember_brain_index
    // Returns compact brain index for quick lookups
    api.registerTool({
      name: 'remember_brain_index',
      description: 'Get the brain index showing all tracked people, projects, areas, notes, tasks, and journal entries.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      async execute() {
        const brain = getBrainRoot();
        if (!fs.existsSync(brain)) {
          return { content: [{ type: 'text', text: 'Brain not found. Run /remember:init first.' }] };
        }

        try {
          const index = formatCompact(brain);
          return { content: [{ type: 'text', text: index }] };
        } catch (err) {
          return { content: [{ type: 'text', text: `Error building index: ${err.message}` }] };
        }
      },
    });
  },
};

module.exports = plugin;
module.exports.default = plugin;
