/**
 * Tests for /debate command - plugin structure, prompt templates,
 * command/skill/agent alignment, security, interactive selection,
 * NLP parsing, state management, error handling, synthesis format,
 * cross-file consistency, universal evidence standard, and anti-convergence.
 *
 * The debate plugin is entirely markdown-based (no JS code).
 * These tests validate the markdown content for correctness,
 * completeness, and cross-file consistency.
 */

const fs = require('fs');
const path = require('path');

const pluginsDir = path.join(__dirname, '..', 'plugins');
const adaptersDir = path.join(__dirname, '..', 'adapters');
const debateDir = path.join(pluginsDir, 'debate');
const commandPath = path.join(debateDir, 'commands', 'debate.md');
const skillPath = path.join(debateDir, 'skills', 'debate', 'SKILL.md');
const agentPath = path.join(debateDir, 'agents', 'debate-orchestrator.md');
const pluginJsonPath = path.join(debateDir, '.claude-plugin', 'plugin.json');
const codexSkillPath = path.join(adaptersDir, 'codex', 'skills', 'debate', 'SKILL.md');
const openCodeCommandPath = path.join(adaptersDir, 'opencode', 'commands', 'debate.md');
const openCodeSkillPath = path.join(adaptersDir, 'opencode', 'skills', 'debate', 'SKILL.md');
const openCodeAgentPath = path.join(adaptersDir, 'opencode', 'agents', 'debate-orchestrator.md');
const openCodeConsultSkillPath = path.join(adaptersDir, 'opencode', 'skills', 'consult', 'SKILL.md');
const consultSkillPath = path.join(__dirname, '..', 'plugins', 'consult', 'skills', 'consult', 'SKILL.md');

// Load all files once
let commandContent, skillContent, agentContent, pluginJson;
let codexSkillContent, openCodeCommandContent, openCodeSkillContent, openCodeAgentContent;
let openCodeConsultSkillContent, consultSkillContent;

beforeAll(() => {
  commandContent = fs.readFileSync(commandPath, 'utf8');
  skillContent = fs.readFileSync(skillPath, 'utf8');
  agentContent = fs.readFileSync(agentPath, 'utf8');
  pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
  codexSkillContent = fs.readFileSync(codexSkillPath, 'utf8');
  openCodeCommandContent = fs.readFileSync(openCodeCommandPath, 'utf8');
  openCodeSkillContent = fs.readFileSync(openCodeSkillPath, 'utf8');
  openCodeAgentContent = fs.readFileSync(openCodeAgentPath, 'utf8');
  openCodeConsultSkillContent = fs.readFileSync(openCodeConsultSkillPath, 'utf8');
  consultSkillContent = fs.readFileSync(consultSkillPath, 'utf8');
});

// ─── Helpers ────────────────────────────────────────────────────────
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const fm = {};
  const lines = match[1].split('\n');
  let currentKey = null;
  let collecting = false;
  let items = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (collecting && /^\s+-\s/.test(line)) {
      items.push(line.replace(/^\s+-\s*/, '').trim());
      continue;
    }
    if (collecting) {
      fm[currentKey] = items;
      collecting = false;
      items = [];
    }
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.substring(0, colonIdx).trim();
    let value = line.substring(colonIdx + 1).trim();
    if (value === '' && i + 1 < lines.length && /^\s+-\s/.test(lines[i + 1])) {
      currentKey = key;
      collecting = true;
      items = [];
      continue;
    }
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    fm[key] = value;
  }
  if (collecting) fm[currentKey] = items;
  return fm;
}

