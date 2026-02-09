#!/usr/bin/env node
/**
 * awesome-slash CLI installer
 *
 * Install:  npm install -g awesome-slash@latest
 * Run:      awesome-slash
 * Update:   npm update -g awesome-slash
 * Remove:   npm uninstall -g awesome-slash && awesome-slash --remove
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const VERSION = require('../package.json').version;
// Use the installed npm package directory as source (no git clone needed)
const PACKAGE_DIR = path.join(__dirname, '..');
const discovery = require('../lib/discovery');

// Valid tool names
const VALID_TOOLS = ['claude', 'opencode', 'codex'];

function getInstallDir() {
  const home = process.env.HOME || process.env.USERPROFILE;
  return path.join(home, '.awesome-slash');
}

function getClaudePluginsDir() {
  const home = process.env.HOME || process.env.USERPROFILE;
  return path.join(home, '.claude', 'plugins');
}

function getOpenCodeConfigDir() {
  const home = process.env.HOME || process.env.USERPROFILE;
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome && xdgConfigHome.trim()) {
    return path.join(xdgConfigHome, 'opencode');
  }
  return path.join(home, '.config', 'opencode');
}

function getConfigPath(platform) {
  if (platform === 'opencode') {
    return path.join(getOpenCodeConfigDir(), 'opencode.json');
  }
  if (platform === 'codex') {
    const home = process.env.HOME || process.env.USERPROFILE;
    return path.join(home, '.codex', 'config.toml');
  }
  return null;
}

function commandExists(cmd) {
  try {
    execSync(`${process.platform === 'win32' ? 'where' : 'which'} ${cmd}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Recursively copy a directory
 */
function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const result = {
    help: false,
    version: false,
    remove: false,
    development: false,
    stripModels: true, // Default: strip models
    tool: null,        // Single tool
    tools: [],         // Multiple tools
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--version' || arg === '-v') {
      result.version = true;
    } else if (arg === '--remove' || arg === '--uninstall') {
      result.remove = true;
    } else if (arg === '--development' || arg === '--dev') {
      result.development = true;
    } else if (arg === '--no-strip' || arg === '-ns') {
      result.stripModels = false;
    } else if (arg === '--strip-models') {
      // Legacy flag, now default behavior
      result.stripModels = true;
    } else if (arg === '--tool' && args[i + 1]) {
      const tool = args[i + 1].toLowerCase();
      if (VALID_TOOLS.includes(tool)) {
        result.tool = tool;
      } else {
        console.error(`[ERROR] Invalid tool: ${tool}. Valid options: ${VALID_TOOLS.join(', ')}`);
        process.exit(1);
      }
      i++;
    } else if (arg === '--tools' && args[i + 1]) {
      const toolList = args[i + 1].toLowerCase().split(',').map(t => t.trim());
      for (const tool of toolList) {
        if (!VALID_TOOLS.includes(tool)) {
          console.error(`[ERROR] Invalid tool: ${tool}. Valid options: ${VALID_TOOLS.join(', ')}`);
          process.exit(1);
        }
        result.tools.push(tool);
      }
      i++;
    }
  }

  // Environment variable override for strip models (legacy support)
  if (['0', 'false', 'no'].includes((process.env.AWESOME_SLASH_STRIP_MODELS || '').toLowerCase())) {
    result.stripModels = false;
  }

  return result;
}

/**
 * Interactive multi-select prompt
 */
async function multiSelect(question, options) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log(`\n${question}\n`);
  console.log('Enter numbers separated by spaces (e.g., "1 2" or "1,2,3"), then press Enter:\n');

  options.forEach((opt, i) => {
    console.log(`  ${i + 1}) ${opt.label}`);
  });

  console.log();

  return new Promise((resolve) => {
    rl.question('Your selection: ', (answer) => {
      rl.close();

      // Parse input like "1 2 3" or "1,2,3" or "1, 2, 3"
      const nums = answer.split(/[\s,]+/).map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));

      const result = [];
      for (const num of nums) {
        if (num >= 1 && num <= options.length) {
          result.push(options[num - 1].value);
        }
      }

      resolve([...new Set(result)]); // Dedupe
    });
  });
}

function cleanOldInstallation(installDir) {
  if (fs.existsSync(installDir)) {
    console.log('Removing previous installation...');
    fs.rmSync(installDir, { recursive: true, force: true });
  }
}

