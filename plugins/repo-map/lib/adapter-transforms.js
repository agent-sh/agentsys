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

// ---------------------------------------------------------------------------
// OpenCode body transform
// ---------------------------------------------------------------------------

/**
 * Transform markdown body content for OpenCode compatibility.
 *
 * Applies the following transforms (in order):
 *   1. CLAUDE_PLUGIN_ROOT -> PLUGIN_ROOT variable substitution
 *   2. .claude/ -> .opencode/ state directory references
 *   3. Strip plugin prefixes from agent references (next-task:agent -> agent)
 *   4. Convert JS code blocks to instructions or reference markers
 *   5. Remove standalone Task() calls (convert to @agent syntax)
 *   6. Remove stale require() statements
 *   7. Inject OpenCode agent note for agent-heavy content
 *   8. Embed next-task policy options (for next-task command only)
 *
 * @param {string} content - Markdown content to transform
 * @param {string} repoRoot - Repository root for plugin discovery
 * @returns {string} Transformed content
 */
function transformBodyForOpenCode(content, repoRoot) {
  // 1. Transform plugin root variable
  content = content.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, '${PLUGIN_ROOT}');
  content = content.replace(/\$CLAUDE_PLUGIN_ROOT/g, '$PLUGIN_ROOT');

  // 2. Transform state directory references (.claude -> .opencode)
  content = content.replace(/\.claude\//g, '.opencode/');
  content = content.replace(/\.claude'/g, ".opencode'");
  content = content.replace(/\.claude"/g, '.opencode"');
  content = content.replace(/\.claude`/g, '.opencode`');

  // 3. Strip plugin prefix from agent references (next-task:agent-name -> agent-name)
  //    Critical - OpenCode agents are installed without the plugin prefix
  const pluginNames = discovery.discoverPlugins(repoRoot).join('|');
  content = content.replace(new RegExp('`(' + pluginNames + '):([a-z-]+)`', 'g'), '`$2`');
  content = content.replace(new RegExp('(' + pluginNames + '):([a-z-]+)', 'g'), '$2');

  // 4. Transform ALL code blocks (with OR without language identifier)
  //    Pattern matches: ```javascript, ```js, ```bash, or just ``` (unmarked)
  content = content.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (match, lang, code) => {
      const langLower = (lang || '').toLowerCase();

      // Keep bash/shell commands as-is (but remove node -e with require)
      if (langLower === 'bash' || langLower === 'shell' || langLower === 'sh') {
        // Remove node -e commands that contain require (these won't work)
        if (code.includes('node -e') && code.includes('require(')) {
          return '*(Bash command with Node.js require - adapt for OpenCode)*';
        }
        return match;
      }

      // If it's explicitly marked as bash via content, keep it
      if (!lang && (code.trim().startsWith('gh ') || code.trim().startsWith('glab ') ||
          code.trim().startsWith('git ') || code.trim().startsWith('#!'))) {
        return match;
      }

      // If it contains JS patterns, transform it
      if (code.includes('require(') || code.includes('Task(') ||
          code.includes('const ') || code.includes('let ') ||
          code.includes('function ') || code.includes('=>') ||
          code.includes('async ') || code.includes('await ')) {

        // Extract key actions from the code
        let instructions = '';

        // Extract Task calls and convert to @ mentions
        const taskMatches = [...code.matchAll(/(?:await\s+)?Task\s*\(\s*\{[^}]*subagent_type:\s*["'](?:[^"':]+:)?([^"']+)["'][^}]*\}\s*\)/gs)];
        for (const taskMatch of taskMatches) {
          const agent = taskMatch[1];
          instructions += `- Invoke \`@${agent}\` agent\n`;
        }

        // Extract workflowState.startPhase
        const phaseMatches = code.match(/startPhase\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
        if (phaseMatches) {
          for (const pm of phaseMatches) {
            const phase = pm.match(/['"]([^'"]+)['"]/)[1];
            instructions += `- Phase: ${phase}\n`;
          }
        }

        // Extract AskUserQuestion
        if (code.includes('AskUserQuestion')) {
          instructions += '- Use AskUserQuestion tool for user input\n';
        }

        // Extract EnterPlanMode
        if (code.includes('EnterPlanMode')) {
          instructions += '- Use EnterPlanMode for user approval\n';
        }

        // If we extracted something useful, return instructions
        if (instructions) {
          return instructions;
        }

        // Otherwise mark as reference only
        return '*(JavaScript reference - not executable in OpenCode)*';
      }

      return match;
    }
  );

  // Remove the "*(Reference - adapt for OpenCode)*" markers since we've transformed the code
  content = content.replace(/\*\(Reference - adapt for OpenCode\)\*/g, '');

  // 5. Remove any remaining standalone Task() calls outside code blocks
  content = content.replace(/await\s+Task\s*\(\s*\{[\s\S]*?\}\s*\);?/g, (match) => {
    const agentMatch = match.match(/subagent_type:\s*["'](?:[^"':]+:)?([^"']+)["']/);
    if (agentMatch) {
      return `Invoke \`@${agentMatch[1]}\` agent`;
    }
    return '*(Task call - use @agent-name syntax)*';
  });

  // 6. Remove any remaining require() statements
  content = content.replace(/(?:const|let|var)\s+\{?[^}=\n]+\}?\s*=\s*require\s*\([^)]+\);?/g, '');
  content = content.replace(/require\s*\(['"][^'"]+['"]\)/g, '');

  // 7. Add OpenCode-specific note at the top if it's a complex command
  if (content.includes('agent')) {
    const note = `
> **OpenCode Note**: Invoke agents using \`@agent-name\` syntax.
> Available agents: task-discoverer, exploration-agent, planning-agent,
> implementation-agent, deslop-agent, delivery-validator, sync-docs-agent
> Example: \`@exploration-agent analyze the codebase\`

`;
    // Insert after frontmatter
    content = content.replace(/^(---\n[\s\S]*?---\n)/, `$1${note}`);
  }

  // 8. Embed policy options directly for OpenCode (can't require() external files)
  //    Only add to next-task command (check for unique next-task markers)
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
    // Add after the OpenCode note if present, or after frontmatter
    if (content.includes('OpenCode Note')) {
      content = content.replace(/(Example:.*analyze the codebase\`\n\n)/, `$1${policySection}`);
    }
  }

  return content;
}

// ---------------------------------------------------------------------------
// OpenCode command frontmatter transform
// ---------------------------------------------------------------------------

/**
 * Transform command frontmatter from Claude format to OpenCode format.
 *
 * Keeps: description
 * Adds: agent: general
 * Strips: argument-hint, allowed-tools, codex-description
 *
 * @param {string} content - Full markdown content with frontmatter
 * @returns {string} Content with transformed frontmatter
 */
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

// ---------------------------------------------------------------------------
// OpenCode agent frontmatter transform
// ---------------------------------------------------------------------------

/**
 * Transform agent frontmatter from Claude format to OpenCode format.
 *
 * Keeps: name, description
 * Adds: mode: subagent
 * Maps: tools -> permission block
 * Optionally strips: model (controlled by stripModels option)
 *
 * @param {string} content - Full markdown content with frontmatter
 * @param {Object} [options]
 * @param {boolean} [options.stripModels=true] - Whether to strip model specifications
 * @returns {string} Content with transformed frontmatter
 */
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

// ---------------------------------------------------------------------------
// OpenCode skill body transform
// ---------------------------------------------------------------------------

/**
 * Transform skill body content for OpenCode.
 * Delegates to the main body transform.
 *
 * @param {string} content - Skill markdown content
 * @param {string} repoRoot - Repository root for plugin discovery
 * @returns {string} Transformed content
 */
function transformSkillBodyForOpenCode(content, repoRoot) {
  return transformBodyForOpenCode(content, repoRoot);
}

// ---------------------------------------------------------------------------
// Codex transform
// ---------------------------------------------------------------------------

/**
 * Transform content for Codex CLI format.
 *
 * Replaces frontmatter with name/description, substitutes PLUGIN_ROOT
 * with the provided plugin install path.
 *
 * @param {string} content - Source command markdown content
 * @param {Object} options
 * @param {string} options.skillName - Codex skill name
 * @param {string} options.description - Skill description
 * @param {string} options.pluginInstallPath - Absolute path to installed plugin, or placeholder
 * @returns {string} Transformed content for Codex
 */
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