// ─── 1. Plugin Structure ────────────────────────────────────────────
describe('debate plugin structure', () => {
  test('plugin.json exists and is valid JSON', () => {
    expect(fs.existsSync(pluginJsonPath)).toBe(true);
    expect(() => JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'))).not.toThrow();
  });

  test('plugin.json has required fields', () => {
    expect(pluginJson.name).toBe('debate');
    expect(pluginJson.version).toBeDefined();
    expect(pluginJson.description).toBeDefined();
  });

  test('has exactly 1 command', () => {
    const commandsDir = path.join(debateDir, 'commands');
    const commands = fs.readdirSync(commandsDir).filter(f => f.endsWith('.md'));
    expect(commands).toEqual(['debate.md']);
  });

  test('has exactly 1 agent', () => {
    const agentsDir = path.join(debateDir, 'agents');
    const agents = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
    expect(agents).toEqual(['debate-orchestrator.md']);
  });

  test('has exactly 1 skill', () => {
    const skillsDir = path.join(debateDir, 'skills');
    const skills = fs.readdirSync(skillsDir).filter(f =>
      fs.statSync(path.join(skillsDir, f)).isDirectory()
    );
    expect(skills).toEqual(['debate']);
    expect(fs.existsSync(skillPath)).toBe(true);
  });

  test('all files have valid frontmatter', () => {
    for (const [_label, content] of [
      ['command', commandContent],
      ['skill', skillContent],
      ['agent', agentContent]
    ]) {
      const fm = parseFrontmatter(content);
      expect(fm).not.toBeNull();
      expect(fm.name).toBeDefined();
      expect(fm.description).toBeDefined();
    }
  });
});

// ─── 2. Provider Configuration (Prompt Templates) ───────────────────
describe('provider configuration - prompt templates', () => {
  test('skill documents proposer role', () => {
    expect(skillContent).toMatch(/PROPOSER/);
    expect(skillContent).toMatch(/proposer/i);
  });

  test('skill documents challenger role', () => {
    expect(skillContent).toMatch(/CHALLENGER/);
    expect(skillContent).toMatch(/challenger/i);
  });

  test('skill has Proposer Opening template', () => {
    expect(skillContent).toMatch(/Round 1: Proposer Opening/);
  });

  test('skill has Challenger Response template', () => {
    expect(skillContent).toMatch(/Round 1: Challenger Response/);
  });

  test('skill has Proposer Defense template', () => {
    expect(skillContent).toMatch(/Round 2\+: Proposer Defense/);
  });

  test('skill has Challenger Follow-up template', () => {
    expect(skillContent).toMatch(/Round 2\+: Challenger Follow-up/);
  });

  test('all 4 prompt templates are present', () => {
    const templates = [
      'Round 1: Proposer Opening',
      'Round 1: Challenger Response',
      'Round 2+: Proposer Defense',
      'Round 2+: Challenger Follow-up'
    ];
    for (const template of templates) {
      expect(skillContent).toContain(template);
    }
  });
});

// ─── 3. Command / Skill / Agent Alignment ───────────────────────────
describe('command/skill/agent alignment', () => {
  test('command invokes debate and consult skills inline', () => {
    expect(commandContent).toMatch(/Skill:\s*debate/);
    expect(commandContent).toMatch(/Skill:\s*consult/);
  });

  test('agent invokes debate skill', () => {
    expect(agentContent).toMatch(/Skill:\s*debate/);
  });

  test('agent invokes consult skill for tool calls', () => {
    expect(agentContent).toMatch(/Skill:\s*consult/);
  });

  test('command invokes skills via Skill blocks in Phase 3', () => {
    const phase3Match = commandContent.match(/### Phase 3[\s\S]*$/);
    expect(phase3Match).not.toBeNull();
    const phase3 = phase3Match[0];
    expect(phase3).toMatch(/Skill:\s*debate/);
    expect(phase3).toMatch(/Skill:\s*consult/);
  });

  test('agent has Skill tool for invoking skills', () => {
    const fm = parseFrontmatter(agentContent);
    const toolsStr = Array.isArray(fm.tools) ? fm.tools.join(', ') : fm.tools;
    expect(toolsStr).toContain('Skill');
  });

  test('command does not spawn debate-orchestrator via Task', () => {
    expect(commandContent).not.toMatch(/subagent_type.*debate-orchestrator|debate:debate-orchestrator/);
  });
});

// ─── 4. Security Constraints ────────────────────────────────────────
describe('security constraints', () => {
  test('command has NEVER-expose-API-keys constraint', () => {
    expect(commandContent).toMatch(/NEVER.*expose.*API.*key/i);
  });

  test('command has NEVER-permission-bypassing constraint', () => {
    expect(commandContent).toMatch(
      /NEVER.*permission-bypassing|NEVER.*dangerously-skip-permissions/i
    );
  });

  test('command validates tool names against allow-list', () => {
    expect(commandContent).toMatch(/validate.*tool.*against.*allow-list|allow-list.*gemini.*codex.*claude/i);
  });

  test('orchestrator has output sanitization section', () => {
    expect(agentContent).toMatch(/Output Sanitization/);
  });

  test('command has output sanitization section', () => {
    expect(commandContent).toMatch(/## Output Sanitization/);
  });

  test('orchestrator mentions 240s timeout', () => {
    expect(agentContent).toMatch(/240s?\s*timeout/i);
  });

  test('command mentions 240s timeout', () => {
    expect(commandContent).toMatch(/240s?\s*timeout/i);
  });
});

// ─── 5. Interactive Selection ───────────────────────────────────────
describe('interactive selection', () => {
  test('command has Proposer picker', () => {
    expect(commandContent).toMatch(/header:\s*"Proposer"/);
  });

  test('command has Challenger picker', () => {
    expect(commandContent).toMatch(/header:\s*"Challenger"/);
  });

  test('command has Effort picker', () => {
    expect(commandContent).toMatch(/header:\s*"Effort"/);
  });

  test('command has Rounds picker', () => {
    expect(commandContent).toMatch(/header:\s*"Rounds"/);
  });

  test('command has Context picker', () => {
    expect(commandContent).toMatch(/header:\s*"Context"/);
  });

  test('proposer picker shows tools with label+description format', () => {
    const toolOptions = [
      { label: 'Claude', desc: 'Deep code reasoning' },
      { label: 'Gemini', desc: 'Fast multimodal analysis' },
      { label: 'Codex', desc: 'Agentic coding' },
      { label: 'OpenCode', desc: 'Flexible model choice' },
      { label: 'Copilot', desc: 'GitHub-integrated AI' }
    ];

    for (const opt of toolOptions) {
      expect(commandContent).toContain(opt.label);
      expect(commandContent).toContain(opt.desc);
    }
  });

  test('effort picker shows levels with label+description format', () => {
    const effortOptions = [
      { label: 'High (Recommended)', desc: 'Thorough analysis for debate' },
      { label: 'Medium', desc: 'Balanced speed and quality' },
      { label: 'Low', desc: 'Fast, minimal reasoning' },
      { label: 'Max', desc: 'Maximum reasoning depth' }
    ];

    for (const opt of effortOptions) {
      expect(commandContent).toContain(opt.label);
      expect(commandContent).toContain(opt.desc);
    }
  });

  test('picker labels are under 30 chars (OpenCode compat)', () => {
    const labels = [
      'Claude', 'Gemini', 'Codex', 'OpenCode', 'Copilot',
      'High (Recommended)', 'Medium', 'Low', 'Max',
      '2 (Recommended)', '1 (Quick)', '3 (Extended)', '5 (Exhaustive)',
      'None (Recommended)', 'Diff', 'File'
    ];

    for (const label of labels) {
      expect(label.length).toBeLessThan(30);
    }
  });
});

// ─── 6. NLP Parsing ────────────────────────────────────────────────
describe('NLP parsing', () => {
  test('command documents "vs" extraction pattern', () => {
    expect(commandContent).toMatch(/\{tool\}\s*vs\s*\{tool\}/i);
  });

  test('command documents "and" extraction pattern', () => {
    expect(commandContent).toMatch(/\{tool\}\s*and\s*\{tool\}/i);
  });

  test('command documents "between...and" extraction pattern', () => {
    expect(commandContent).toMatch(/between\s*\{tool\}\s*and\s*\{tool\}/i);
  });

  test('command documents "with...and" extraction pattern', () => {
    expect(commandContent).toMatch(/with\s*\{tool\}\s*and\s*\{tool\}/i);
  });

  test('command documents rounds extraction', () => {
    expect(commandContent).toMatch(/\{N\}\s*rounds/i);
    expect(commandContent).toMatch(/single round|one round/i);
  });

  test('command documents effort extraction', () => {
    expect(commandContent).toMatch(/quick.*fast.*low/i);
    expect(commandContent).toMatch(/thorough.*deep.*high/i);
    expect(commandContent).toMatch(/maximum.*max/i);
  });

  test('command documents topic extraction via "about"', () => {
    expect(commandContent).toMatch(/Text after "about" is the topic/i);
  });
});

// ─── 7. State Management ───────────────────────────────────────────
describe('state management', () => {
  test('skill documents last-debate.json schema with required fields', () => {
    const requiredFields = [
      'id', 'topic', 'proposer', 'challenger', 'effort',
      'rounds_completed', 'status', 'exchanges', 'verdict', 'timestamp'
    ];

    for (const field of requiredFields) {
      expect(skillContent).toMatch(new RegExp(`"${field}"`));
    }
  });

  test('state file path uses AI_STATE_DIR', () => {
    expect(skillContent).toMatch(/AI_STATE_DIR/);
  });

  test('skill documents last-debate.json filename', () => {
    expect(skillContent).toContain('last-debate.json');
  });

  test('state schema includes exchange structure', () => {
    // Each exchange has round, role, tool, response, duration_ms
    expect(skillContent).toMatch(/"round"/);
    expect(skillContent).toMatch(/"role"/);
    expect(skillContent).toMatch(/"tool"/);
    expect(skillContent).toMatch(/"response"/);
    expect(skillContent).toMatch(/"duration_ms"/);
  });

  test('state schema includes verdict structure', () => {
    expect(skillContent).toMatch(/"winner"/);
    expect(skillContent).toMatch(/"reasoning"/);
    expect(skillContent).toMatch(/"agreements"/);
    expect(skillContent).toMatch(/"disagreements"/);
    expect(skillContent).toMatch(/"recommendation"/);
  });
});

// ─── 8. Error Handling Coverage ─────────────────────────────────────
describe('error handling coverage', () => {
  test('command error table has Error Handling section', () => {
    expect(commandContent).toMatch(/## Error Handling/);
  });

  test('command handles no topic provided', () => {
    expect(commandContent).toMatch(/No topic provided|no topic/i);
  });

  test('command handles tool not installed', () => {
    expect(commandContent).toMatch(/not installed/i);
  });

  test('command handles fewer than 2 tools', () => {
    expect(commandContent).toMatch(/Fewer than 2 tools|at least 2 AI CLI tools/i);
  });

  test('command handles same tool for both roles', () => {
    expect(commandContent).toMatch(/Same tool for both|Proposer and challenger must be different/i);
  });

  test('command handles rounds out of range', () => {
    expect(commandContent).toMatch(/Rounds out of range|Rounds must be 1-5/i);
  });

  test('command handles context file not found', () => {
    // Context picker has "File" option that requires path - validation is in consult skill
    // The command references context=file=PATH
    expect(commandContent).toMatch(/context.*file=PATH|--context=.*file/i);
  });

  test('command handles tool failure during debate', () => {
    expect(commandContent).toMatch(/Proposer fails round 1/i);
    expect(commandContent).toMatch(/Challenger fails round 1/i);
    expect(commandContent).toMatch(/Any tool fails mid-debate/i);
  });

  test('command handles tool invocation timeout', () => {
    expect(commandContent).toMatch(/Tool invocation timeout|timed out after 240s/i);
  });

  test('command documents all-rounds-timeout error', () => {
    expect(commandContent).toContain('[ERROR] Debate failed: all tool invocations timed out.');
  });

  test('skill documents all-rounds-timeout error', () => {
    expect(skillContent).toContain('[ERROR] Debate failed: all tool invocations timed out.');
  });
});

// ─── 9. Synthesis Format ────────────────────────────────────────────
describe('synthesis format', () => {
  test('skill has Debate Summary section', () => {
    expect(skillContent).toContain('## Debate Summary');
  });

  test('skill has Verdict section', () => {
    expect(skillContent).toContain('### Verdict');
  });

  test('skill has Debate Quality section with 3 dimensions', () => {
    expect(skillContent).toContain('### Debate Quality');
    expect(skillContent).toMatch(/Genuine disagreement/i);
    expect(skillContent).toMatch(/Evidence quality/i);
    expect(skillContent).toMatch(/Challenge depth/i);
  });

  test('skill has Key Agreements section', () => {
    expect(skillContent).toContain('### Key Agreements');
  });

  test('skill has Key Disagreements section', () => {
    expect(skillContent).toContain('### Key Disagreements');
  });

  test('skill has Unresolved Questions section', () => {
    expect(skillContent).toContain('### Unresolved Questions');
  });

  test('skill has Recommendation section', () => {
    expect(skillContent).toContain('### Recommendation');
  });

  test('verdict MUST pick a side', () => {
    expect(skillContent).toMatch(/MUST pick a side/i);
    expect(skillContent).toMatch(/Both approaches have merit.*NOT acceptable/i);
  });
});

// ─── 10. Cross-file Consistency ────────────────────────────────────
describe('cross-file consistency', () => {
  test('agent model is opus', () => {
    const fm = parseFrontmatter(agentContent);
    expect(fm.model).toBe('opus');
  });

  test('command allowed-tools includes Skill', () => {
    const fm = parseFrontmatter(commandContent);
    const tools = fm['allowed-tools'] || '';
    expect(tools).toContain('Skill');
  });

  test('command allowed-tools does not include Task (least-privilege)', () => {
    const fm = parseFrontmatter(commandContent);
    const tools = fm['allowed-tools'] || '';
    expect(tools).not.toContain('Task');
  });

  test('command allowed-tools includes AskUserQuestion', () => {
    const fm = parseFrontmatter(commandContent);
    const tools = fm['allowed-tools'] || '';
    expect(tools).toContain('AskUserQuestion');
  });

  test('skill version matches plugin.json version', () => {
    const fm = parseFrontmatter(skillContent);
    expect(fm.version).toBe(pluginJson.version);
  });

  test('orchestrator description describes programmatic entry point', () => {
    const fm = parseFrontmatter(agentContent);
    expect(fm.description).toMatch(/programmatic/i);
    expect(fm.description).toMatch(/Task\(\)/);
  });

  test('agent tools list includes all 5 provider CLI tools', () => {
    const fm = parseFrontmatter(agentContent);
    const toolsStr = Array.isArray(fm.tools) ? fm.tools.join(', ') : fm.tools;
    const providers = ['claude', 'gemini', 'codex', 'opencode', 'copilot'];

    for (const provider of providers) {
      expect(toolsStr).toMatch(new RegExp(`Bash\\(${provider}:\\*\\)`, 'i'));
    }
  });

  test('command and agent both reference debate skill', () => {
    // Command executes debate inline via Skill:debate and Skill:consult. Agent is the programmatic entry point for Task() callers.
    expect(commandContent).toMatch(/Skill:\s*debate/);
    expect(agentContent).toMatch(/Skill:\s*debate/);
  });
});

// ─── 11. Universal Evidence Standard ───────────────────────────────
describe('universal evidence standard', () => {
  test('skill has Universal Rules section', () => {
    expect(skillContent).toMatch(/## Universal Rules/);
  });

  test('universal rules require evidence from ALL participants', () => {
    const rulesSection = skillContent.match(
      /## Universal Rules[\s\S]*?(?=## |$)/
    );
    expect(rulesSection).not.toBeNull();

    const section = rulesSection[0];
    expect(section).toMatch(/ALL participants/i);
    expect(section).toMatch(/proposer AND challenger/i);
    expect(section).toMatch(/specific evidence/i);
  });

  test('universal rules specify evidence types', () => {
    const rulesSection = skillContent.match(
      /## Universal Rules[\s\S]*?(?=## |$)/
    );
    expect(rulesSection).not.toBeNull();

    const section = rulesSection[0];
    expect(section).toMatch(/file path/i);
    expect(section).toMatch(/code pattern/i);
    expect(section).toMatch(/benchmark/i);
    expect(section).toMatch(/documented behavior/i);
  });

  test('proposer template requires evidence', () => {
    const proposerSection = skillContent.match(
      /### Round 1: Proposer Opening[\s\S]*?```[\s\S]*?```/
    );
    expect(proposerSection).not.toBeNull();
    expect(proposerSection[0]).toMatch(/MUST support.*evidence/i);
  });

  test('challenger template requires evidence for agreements', () => {
    const challengerSection = skillContent.match(
      /### Round 1: Challenger Response[\s\S]*?```[\s\S]*?```/
    );
    expect(challengerSection).not.toBeNull();
    expect(challengerSection[0]).toMatch(/Do NOT agree.*unless.*evidence/i);
  });
});

// ─── 12. Anti-convergence ──────────────────────────────────────────
describe('anti-convergence mechanisms', () => {
  test('challenger response template contains anti-agreement clauses', () => {
    const challengerSection = skillContent.match(
      /### Round 1: Challenger Response[\s\S]*?```[\s\S]*?```/
    );
    expect(challengerSection).not.toBeNull();

    const template = challengerSection[0];
    // Must lead with critique, not validation
    expect(template).toMatch(/Do NOT say "great point"/i);
    expect(template).toMatch(/Lead with what's WRONG or MISSING/i);
    expect(template).toMatch(/MUST identify at least one genuine flaw/i);
  });

  test('challenger follow-up leads with suspicion', () => {
    const followupSection = skillContent.match(
      /### Round 2\+: Challenger Follow-up[\s\S]*?```[\s\S]*?```/
    );
    expect(followupSection).not.toBeNull();

    const template = followupSection[0];
    // Default to suspicion, not acceptance
    expect(template).toMatch(/Default to suspicion, not acceptance/i);
    expect(template).toMatch(/Do NOT let the proposer reframe.*as agreements/i);
  });

  test('challenger follow-up rejects unsupported agreement', () => {
    const followupSection = skillContent.match(
      /### Round 2\+: Challenger Follow-up[\s\S]*?```[\s\S]*?```/
    );
    expect(followupSection).not.toBeNull();

    const template = followupSection[0];
    expect(template).toMatch(/dodge|superficially address|without evidence/i);
    expect(template).toMatch(/"I agree now" without evidence is not/i);
  });

  test('opencode skill Challenger Follow-up template matches canonical', () => {
    const canonicalSection = skillContent.match(
      /### Round 2\+: Challenger Follow-up[\s\S]*?```[\s\S]*?```/
    );
    const adapterSection = openCodeSkillContent.match(
      /### Round 2\+: Challenger Follow-up[\s\S]*?```[\s\S]*?```/
    );
    expect(canonicalSection).not.toBeNull();
    expect(adapterSection).not.toBeNull();
    // Both should contain the key anti-convergence instruction
    expect(adapterSection[0]).toMatch(/"I agree now" without evidence is not/i);
  });

  test('opencode skill has complete Challenger Follow-up template', () => {
    // Must contain the full template, not the stub comment
    expect(openCodeSkillContent).toMatch(/Default to suspicion, not acceptance/i);
    expect(openCodeSkillContent).toMatch(/Do NOT let the proposer reframe.*as agreements/i);
    expect(openCodeSkillContent).not.toContain('*(JavaScript reference - not executable in OpenCode)*');
  });

  test('debate quality checks for genuine disagreement', () => {
    expect(skillContent).toMatch(/Genuine disagreement.*converge toward the proposer/i);
  });
});

// ─── 13. Adapter Consistency (task #233) ───────────────────────────
describe('adapter consistency', () => {
  test('codex adapter skill mentions 240s timeout', () => {
    expect(codexSkillContent).toMatch(/240s?\s*timeout/i);
  });

  test('codex adapter skill documents all-rounds-timeout error', () => {
    expect(codexSkillContent).toContain('[ERROR] Debate failed: all tool invocations timed out.');
  });

  test('opencode command mentions 240s timeout', () => {
    expect(openCodeCommandContent).toMatch(/240s?\s*timeout/i);
  });

  test('opencode command documents all-rounds-timeout error', () => {
    expect(openCodeCommandContent).toContain('[ERROR] Debate failed: all tool invocations timed out.');
  });

  test('opencode agent enforces 240s timeout inline at invocation steps', () => {
    expect(openCodeAgentContent).toMatch(/240.second timeout|Track invocation start time/i);
  });
});

// ─── 14. External Tool Quick Reference (#232) ────────────────────
describe('external tool quick reference (#232)', () => {
  // Use pre-loaded content (no redundant file reads)
  const allDebateSkillContents = () => [skillContent, openCodeSkillContent, codexSkillContent];

  test('all three debate skill copies contain the External Tool Quick Reference section', () => {
    for (const content of allDebateSkillContents()) {
      expect(content).toContain('## External Tool Quick Reference');
    }
  });

  test('all five providers mentioned in quick reference of each skill copy', () => {
    for (const content of allDebateSkillContents()) {
      expect(content).toMatch(/External Tool Quick Reference[\s\S]*claude/i);
      expect(content).toMatch(/External Tool Quick Reference[\s\S]*gemini/i);
      expect(content).toMatch(/External Tool Quick Reference[\s\S]*codex/i);
      expect(content).toMatch(/External Tool Quick Reference[\s\S]*opencode/i);
      expect(content).toMatch(/External Tool Quick Reference[\s\S]*copilot/i);
    }
  });

  test('effort-to-model mapping table present in each skill copy', () => {
    for (const content of allDebateSkillContents()) {
      expect(content).toContain('Effort-to-Model Mapping');
    }
  });

  test('output parsing table present in each skill copy', () => {
    for (const content of allDebateSkillContents()) {
      expect(content).toContain('Output Parsing');
    }
  });

  test('canonical source note present in each skill copy', () => {
    for (const content of allDebateSkillContents()) {
      expect(content).toMatch(/canonical source.*consult/i);
    }
  });

  test('current model names present in effort-to-model mapping of each skill copy', () => {
    const expectedModels = ['claude-haiku-4-5', 'claude-sonnet-4-6', 'claude-opus-4-6', 'o4-mini', 'o3', 'gemini-2.5-flash'];
    for (const content of allDebateSkillContents()) {
      for (const model of expectedModels) {
        expect(content).toMatch(new RegExp(`Effort-to-Model Mapping[\\s\\S]*${model}`));
      }
    }
  });
});

// ─── 15. Consult skill adapter sync (#232) ───────────────────────
describe('consult skill opencode adapter sync (#232)', () => {
  test('opencode consult adapter contains all 5 providers', () => {
    for (const provider of ['claude', 'gemini', 'codex', 'opencode', 'copilot']) {
      expect(openCodeConsultSkillContent.toLowerCase()).toContain(provider);
    }
  });

  test('opencode consult adapter has updated claude model names', () => {
    expect(openCodeConsultSkillContent).toContain('claude-haiku-4-5');
    expect(openCodeConsultSkillContent).toContain('claude-sonnet-4-6');
    expect(openCodeConsultSkillContent).toContain('claude-opus-4-6');
  });

  test('opencode consult adapter has updated codex model names (no speculative gpt-5.x)', () => {
    expect(openCodeConsultSkillContent).not.toContain('gpt-5.3-codex');
    expect(openCodeConsultSkillContent).not.toContain('gpt-5.2-codex');
    expect(openCodeConsultSkillContent).toContain('o4-mini');
    expect(openCodeConsultSkillContent).toContain('o3');
  });

  test('canonical consult skill has updated model names', () => {
    expect(consultSkillContent).toContain('claude-haiku-4-5');
    expect(consultSkillContent).toContain('claude-sonnet-4-6');
    expect(consultSkillContent).toContain('claude-opus-4-6');
    expect(consultSkillContent).not.toContain('gpt-5.3-codex');
    expect(consultSkillContent).toContain('o4-mini');
    expect(consultSkillContent).toContain('o3');
  });
});