function copyFromPackage(installDir) {
  console.log('Installing awesome-slash files...');
  // Copy from npm package to ~/.awesome-slash
  fs.cpSync(PACKAGE_DIR, installDir, {
    recursive: true,
    filter: (src) => {
      // Skip node_modules and .git directories
      const basename = path.basename(src);
      return basename !== 'node_modules' && basename !== '.git';
    }
  });
}

function installDependencies(installDir) {
  console.log('Installing dependencies...');
  execSync('npm install --production', { cwd: installDir, stdio: 'inherit' });
}

function installForClaude() {
  console.log('\n[INSTALL] Installing for Claude Code...\n');

  if (!commandExists('claude')) {
    console.log('[WARN]  Claude Code CLI not detected.');
    console.log('   Install it first: https://claude.ai/code\n');
    console.log('   Then run in Claude Code:');
    console.log('   /plugin marketplace add avifenesh/awesome-slash');
    console.log('   /plugin install next-task@awesome-slash\n');
    return false;
  }

  try {
    // Add GitHub marketplace
    console.log('Adding marketplace...');
    try {
      execSync('claude plugin marketplace add avifenesh/awesome-slash', { stdio: 'pipe' });
    } catch {
      // May already exist
    }

    // Discover plugins from filesystem convention
    const plugins = discovery.discoverPlugins(PACKAGE_DIR);
    for (const plugin of plugins) {
      // Validate plugin name before shell use (prevents injection)
      if (!/^[a-z0-9][a-z0-9-]*$/.test(plugin)) continue;
      console.log(`  Installing ${plugin}...`);
      try {
        // Try install first
        execSync(`claude plugin install ${plugin}@awesome-slash`, { stdio: 'pipe' });
      } catch {
        // If install fails (already installed), try update
        try {
          execSync(`claude plugin update ${plugin}@awesome-slash`, { stdio: 'pipe' });
        } catch {
          // Ignore if update also fails
        }
      }
    }

    console.log('\n[OK] Claude Code installation complete!\n');
    console.log('Commands: ' + plugins.map(p => '/' + p).join(', '));
    return true;
  } catch (err) {
    console.log('[ERROR] Auto-install failed. Manual installation:');
    console.log('   /plugin marketplace add avifenesh/awesome-slash');
    console.log('   /plugin install next-task@awesome-slash');
    return false;
  }
}

/**
 * Development mode: Install directly to ~/.claude/plugins
 * Bypasses marketplace for testing RC/dev versions
 */
function installForClaudeDevelopment() {
  console.log('\n[INSTALL] Installing for Claude Code (DEVELOPMENT MODE)...\n');

  if (!commandExists('claude')) {
    console.log('[WARN]  Claude Code CLI not detected.');
    console.log('   Install it first: https://claude.ai/code\n');
    return false;
  }

  const pluginsDir = getClaudePluginsDir();
  const plugins = discovery.discoverPlugins(PACKAGE_DIR);

  // Remove marketplace plugins first
  console.log('Removing marketplace plugins...');
  try {
    execSync('claude plugin marketplace remove avifenesh/awesome-slash', { stdio: 'pipe' });
    console.log('  [OK] Removed marketplace');
  } catch {
    // May not exist
  }

  for (const plugin of plugins) {
    // Validate plugin name before shell use (prevents injection)
    if (!/^[a-z0-9][a-z0-9-]*$/.test(plugin)) continue;
    try {
      execSync(`claude plugin uninstall ${plugin}@awesome-slash`, { stdio: 'pipe' });
      console.log(`  [OK] Uninstalled ${plugin}`);
    } catch {
      // May not be installed
    }
  }

  // Create plugins directory
  fs.mkdirSync(pluginsDir, { recursive: true });

  // Copy each plugin directly
  console.log('\nCopying plugins from package...');
  for (const plugin of plugins) {
    const srcDir = path.join(PACKAGE_DIR, 'plugins', plugin);
    const destDir = path.join(pluginsDir, `${plugin}@awesome-slash`);

    if (fs.existsSync(srcDir)) {
      // Remove existing
      if (fs.existsSync(destDir)) {
        fs.rmSync(destDir, { recursive: true, force: true });
      }

      // Copy plugin
      fs.cpSync(srcDir, destDir, {
        recursive: true,
        filter: (src) => {
          const basename = path.basename(src);
          return basename !== 'node_modules' && basename !== '.git';
        }
      });
      console.log(`  [OK] Installed ${plugin}`);
    }
  }

  console.log('\n[OK] Claude Code development installation complete!');
  console.log('  Plugins installed to: ' + pluginsDir);
  console.log('  Commands: ' + plugins.map(p => '/' + p).join(', '));
  console.log('\n[NOTE] To revert to marketplace version:');
  console.log('  rm -rf ~/.claude/plugins/*@awesome-slash');
  console.log('  awesome-slash --tool claude');
  return true;
}

