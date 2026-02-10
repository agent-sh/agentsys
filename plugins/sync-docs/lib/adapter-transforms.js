/**
 * Adapter Transform Functions
 *
 * Shared transforms for converting Claude Code plugin content into
 * OpenCode and Codex adapter formats. Used by:
 *   - bin/cli.js (npm installer)
 *   - scripts/dev-install.js (development installer)
 *   - scripts/gen-adapters.js (static adapter generation)
 *
 * @module adapter-transforms
 * @author Avi Fenesh
 * @license MIT
 */

const discovery = require('./discovery');

function transformBodyForOpenCode(content, repoRoot) {
  content = content.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, '${PLUGIN_ROOT}');
  content = content.replace(/\$CLAUDE_PLUGIN_ROOT/g, '$PLUGIN_ROOT');

  content = content.replace(/\.claude\//g, '.opencode/');
  content = content.replace(/\.claude'/g, ".opencode'");
  content = content.replace(/\.claude"/g, '.opencode"');
  content = content.replace(/\.claude`/g, '.opencode`');

  const plugins = discovery.discoverPlugins(repoRoot);
  if (plugins.length > 0) {
    const pluginNames = plugins.join('|');
    content = content.replace(new RegExp('`(' + pluginNames + '):([a-z-]+)`', 'g'), '`$2`');
    content = content.replace(new RegExp('(' + pluginNames + '):([a-z-]+)', 'g'), '$2');
  }

  content = content.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (match, lang, code) => {
      const langLower = (lang || '').toLowerCase();

      if (langLower === 'bash' || langLower === 'shell' || langLower === 'sh') {
        if (code.includes('node -e') && code.includes('require(')) {
          return '*(Bash command with Node.js require - adapt for OpenCode)*';
        }
        return match;
      }

      if (!lang && (code.trim().startsWith('gh ') || code.trim().startsWith('glab ') ||
          code.trim().startsWith('git ') || code.trim().startsWith('#!'))) {
        return match;
      }

      if (code.includes('require(') || code.includes('Task(') ||
          code.includes('const ') || code.includes('let ') ||
          code.includes('function ') || code.includes('=>') ||
          code.includes('async ') || code.includes('await ')) {

        let instructions = '';

        const taskMatches = [...code.matchAll(/(?:await\s+)?Task\s*\(\s*\{[^}]*subagent_type:\s*["'](?:[^"':]+:)?([^"']+)["'][^}]*\}\s*\)/gs)];
        for (const taskMatch of taskMatches) {
          const agent = taskMatch[1];
          instructions += `- Invoke \`@${agent}\` agent\n`;
        }

        const phaseMatches = code.match(/startPhase\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
        if (phaseMatches) {
          for (const pm of phaseMatches) {
            const phase = pm.match(/['"]([^'"]+)['"]/)[1];
            instructions += `- Phase: ${phase}\n`;
          }
        }

        if (code.includes('AskUserQuestion')) {
          instructions += '- Use AskUserQuestion tool for user input\n';
        }

        if (code.includes('EnterPlanMode')) {
          instructions += '- Use EnterPlanMode for user approval\n';
        }

        if (instructions) {
          return instructions;
        }

        return '*(JavaScript reference - not executable in OpenCode)*';
      }

      return match;
    }
  );

  content = content.replace(/\*\(Reference - adapt for OpenCode\)\*/g, '');

  content = content.replace(/await\s+Task\s*\(\s*\{[\s\S]*?\}\s*\);?/g, (match) => {
    const agentMatch = match.match(/subagent_type:\s*["'](?:[^"':]+:)?([^"']+)["']/);
    if (agentMatch) {
      return `Invoke \`@${agentMatch[1]}\` agent`;
    }
    return '*(Task call - use @agent-name syntax)*';
  });

  content = content.replace(/(?:const|let|var)\s+\{?[^}=\n]+\}?\s*=\s*require\s*\([^)]+\);?/g, '');
  content = content.replace(/require\s*\(['"][^'"]+['"]\)/g, '');

  if (content.includes('agent')) {
    const note = `
> **OpenCode Note**: Invoke agents using \`@agent-name\` syntax.
> Available agents: task-discoverer, exploration-agent, planning-agent,
> implementation-agent, deslop-agent, delivery-validator, sync-docs-agent
> Example: \`@exploration-agent analyze the codebase\`

`;
    content = content.replace(/^(---\n[\s\S]*?---\n)/, `$1${note}`);
  }

  if (content.includes('Master Workflow Orchestrator') && content.includes('No Shortcuts Policy')) {
    const policySection = `
## Phase 1: Policy Selection (Built-in Options)

Ask the user these questions using AskUserQuestion:

**Question 1 - Source**: "Where should I look for tasks?"
- GitHub Issues - Use \`gh issue list\` to find issues
- GitLab Issues - Use \`glab issue list\` to find issues
- Local tasks.md - Read from PLAN.md, tasks.md, or TODO.md in the repo
- Custom - User specifies their own source
- Other - User describes source, you figure it out

**Question 2 - Priority**: "What type of tasks to prioritize?"
- All - Consider all tasks, pick by score
- Bugs - Focus on bug fixes
- Security - Security issues first
- Features - New feature development

**Question 3 - Stop Point**: "How far should I take this task?"
- Merged - Until PR is merged to main
- PR Created - Stop after creating PR
- Implemented - Stop after local implementation
- Deployed - Deploy to staging
- Production - Full production deployment

After user answers, proceed to Phase 2 with the selected policy.

`;
    if (content.includes('OpenCode Note')) {
      content = content.replace(/(Example:.*analyze the codebase\`\n\n)/, `$1${policySection}`);
    }
  }

  return content;
}

function transformCommandFrontmatterForOpenCode(content) {
  return content.replace(
    /^---\n([\s\S]*?)^---/m,
    (match, frontmatter) => {
      // Parse existing frontmatter
      const lines = frontmatter.trim().split('\n');
      const parsed = {};
      for (const line of lines) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const key = line.substring(0, colonIdx).trim();
          const value = line.substring(colonIdx + 1).trim();
          parsed[key] = value;
        }
      }

      // Build OpenCode command frontmatter
      let opencodeFrontmatter = '---\n';
      if (parsed.description) opencodeFrontmatter += `description: ${parsed.description}\n`;
      opencodeFrontmatter += 'agent: general\n';
      // Don't include argument-hint or allowed-tools (not supported)
      opencodeFrontmatter += '---';
      return opencodeFrontmatter;
    }
  );
}

function transformAgentFrontmatterForOpenCode(content, options) {
  const { stripModels = true } = options || {};

  return content.replace(
    /^---\n([\s\S]*?)^---/m,
    (match, frontmatter) => {
      // Parse existing frontmatter
      const lines = frontmatter.trim().split('\n');
      const parsed = {};
      for (const line of lines) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const key = line.substring(0, colonIdx).trim();
          const value = line.substring(colonIdx + 1).trim();
          parsed[key] = value;
        }
      }

      // Build OpenCode frontmatter
      let opencodeFrontmatter = '---\n';
      if (parsed.name) opencodeFrontmatter += `name: ${parsed.name}\n`;
      if (parsed.description) opencodeFrontmatter += `description: ${parsed.description}\n`;
      opencodeFrontmatter += 'mode: subagent\n';

      // Map model names - only include if NOT stripping
      if (parsed.model && !stripModels) {
        const modelMap = {
          'sonnet': 'anthropic/claude-sonnet-4',
          'opus': 'anthropic/claude-opus-4',
          'haiku': 'anthropic/claude-haiku-3-5'
        };
        opencodeFrontmatter += `model: ${modelMap[parsed.model] || parsed.model}\n`;
      }

      // Convert tools to permissions
      if (parsed.tools) {
        opencodeFrontmatter += 'permission:\n';
        const tools = parsed.tools.toLowerCase();
        opencodeFrontmatter += `  read: ${tools.includes('read') ? 'allow' : 'deny'}\n`;
        opencodeFrontmatter += `  edit: ${tools.includes('edit') || tools.includes('write') ? 'allow' : 'deny'}\n`;
        opencodeFrontmatter += `  bash: ${tools.includes('bash') ? 'allow' : 'ask'}\n`;
        opencodeFrontmatter += `  glob: ${tools.includes('glob') ? 'allow' : 'deny'}\n`;
        opencodeFrontmatter += `  grep: ${tools.includes('grep') ? 'allow' : 'deny'}\n`;
      }

      opencodeFrontmatter += '---';
      return opencodeFrontmatter;
    }
  );
}

function transformSkillBodyForOpenCode(content, repoRoot) {
  return transformBodyForOpenCode(content, repoRoot);
}

function transformForCodex(content, options) {
  const { skillName, description, pluginInstallPath } = options;

  // Escape description for YAML: wrap in double quotes, escape backslashes and internal quotes
  const escapedDescription = description.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const yamlDescription = `"${escapedDescription}"`;

  if (content.startsWith('---')) {
    // Replace existing frontmatter with Codex-compatible format
    content = content.replace(
      /^---\n[\s\S]*?\n---\n/,
      `---\nname: ${skillName}\ndescription: ${yamlDescription}\n---\n`
    );
  } else {
    // Add new frontmatter
    content = `---\nname: ${skillName}\ndescription: ${yamlDescription}\n---\n\n${content}`;
  }

  // Transform PLUGIN_ROOT to actual installed path (or placeholder) for Codex
  content = content.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, pluginInstallPath);
  content = content.replace(/\$CLAUDE_PLUGIN_ROOT/g, pluginInstallPath);
  content = content.replace(/\$\{PLUGIN_ROOT\}/g, pluginInstallPath);
  content = content.replace(/\$PLUGIN_ROOT/g, pluginInstallPath);

  return content;
}

module.exports = {
  transformBodyForOpenCode,
  transformCommandFrontmatterForOpenCode,
  transformAgentFrontmatterForOpenCode,
  transformSkillBodyForOpenCode,
  transformForCodex
};
