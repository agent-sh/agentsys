/**
 * Tests for /consult command - plugin structure, provider configs,
 * command/skill/agent alignment, security, and interactive selection.
 *
 * The consult plugin is entirely markdown-based (no JS code).
 * These tests validate the markdown content for correctness,
 * completeness, and cross-file consistency.
 */

const fs = require('fs');
const path = require('path');

const pluginsDir = path.join(__dirname, '..', 'plugins');
const consultDir = path.join(pluginsDir, 'consult');
const commandPath = path.join(consultDir, 'commands', 'consult.md');
const skillPath = path.join(consultDir, 'skills', 'consult', 'SKILL.md');
const agentPath = path.join(consultDir, 'agents', 'consult-agent.md');
const pluginJsonPath = path.join(consultDir, '.claude-plugin', 'plugin.json');

// Load all files once
let commandContent, skillContent, agentContent, pluginJson;

beforeAll(() => {
  commandContent = fs.readFileSync(commandPath, 'utf8');
  skillContent = fs.readFileSync(skillPath, 'utf8');
  agentContent = fs.readFileSync(agentPath, 'utf8');
  pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
});

// ─── Constants ──────────────────────────────────────────────────────
const PROVIDERS = ['claude', 'gemini', 'codex', 'opencode', 'copilot'];
const EFFORT_LEVELS = ['low', 'medium', 'high', 'max'];
const CONTINUABLE_PROVIDERS = ['claude', 'gemini', 'codex', 'opencode'];
const NON_CONTINUABLE_PROVIDERS = ['copilot'];

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
describe('consult plugin structure', () => {
  test('plugin.json exists and is valid JSON', () => {
    expect(fs.existsSync(pluginJsonPath)).toBe(true);
    expect(() => JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'))).not.toThrow();
  });

  test('plugin.json has required fields', () => {
    expect(pluginJson.name).toBe('consult');
    expect(pluginJson.version).toBeDefined();
    expect(pluginJson.description).toBeDefined();
  });

  test('has exactly 1 command', () => {
    const commandsDir = path.join(consultDir, 'commands');
    const commands = fs.readdirSync(commandsDir).filter(f => f.endsWith('.md'));
    expect(commands).toEqual(['consult.md']);
  });

  test('has exactly 1 agent', () => {
    const agentsDir = path.join(consultDir, 'agents');
    const agents = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
    expect(agents).toEqual(['consult-agent.md']);
  });

  test('has exactly 1 skill', () => {
    const skillsDir = path.join(consultDir, 'skills');
    const skills = fs.readdirSync(skillsDir).filter(f =>
      fs.statSync(path.join(skillsDir, f)).isDirectory()
    );
    expect(skills).toEqual(['consult']);
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

// ─── 2. Provider Configuration Consistency ──────────────────────────
describe('provider configuration consistency', () => {
  test('skill documents all 5 providers', () => {
    for (const provider of PROVIDERS) {
      // Each provider has a ### heading in the skill
      const heading = new RegExp(`### ${provider}`, 'i');
      expect(skillContent).toMatch(heading);
    }
  });

  test('every provider has a command template', () => {
    for (const provider of PROVIDERS) {
      expect(skillContent).toMatch(new RegExp(`Command:.*${provider}`, 'i'));
    }
  });

  describe('effort-to-model mappings', () => {
    // Claude, Gemini, Codex, OpenCode all have per-effort models
    test.each(['claude', 'gemini', 'codex', 'opencode'])(
      '%s has all 4 effort levels in model table',
      (provider) => {
        // Extract the section for this provider
        const providerRegex = new RegExp(
          `### ${provider}\\b[\\s\\S]*?(?=### |## |$)`,
          'i'
        );
        const section = skillContent.match(providerRegex);
        expect(section).not.toBeNull();

        const sectionText = section[0];
        for (const effort of EFFORT_LEVELS) {
          expect(sectionText).toMatch(new RegExp(`\\|\\s*${effort}\\s*\\|`));
        }
      }
    );

    test('copilot has no effort-specific model control', () => {
      const copilotSection = skillContent.match(
        /### Copilot[\s\S]*?(?=### |## |$)/i
      );
      expect(copilotSection).not.toBeNull();
      expect(copilotSection[0]).toMatch(/no effort control/i);
    });
  });

  test('continuable providers are claude, gemini, codex, and opencode', () => {
    for (const provider of CONTINUABLE_PROVIDERS) {
      const section = skillContent.match(
        new RegExp(`### ${provider}[\\s\\S]*?(?=### |## |$)`, 'i')
      );
      expect(section).not.toBeNull();
      expect(section[0]).toMatch(/continuable.*yes/i);
    }

    for (const provider of NON_CONTINUABLE_PROVIDERS) {
      const section = skillContent.match(
        new RegExp(`### ${provider}[\\s\\S]*?(?=### |## |$)`, 'i')
      );
      expect(section).not.toBeNull();
      expect(section[0]).toMatch(/continuable.*no/i);
    }
  });
});

// ─── 3. Command / Skill / Agent Alignment ───────────────────────────
describe('command/skill/agent alignment', () => {
  test('command references all 5 providers', () => {
    for (const provider of PROVIDERS) {
      expect(commandContent.toLowerCase()).toContain(provider);
    }
  });

  test('command tool picker lists all 5 providers', () => {
    expect(commandContent).toContain('"Claude"');
    expect(commandContent).toContain('"Gemini"');
    expect(commandContent).toContain('"Codex"');
    expect(commandContent).toContain('"OpenCode"');
    expect(commandContent).toContain('"Copilot"');
  });

  test('agent tools list includes all 5 provider CLI tools', () => {
    const fm = parseFrontmatter(agentContent);
    expect(fm).not.toBeNull();
    const toolsStr = Array.isArray(fm.tools) ? fm.tools.join(', ') : fm.tools;

    for (const provider of PROVIDERS) {
      // Tools are like Bash(claude:*), Bash(gemini:*), etc.
      expect(toolsStr).toMatch(new RegExp(`Bash\\(${provider}:\\*\\)`, 'i'));
    }
  });

  test('agent has Skill tool for invoking consult skill', () => {
    const fm = parseFrontmatter(agentContent);
    const toolsStr = Array.isArray(fm.tools) ? fm.tools.join(', ') : fm.tools;
    expect(toolsStr).toContain('Skill');
  });

  test('skill install instructions cover all 5 providers', () => {
    for (const provider of PROVIDERS) {
      // The install table has a row for each provider
      const providerCapitalized = provider.charAt(0).toUpperCase() + provider.slice(1);
      expect(skillContent).toMatch(
        new RegExp(`\\|\\s*${providerCapitalized}\\s*\\|.*\\|`, 'i')
      );
    }
  });

  test('command invokes skill via Skill tool in Phase 3', () => {
    expect(commandContent).toMatch(/Skill:\s*consult/);
    expect(commandContent).toMatch(/--tool=\[tool\]/);
    expect(commandContent).toMatch(/--effort=\[effort\]/);
  });

  test('agent invokes skill via Skill tool', () => {
    expect(agentContent).toMatch(/invoke.*consult.*skill/i);
    expect(agentContent).toMatch(/Skill:\s*consult/);
  });
});

// ─── 4. Security Constraints ────────────────────────────────────────
describe('security constraints', () => {
  function getAllContent() {
    return [
      { name: 'command', content: commandContent },
      { name: 'skill', content: skillContent },
      { name: 'agent', content: agentContent }
    ];
  }

  test('command has NEVER-expose-API-keys constraint', () => {
    expect(commandContent).toMatch(/NEVER.*expose.*API.*key/i);
  });

  test('command has NEVER-permission-bypassing constraint', () => {
    expect(commandContent).toMatch(
      /NEVER.*permission-bypassing|NEVER.*dangerously-skip-permissions/i
    );
  });

  test('command mentions 120s timeout', () => {
    expect(commandContent).toMatch(/120s?\s*timeout/i);
  });

  test('skill mentions shell escaping requirements', () => {
    expect(skillContent).toMatch(/shell.*escap/i);
  });

  test('agent has safe-mode constraint', () => {
    expect(agentContent).toMatch(/safe-mode/i);
  });

  test('no file contains --dangerously-skip-permissions as a usable flag', () => {
    for (const { name, content } of getAllContent()) {
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.includes('--dangerously-skip-permissions') && !line.match(/NEVER|never|not|don't/i)) {
          if (line.trim().match(/^(Command:|Skill:|Args:|Bash:|```)/)) {
            throw new Error(
              `Found --dangerously-skip-permissions in ${name} command template: ${line.trim()}`
            );
          }
        }
      }
    }
  });

  test('command validates --tool against allow-list', () => {
    expect(commandContent).toMatch(/validate.*tool.*against.*allow-list|allow-list.*gemini.*codex.*claude|one of.*gemini.*codex.*claude/i);
  });

  test('skill validates --context=file=PATH is within project', () => {
    expect(skillContent).toMatch(/within.*project.*directory|reject.*absolute.*paths/i);
  });

  test('skill blocks UNC paths for file context', () => {
    expect(skillContent).toMatch(/UNC path/i);
    expect(skillContent).toMatch(/\\\\|\/\//);
  });

  test('skill requires canonical path resolution for file context', () => {
    expect(skillContent).toMatch(/canonical path/i);
    expect(skillContent).toMatch(/symlink/i);
  });

  test('skill warns shell escaping is insufficient', () => {
    expect(skillContent).toMatch(/shell escaping is insufficient/i);
  });

  test('skill requires temp file approach for question text', () => {
    expect(skillContent).toMatch(/temp.*file|question\.tmp/i);
    expect(skillContent).toMatch(/MUST NOT.*interpolat/i);
  });

  test('skill provider commands use stdin or temp file', () => {
    // All providers should use < redirect or $(cat) from temp file
    expect(skillContent).toMatch(/< "\{AI_STATE_DIR\}\/consult\/question\.tmp"/);
  });

  test('skill requires temp file cleanup', () => {
    expect(skillContent).toMatch(/delete the temp file/i);
  });

  test('agent references skill as canonical redaction source', () => {
    expect(agentContent).toMatch(/Output Sanitization/);
    // Agent should reference the skill, not maintain its own table
    expect(agentContent).toMatch(/consult skill|SKILL\.md/i);
  });

  test('skill has full redaction pattern table (canonical source)', () => {
    // Skill is the single source of truth for redaction patterns
    expect(skillContent).toMatch(/Output Sanitization/);
    expect(skillContent).toMatch(/sk-\[a-zA-Z0-9/);
    expect(skillContent).toMatch(/AIza\[a-zA-Z0-9/);
    expect(skillContent).toMatch(/ghp_/);
    expect(skillContent).toMatch(/Bearer/);
    expect(skillContent).toMatch(/AKIA/);
    expect(skillContent).toMatch(/REDACTED/);
  });
});

// ─── 5. Interactive Selection Completeness ──────────────────────────
describe('interactive selection completeness', () => {
  test('command Phase 2b has AskUserQuestion for tool selection', () => {
    expect(commandContent).toMatch(/AskUserQuestion[\s\S]*?header:\s*"AI Tool"/);
  });

  test('command Phase 2c has AskUserQuestion for effort selection', () => {
    expect(commandContent).toMatch(/AskUserQuestion[\s\S]*?header:\s*"Effort"/);
  });

  test('Phase 2 has MUST enforcement language for parameters', () => {
    // Check that the command enforces interactive resolution for missing params
    expect(commandContent).toMatch(/Do NOT silently default any parameter|Do NOT silently use a default model/);
    expect(commandContent).toMatch(/Do NOT skip model selection|Do NOT skip this/i);
    expect(commandContent).toMatch(/MUST resolve ALL missing parameters/);
  });

  test('Phase 2 header has MUST language for all missing parameters', () => {
    expect(commandContent).toMatch(
      /MUST resolve ALL missing parameters interactively/
    );
    expect(commandContent).toMatch(
      /Do NOT silently default any parameter/
    );
  });

  test('tool picker shows all 5 providers with descriptions', () => {
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

  test('effort picker shows all 4 levels with descriptions', () => {
    const effortOptions = [
      { label: 'Medium (Recommended)', desc: 'Balanced speed and quality' },
      { label: 'Low', desc: 'Fast, minimal reasoning' },
      { label: 'High', desc: 'Thorough analysis' },
      { label: 'Max', desc: 'Maximum reasoning depth' }
    ];

    for (const opt of effortOptions) {
      expect(commandContent).toContain(opt.label);
      expect(commandContent).toContain(opt.desc);
    }
  });

  test('effort picker labels are under 30 chars (OpenCode compat)', () => {
    const labels = [
      'Medium (Recommended)',
      'Low',
      'High',
      'Max'
    ];

    for (const label of labels) {
      expect(label.length).toBeLessThan(30);
    }
  });

  test('tool picker labels are under 30 chars (OpenCode compat)', () => {
    const labels = ['Claude', 'Gemini', 'Codex', 'OpenCode', 'Copilot'];

    for (const label of labels) {
      expect(label.length).toBeLessThan(30);
    }
  });
});

// ─── 6. Session Management ──────────────────────────────────────────
describe('session management', () => {
  test('skill defines session JSON schema fields', () => {
    const requiredFields = ['tool', 'model', 'effort', 'session_id', 'timestamp', 'question', 'continuable'];

    for (const field of requiredFields) {
      expect(skillContent).toMatch(new RegExp(`"${field}"`));
    }
  });

  test('command handles --continue flag', () => {
    expect(commandContent).toMatch(/--continue/);
    expect(commandContent).toMatch(/Step 2a.*Handle --continue/i);
  });

  test('session file path uses AI_STATE_DIR', () => {
    expect(skillContent).toMatch(/AI_STATE_DIR/);
    expect(commandContent).toMatch(/AI_STATE_DIR/);
  });

  test('skill mentions session resume for all continuable providers', () => {
    // Claude section
    const claudeSection = skillContent.match(/### Claude[\s\S]*?(?=### |## |$)/i);
    expect(claudeSection[0]).toMatch(/--resume/i);

    // Gemini section
    const geminiSection = skillContent.match(/### Gemini[\s\S]*?(?=### |## |$)/i);
    expect(geminiSection[0]).toMatch(/--resume/i);

    // Codex section
    const codexSection = skillContent.match(/### Codex[\s\S]*?(?=### |## |$)/i);
    expect(codexSection[0]).toMatch(/session resume|codex resume/i);

    // OpenCode section
    const opencodeSection = skillContent.match(/### OpenCode[\s\S]*?(?=### |## |$)/i);
    expect(opencodeSection[0]).toMatch(/session resume|--continue|--session/i);
  });
});

// ─── 7. Output Format ──────────────────────────────────────────────
describe('output format', () => {
  test('skill uses plain JSON output (no markers)', () => {
    expect(skillContent).toContain('plain JSON');
    expect(skillContent).not.toContain('=== CONSULT_RESULT ===');
    expect(skillContent).not.toContain('=== END_RESULT ===');
  });

  test('agent uses plain JSON and human-friendly format (no markers)', () => {
    expect(agentContent).not.toContain('=== CONSULT_RESULT ===');
    expect(agentContent).not.toContain('=== END_RESULT ===');
  });

  test('command uses plain JSON and human-friendly format (no markers)', () => {
    expect(commandContent).toContain('plain JSON');
    expect(commandContent).not.toContain('=== CONSULT_RESULT ===');
    expect(commandContent).not.toContain('=== END_RESULT ===');
  });

  test('result JSON has required fields in skill example', () => {
    const requiredFields = ['tool', 'model', 'effort', 'duration_ms', 'response', 'session_id', 'continuable'];

    // The skill has a JSON example in the Output Format section
    const outputSection = skillContent.match(
      /## Output Format[\s\S]*?(?=## |$)/
    );
    expect(outputSection).not.toBeNull();

    for (const field of requiredFields) {
      expect(outputSection[0]).toContain(`"${field}"`);
    }
  });

  test('command Phase 5 displays human-friendly format', () => {
    expect(commandContent).toMatch(/Tool: \{tool\}, Model: \{model\}/);
    expect(commandContent).toMatch(/The results of the consultation are:/);
  });

  test('agent step 4 displays human-friendly format', () => {
    expect(agentContent).toMatch(/Tool: \{tool\}, Model: \{model\}/);
    expect(agentContent).toMatch(/The results of the consultation are:/);
  });
});

// ─── 8. Error Handling Coverage ─────────────────────────────────────
describe('error handling coverage', () => {
  test('command error table covers all scenarios', () => {
    // Command should have error handling section with table
    expect(commandContent).toMatch(/## Error Handling/);

    expect(commandContent).toMatch(/No question provided|no question/i);
    expect(commandContent).toMatch(/not installed/i);
    expect(commandContent).toMatch(/execution fail|failed/i);
    expect(commandContent).toMatch(/timeout|timed out/i);
    expect(commandContent).toMatch(/No.*tools.*available|No AI CLI tools/i);
    expect(commandContent).toMatch(/session not found|No previous session/i);
    expect(commandContent).toMatch(/API key/i);
  });

  test('skill error table covers all scenarios', () => {
    expect(skillContent).toMatch(/## Error Handling/);

    expect(skillContent).toMatch(/not installed/i);
    expect(skillContent).toMatch(/timeout/i);
    expect(skillContent).toMatch(/JSON parse error/i);
    expect(skillContent).toMatch(/empty output/i);
    expect(skillContent).toMatch(/session.*missing/i);
    expect(skillContent).toMatch(/API key/i);
  });

  test('agent error table covers key scenarios', () => {
    expect(agentContent).toMatch(/## Error Handling/);

    expect(agentContent).toMatch(/not installed/i);
    expect(agentContent).toMatch(/timeout/i);
    expect(agentContent).toMatch(/JSON parse/i);
    expect(agentContent).toMatch(/session.*missing/i);
    expect(agentContent).toMatch(/empty response/i);
  });

  test('timeout error suggests --effort=low', () => {
    expect(commandContent).toMatch(/timeout.*--effort=low/i);
  });
});

// ─── 9. Codex AskUserQuestion Transform Compatibility ───────────────
describe('codex AskUserQuestion transform compatibility', () => {
  test('command has codex-description in frontmatter', () => {
    const fm = parseFrontmatter(commandContent);
    expect(fm['codex-description']).toBeDefined();
  });

  test('tool selection options have label+description format', () => {
    // The picker should have structured options, not just plain text
    // Check that each tool option line has both label and description
    const toolPickerSection = commandContent.match(
      /Step 2c[\s\S]*?Step 2d/
    );
    expect(toolPickerSection).not.toBeNull();

    const section = toolPickerSection[0];
    expect(section).toMatch(/label:.*"Claude".*description:/);
    expect(section).toMatch(/label:.*"Gemini".*description:/);
    expect(section).toMatch(/label:.*"Codex".*description:/);
    expect(section).toMatch(/label:.*"OpenCode".*description:/);
    expect(section).toMatch(/label:.*"Copilot".*description:/);
  });

  test('effort selection options have label+description format', () => {
    // Effort picker is in Step 2c (batch selection), model picker in Step 2d
    const effortPickerSection = commandContent.match(
      /Step 2c[\s\S]*?Step 2d/
    );
    expect(effortPickerSection).not.toBeNull();

    const section = effortPickerSection[0];
    expect(section).toMatch(/label:.*"Medium.*".*description:/);
    expect(section).toMatch(/label:.*"Low".*description:/);
    expect(section).toMatch(/label:.*"High".*description:/);
    expect(section).toMatch(/label:.*"Max".*description:/);
  });
});

// ─── 10. Cross-file Consistency Checks ──────────────────────────────
describe('cross-file consistency', () => {
  test('command allowed-tools includes AskUserQuestion', () => {
    const fm = parseFrontmatter(commandContent);
    const tools = fm['allowed-tools'] || '';
    expect(tools).toContain('AskUserQuestion');
  });

  test('command allowed-tools includes Skill', () => {
    const fm = parseFrontmatter(commandContent);
    const tools = fm['allowed-tools'] || '';
    expect(tools).toContain('Skill');
  });

  test('command allowed-tools includes detection commands', () => {
    const fm = parseFrontmatter(commandContent);
    const tools = fm['allowed-tools'] || '';
    expect(tools).toMatch(/where\.exe/);
    expect(tools).toMatch(/which/);
  });

  test('agent model is sonnet (orchestration only)', () => {
    const fm = parseFrontmatter(agentContent);
    expect(fm.model).toBe('sonnet');
  });

  test('skill version matches plugin.json version', () => {
    const fm = parseFrontmatter(skillContent);
    // Skill frontmatter version should match plugin.json version
    expect(fm.version).toBe(pluginJson.version);
  });
});