function installForOpenCode(installDir, options = {}) {
  console.log('\n[INSTALL] Installing for OpenCode...\n');
  const { stripModels = true } = options;

  if (stripModels) {
    console.log('  [INFO] Model specifications stripped (default). Use --no-strip to include.');
  } else {
    console.log('  [INFO] Model specifications included (--no-strip).');
  }

  const home = process.env.HOME || process.env.USERPROFILE;
  const opencodeConfigDir = getOpenCodeConfigDir();
  // OpenCode global locations are under ~/.config/opencode (or $XDG_CONFIG_HOME/opencode).
  const commandsDir = path.join(opencodeConfigDir, 'commands');
  const pluginDir = path.join(opencodeConfigDir, 'plugins');

  fs.mkdirSync(commandsDir, { recursive: true });
  fs.mkdirSync(pluginDir, { recursive: true });

  // Install native OpenCode plugin (auto-thinking, workflow enforcement, compaction)
  const pluginSrcDir = path.join(installDir, 'adapters', 'opencode-plugin');
  if (fs.existsSync(pluginSrcDir)) {
    // OpenCode loads plugin files directly from the plugins directory.
    const srcPath = path.join(pluginSrcDir, 'index.ts');
    const destPath = path.join(pluginDir, 'awesome-slash.ts');
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log('  [OK] Installed native plugin (auto-thinking, workflow enforcement)');
    }
  }

  // Clean up the legacy (pre-XDG) install location if it exists.
  // This location is not used by OpenCode and was used by older awesome-slash versions.
  const legacyCommandsDir = path.join(home, '.opencode', 'commands', 'awesome-slash');
  if (fs.existsSync(legacyCommandsDir)) {
    fs.rmSync(legacyCommandsDir, { recursive: true, force: true });
  }
  const legacyPluginDir = path.join(home, '.opencode', 'plugins', 'awesome-slash');
  if (fs.existsSync(legacyPluginDir)) {
    fs.rmSync(legacyPluginDir, { recursive: true, force: true });
  }

  // Discover command mappings from filesystem
  const commandMappings = discovery.getCommandMappings(installDir);

  // Helper function to transform content for OpenCode
  function transformForOpenCode(content) {
    // Transform plugin root variable
    content = content.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, '${PLUGIN_ROOT}');
    content = content.replace(/\$CLAUDE_PLUGIN_ROOT/g, '$PLUGIN_ROOT');
    // Transform state directory references (.claude -> .opencode)
    content = content.replace(/\.claude\//g, '.opencode/');
    content = content.replace(/\.claude'/g, ".opencode'");
    content = content.replace(/\.claude"/g, '.opencode"');
    content = content.replace(/\.claude`/g, '.opencode`');

    // Strip plugin prefix from agent references (next-task:agent-name -> agent-name)
    // This is critical - OpenCode agents are installed without the plugin prefix
    const pluginNames = discovery.discoverPlugins(installDir).join('|');
    content = content.replace(new RegExp('`(' + pluginNames + '):([a-z-]+)`', 'g'), '`$2`');
    content = content.replace(new RegExp('(' + pluginNames + '):([a-z-]+)', 'g'), '$2');

    // Transform ALL code blocks (with OR without language identifier)
    // Pattern matches: ```javascript, ```js, ```bash, or just ``` (unmarked)
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

    // Remove any remaining standalone Task() calls outside code blocks
    content = content.replace(/await\s+Task\s*\(\s*\{[\s\S]*?\}\s*\);?/g, (match) => {
      const agentMatch = match.match(/subagent_type:\s*["'](?:[^"':]+:)?([^"']+)["']/);
      if (agentMatch) {
        return `Invoke \`@${agentMatch[1]}\` agent`;
      }
      return '*(Task call - use @agent-name syntax)*';
    });

    // Remove any remaining require() statements
    content = content.replace(/(?:const|let|var)\s+\{?[^}=\n]+\}?\s*=\s*require\s*\([^)]+\);?/g, '');
    content = content.replace(/require\s*\(['"][^'"]+['"]\)/g, '');

    // Add OpenCode-specific note at the top if it's a complex command
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

    // Embed policy options directly for OpenCode (can't require() external files)
    // Only add to next-task command (check for unique next-task markers)
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

  // Helper function to transform command frontmatter for OpenCode
  function transformCommandFrontmatter(content) {
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

  // Transform and copy command files
  for (const [target, plugin, source] of commandMappings) {
    const srcPath = path.join(installDir, 'plugins', plugin, 'commands', source);
    const destPath = path.join(commandsDir, target);
    if (fs.existsSync(srcPath)) {
      let content = fs.readFileSync(srcPath, 'utf8');
      content = transformForOpenCode(content);
      content = transformCommandFrontmatter(content);
      fs.writeFileSync(destPath, content);
    }
  }

  // Install agents to global OpenCode location
  // OpenCode looks for agents in ~/.config/opencode/agents/ (global) or .opencode/agents/ (per-project)
  const agentsDir = path.join(opencodeConfigDir, 'agents');
  fs.mkdirSync(agentsDir, { recursive: true });

  console.log('  Installing agents for OpenCode...');
  const pluginDirs = discovery.discoverPlugins(installDir);
  let agentCount = 0;

  for (const pluginName of pluginDirs) {
    const srcAgentsDir = path.join(installDir, 'plugins', pluginName, 'agents');
    if (fs.existsSync(srcAgentsDir)) {
      const agentFiles = fs.readdirSync(srcAgentsDir).filter(f => f.endsWith('.md'));
      for (const agentFile of agentFiles) {
        const srcPath = path.join(srcAgentsDir, agentFile);
        const destPath = path.join(agentsDir, agentFile);
        let content = fs.readFileSync(srcPath, 'utf8');

        // Transform for OpenCode
        content = transformForOpenCode(content);

        // Transform agent frontmatter from Claude format to OpenCode format
        // Claude: tools: Bash(git:*), Read, Write
        // OpenCode: permission: { read: allow, edit: allow, bash: allow }
        content = content.replace(
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

        fs.writeFileSync(destPath, content);
        agentCount++;
      }
    }
  }
  console.log(`  [OK] Installed ${agentCount} agents to ${agentsDir}`);

  // Copy lib files to commands directory for require() access
  const libSrcDir = path.join(installDir, 'lib');
  const libDestDir = path.join(commandsDir, 'lib');
  if (fs.existsSync(libSrcDir)) {
    console.log('  Installing lib files...');
    copyDirRecursive(libSrcDir, libDestDir);
    console.log(`  [OK] Installed lib to ${libDestDir}`);
  }

  // Install skills to the OpenCode global skills directory (~/.config/opencode/skills/<skill-name>/SKILL.md)
  const skillsDestDir = path.join(opencodeConfigDir, 'skills');
  fs.mkdirSync(skillsDestDir, { recursive: true });
  console.log('  Installing skills...');
  let skillCount = 0;

  for (const pluginName of pluginDirs) {
    const srcSkillsDir = path.join(installDir, 'plugins', pluginName, 'skills');
    if (fs.existsSync(srcSkillsDir)) {
      const skillDirs = fs.readdirSync(srcSkillsDir, { withFileTypes: true })
        .filter(d => d.isDirectory());
      for (const skillDir of skillDirs) {
        const skillName = skillDir.name;
        const srcSkillPath = path.join(srcSkillsDir, skillName, 'SKILL.md');
        if (fs.existsSync(srcSkillPath)) {
          const destSkillDir = path.join(skillsDestDir, skillName);
          fs.mkdirSync(destSkillDir, { recursive: true });
          let content = fs.readFileSync(srcSkillPath, 'utf8');
          content = transformForOpenCode(content);
          fs.writeFileSync(path.join(destSkillDir, 'SKILL.md'), content);
          skillCount++;
        }
      }
    }
  }
  console.log(`  [OK] Installed ${skillCount} skills to ${skillsDestDir}`);

  console.log('[OK] OpenCode installation complete!');
  console.log(`   Commands: ${commandsDir}`);
  console.log(`   Agents: ${agentsDir}`);
  console.log(`   Plugin: ${pluginDir}`);
  console.log('   Access via: ' + commandMappings.map(([target]) => '/' + target.replace(/\.md$/, '')).join(', '));
  console.log('   Native features: Auto-thinking selection, workflow enforcement, session compaction\n');
  return true;
}

function installForCodex(installDir) {
  console.log('\n[INSTALL] Installing for Codex CLI...\n');

  const home = process.env.HOME || process.env.USERPROFILE;
  const configDir = path.join(home, '.codex');
  const skillsDir = path.join(configDir, 'skills');

  fs.mkdirSync(configDir, { recursive: true });
  fs.mkdirSync(skillsDir, { recursive: true });

  // Remove old/deprecated prompts directory if it exists
  const oldPromptsDir = path.join(configDir, 'prompts');
  if (fs.existsSync(oldPromptsDir)) {
    const oldFiles = ['next-task.md', 'ship.md', 'deslop.md', 'audit-project.md',
                      'drift-detect.md', 'delivery-approval.md', 'sync-docs.md',
                      'drift-detect-set.md', 'pr-merge.md'];
    for (const file of oldFiles) {
      const oldPath = path.join(oldPromptsDir, file);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
        console.log(`  Removed old prompt: ${file}`);
      }
    }
  }

  // Remove old/deprecated skills
  const oldSkillDirs = ['deslop', 'review', 'drift-detect-set', 'pr-merge'];
  for (const dir of oldSkillDirs) {
    const oldPath = path.join(skillsDir, dir);
    if (fs.existsSync(oldPath)) {
      fs.rmSync(oldPath, { recursive: true, force: true });
      console.log(`  Removed deprecated skill: ${dir}`);
    }
  }

  // Discover skill mappings from filesystem (descriptions from codex-description frontmatter)
  const skillMappings = discovery.getCodexSkillMappings(installDir);

  for (const [skillName, plugin, sourceFile, description] of skillMappings) {
    const srcPath = path.join(installDir, 'plugins', plugin, 'commands', sourceFile);
    const skillDir = path.join(skillsDir, skillName);
    const destPath = path.join(skillDir, 'SKILL.md');

    if (fs.existsSync(srcPath)) {
      if (fs.existsSync(skillDir)) {
        fs.rmSync(skillDir, { recursive: true, force: true });
      }
      // Create skill directory
      fs.mkdirSync(skillDir, { recursive: true });

      // Read source file and transform to SKILL.md format
      let content = fs.readFileSync(srcPath, 'utf8');

      // Check if file has existing YAML frontmatter
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

      // Transform PLUGIN_ROOT to actual installed path for Codex
      // Codex doesn't set PLUGIN_ROOT, so use absolute path to installed plugin
      const pluginInstallPath = path.join(installDir, 'plugins', plugin);
      content = content.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, pluginInstallPath);
      content = content.replace(/\$CLAUDE_PLUGIN_ROOT/g, pluginInstallPath);
      content = content.replace(/\$\{PLUGIN_ROOT\}/g, pluginInstallPath);
      content = content.replace(/\$PLUGIN_ROOT/g, pluginInstallPath);

      fs.writeFileSync(destPath, content);
      console.log(`  [OK] Installed skill: ${skillName}`);
    }
  }

  console.log('\n[OK] Codex CLI installation complete!');
  console.log(`   Config: ${configDir}`);
  console.log(`   Skills: ${skillsDir}`);
  console.log('   Access via: $next-task, $ship, $deslop, etc.\n');
  return true;
}

function removeInstallation() {
  const installDir = getInstallDir();

  if (!fs.existsSync(installDir)) {
    console.log('Nothing to remove. awesome-slash is not installed.');
    return;
  }

  console.log('Removing awesome-slash...');
  fs.rmSync(installDir, { recursive: true, force: true });

  console.log('\n[OK] Removed ~/.awesome-slash');
  console.log('\nTo fully uninstall, also remove:');
  console.log('  - Claude: /plugin marketplace remove awesome-slash');
  console.log('  - OpenCode: Remove files under ~/.config/opencode/ (commands/*.md, agents/*.md, skills/*/SKILL.md) and ~/.config/opencode/plugins/awesome-slash.ts');
  console.log('  - Codex: Remove ~/.codex/skills/*/');
}

function printHelp() {
  console.log(`
awesome-slash v${VERSION} - Workflow automation for AI coding assistants

Usage:
  awesome-slash                    Interactive installer (select platforms)
  awesome-slash --tool <name>      Install for single tool (claude, opencode, codex)
  awesome-slash --tools <list>     Install for multiple tools (comma-separated)
  awesome-slash --development      Development mode: install to ~/.claude/plugins
  awesome-slash --no-strip, -ns    Include model specifications (stripped by default)
  awesome-slash --remove           Remove local installation
  awesome-slash --version, -v      Show version
  awesome-slash --help, -h         Show this help

Non-Interactive Examples:
  awesome-slash --tool claude              # Install for Claude Code only
  awesome-slash --tool opencode            # Install for OpenCode only
  awesome-slash --tools "claude,opencode"  # Install for both
  awesome-slash --tools claude,opencode,codex  # Install for all three

Development Mode:
  awesome-slash --development      # Install plugins directly to ~/.claude/plugins
                                   # Bypasses marketplace for testing RC versions

Model Handling:
  By default, model specifications (sonnet/opus/haiku) are stripped from agents
  when installing for OpenCode. This is because most users don't have the
  required model mappings configured. Use --no-strip or -ns to include models.

Environment Variables:
  AWESOME_SLASH_STRIP_MODELS=0     Same as --no-strip

Supported Platforms:
  claude   - Claude Code (marketplace install or development mode)
  opencode - OpenCode (local commands + native plugin)
  codex    - Codex CLI (local skills)

Install:  npm install -g awesome-slash && awesome-slash
Update:   npm update -g awesome-slash && awesome-slash
Remove:   npm uninstall -g awesome-slash && awesome-slash --remove

Docs: https://github.com/avifenesh/awesome-slash
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Handle --remove / --uninstall
  if (args.remove) {
    removeInstallation();
    return;
  }

  // Handle --version
  if (args.version) {
    console.log(`awesome-slash v${VERSION}`);
    return;
  }

  // Handle --help
  if (args.help) {
    printHelp();
    return;
  }

  // Determine which tools to install
  let selected = [];

  if (args.tool) {
    // Single tool specified
    selected = [args.tool];
  } else if (args.tools.length > 0) {
    // Multiple tools specified
    selected = args.tools;
  }

  // If no tools specified via flags, show interactive prompt
  if (selected.length === 0) {
    const title = `awesome-slash v${VERSION}`;
    const subtitle = 'Workflow automation for AI assistants';
    const width = Math.max(title.length, subtitle.length) + 6;
    const pad = (str) => {
      const left = Math.floor((width - str.length) / 2);
      const right = width - str.length - left;
      return ' '.repeat(left) + str + ' '.repeat(right);
    };

    console.log(`
┌${'─'.repeat(width)}┐
│${pad(title)}│
│${' '.repeat(width)}│
│${pad(subtitle)}│
└${'─'.repeat(width)}┘
`);

    // Multi-select platforms
    const options = [
      { value: 'claude', label: 'Claude Code' },
      { value: 'opencode', label: 'OpenCode' },
      { value: 'codex', label: 'Codex CLI' }
    ];

    selected = await multiSelect(
      'Which platforms do you want to install for?',
      options
    );

    if (selected.length === 0) {
      console.log('\nNo platforms selected. Exiting.');
      console.log('\nFor Claude Code, you can also install directly:');
      console.log('  /plugin marketplace add avifenesh/awesome-slash');
      process.exit(0);
    }
  }

  console.log(`\nInstalling for: ${selected.join(', ')}\n`);

  // Only copy to ~/.awesome-slash if OpenCode or Codex selected (they need local files)
  const needsLocalInstall = selected.includes('opencode') || selected.includes('codex');
  let installDir = null;

  if (needsLocalInstall) {
    installDir = getInstallDir();
    cleanOldInstallation(installDir);
    copyFromPackage(installDir);
    installDependencies(installDir);
  }

  // Install for each platform
  for (const platform of selected) {
    switch (platform) {
      case 'claude':
        if (args.development) {
          installForClaudeDevelopment();
        } else {
          installForClaude();
        }
        break;
      case 'opencode':
        installForOpenCode(installDir, { stripModels: args.stripModels });
        break;
      case 'codex':
        installForCodex(installDir);
        break;
    }
  }

  console.log('─'.repeat(45));
  if (installDir) {
    console.log(`\nInstallation directory: ${installDir}`);
  }
  console.log('\nTo update:  npm update -g awesome-slash');
  console.log('To remove:  npm uninstall -g awesome-slash && awesome-slash --remove');
  console.log('\nDocs: https://github.com/avifenesh/awesome-slash');
}

// Export for testing when required as module
if (require.main === module) {
  main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}

module.exports = { parseArgs, VALID_TOOLS };
