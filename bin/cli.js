#!/usr/bin/env node
/**
 * AgentSys CLI installer
 *
 * Install:  npm install -g agentsys@latest
 * Run:      agentsys
 * Update:   npm update -g agentsys
 * Remove:   npm uninstall -g agentsys && agentsys --remove
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const VERSION = require('../package.json').version;
// Use the installed npm package directory as source (no git clone needed)
const PACKAGE_DIR = path.join(__dirname, '..');
const discovery = require('../lib/discovery');
const transforms = require('../lib/adapter-transforms');

// Valid tool names
const VALID_TOOLS = ['claude', 'opencode', 'codex'];

function getInstallDir() {
  const home = process.env.HOME || process.env.USERPROFILE;
  return path.join(home, '.agentsys');
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
  if (['0', 'false', 'no'].includes((process.env.AGENTSYS_STRIP_MODELS || '').toLowerCase())) {
    result.stripModels = false;
  }

  return result;
}

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
  console.log('Installing AgentSys files...');
  // Copy from npm package to ~/.agentsys
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
    console.log('   /plugin marketplace add agent-sh/agentsys');
    console.log('   /plugin install next-task@agentsys\n');
    return false;
  }

  try {
    // Add GitHub marketplace
    console.log('Adding marketplace...');
    try {
      execSync('claude plugin marketplace add agent-sh/agentsys', { stdio: 'pipe' });
    } catch {
      // May already exist
    }

    // Discover plugins from filesystem convention
    const plugins = discovery.discoverPlugins(PACKAGE_DIR);
    const failedPlugins = [];
    for (const plugin of plugins) {
      // Validate plugin name before shell use (prevents injection)
      if (!/^[a-z0-9][a-z0-9-]*$/.test(plugin)) continue;
      console.log(`  Installing ${plugin}...`);
      // Remove pre-rename plugin ID to prevent dual loading on upgrade
      try {
        execSync(`claude plugin uninstall ${plugin}@awesome-slash`, { stdio: 'pipe' });
      } catch {
        // Not installed under old name
      }
      try {
        // Try install first
        execSync(`claude plugin install ${plugin}@agentsys`, { stdio: 'pipe' });
      } catch {
        // If install fails (already installed), try update
        try {
          execSync(`claude plugin update ${plugin}@agentsys`, { stdio: 'pipe' });
        } catch {
          failedPlugins.push(plugin);
        }
      }
    }

    if (failedPlugins.length > 0) {
      console.log(`\n[ERROR] Failed to install/update ${failedPlugins.length} plugin(s): ${failedPlugins.join(', ')}`);
      console.log('Retry with: /plugin install <plugin>@agentsys');
      return false;
    }

    console.log('\n[OK] Claude Code installation complete!\n');
    console.log('Commands: ' + plugins.map(p => '/' + p).join(', '));
    return true;
  } catch (err) {
    console.log('[ERROR] Auto-install failed. Manual installation:');
    console.log('   /plugin marketplace add agent-sh/agentsys');
    console.log('   /plugin install next-task@agentsys');
    return false;
  }
}

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
    execSync('claude plugin marketplace remove agent-sh/agentsys', { stdio: 'pipe' });
    console.log('  [OK] Removed marketplace');
  } catch {
    // May not exist
  }

  for (const plugin of plugins) {
    // Validate plugin name before shell use (prevents injection)
    if (!/^[a-z0-9][a-z0-9-]*$/.test(plugin)) continue;
    // Uninstall both current and pre-rename plugin IDs
    for (const suffix of ['agentsys', 'awesome-slash']) {
      try {
        execSync(`claude plugin uninstall ${plugin}@${suffix}`, { stdio: 'pipe' });
        console.log(`  [OK] Uninstalled ${plugin}@${suffix}`);
      } catch {
        // May not be installed
      }
    }
  }

  // Create plugins directory
  fs.mkdirSync(pluginsDir, { recursive: true });

  // Copy each plugin directly
  console.log('\nCopying plugins from package...');
  for (const plugin of plugins) {
    const srcDir = path.join(PACKAGE_DIR, 'plugins', plugin);
    const destDir = path.join(pluginsDir, `${plugin}@agentsys`);

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
  console.log('  rm -rf ~/.claude/plugins/*@agentsys');
  console.log('  agentsys --tool claude');
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
  const agentsDir = path.join(opencodeConfigDir, 'agents');

  fs.mkdirSync(commandsDir, { recursive: true });
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.mkdirSync(agentsDir, { recursive: true });

  // Install native OpenCode plugin (auto-thinking, workflow enforcement, compaction)
  const pluginSrcDir = path.join(installDir, 'adapters', 'opencode-plugin');
  if (fs.existsSync(pluginSrcDir)) {
    // OpenCode loads plugin files directly from the plugins directory.
    const srcPath = path.join(pluginSrcDir, 'index.ts');
    const destPath = path.join(pluginDir, 'agentsys.ts');
    // Remove legacy plugin file from pre-rename installs to prevent dual loading
    const legacyPluginFile = path.join(pluginDir, 'awesome-slash.ts');
    if (fs.existsSync(legacyPluginFile)) {
      fs.unlinkSync(legacyPluginFile);
    }
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log('  [OK] Installed native plugin (auto-thinking, workflow enforcement)');
    }
  }

  // Clean up the legacy (pre-XDG) install location if it exists.
  // This location is not used by OpenCode and was used by older versions.
  const legacyCommandsDir = path.join(home, '.opencode', 'commands', 'agentsys');
  if (fs.existsSync(legacyCommandsDir)) {
    fs.rmSync(legacyCommandsDir, { recursive: true, force: true });
  }
  const legacyPluginDir = path.join(home, '.opencode', 'plugins', 'agentsys');
  if (fs.existsSync(legacyPluginDir)) {
    fs.rmSync(legacyPluginDir, { recursive: true, force: true });
  }
  // Also clean pre-rename paths (awesome-slash) for users upgrading from v4.x
  const preRenameCommandsDir = path.join(home, '.opencode', 'commands', 'awesome-slash');
  if (fs.existsSync(preRenameCommandsDir)) {
    fs.rmSync(preRenameCommandsDir, { recursive: true, force: true });
  }
  const preRenamePluginDir = path.join(home, '.opencode', 'plugins', 'awesome-slash');
  if (fs.existsSync(preRenamePluginDir)) {
    fs.rmSync(preRenamePluginDir, { recursive: true, force: true });
  }

  // Discover command mappings from filesystem
  const commandMappings = discovery.getCommandMappings(installDir);

  // Transform and copy command files
  for (const [target, plugin, source] of commandMappings) {
    const srcPath = path.join(installDir, 'plugins', plugin, 'commands', source);
    const destPath = path.join(commandsDir, target);
    if (fs.existsSync(srcPath)) {
      let content = fs.readFileSync(srcPath, 'utf8');
      content = transforms.transformBodyForOpenCode(content, installDir);
      content = transforms.transformCommandFrontmatterForOpenCode(content);
      fs.writeFileSync(destPath, content);
    }
  }

  // Remove legacy agent files from pre-rename installs.
  const legacyAgentFiles = ['review.md', 'ship.md', 'workflow.md'];
  for (const legacyFile of legacyAgentFiles) {
    const legacyPath = path.join(agentsDir, legacyFile);
    if (fs.existsSync(legacyPath)) {
      fs.unlinkSync(legacyPath);
    }
  }

  // Install agents to global OpenCode location
  // OpenCode looks for agents in ~/.config/opencode/agents/ (global) or .opencode/agents/ (per-project)

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

        // Transform body and frontmatter for OpenCode
        content = transforms.transformBodyForOpenCode(content, installDir);
        content = transforms.transformAgentFrontmatterForOpenCode(content, { stripModels });

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
          content = transforms.transformSkillBodyForOpenCode(content, installDir);
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
    if (!description) {
      console.log(`  [WARN] Skipping skill ${skillName}: missing description`);
      continue;
    }
    const srcPath = path.join(installDir, 'plugins', plugin, 'commands', sourceFile);
    const skillDir = path.join(skillsDir, skillName);
    const destPath = path.join(skillDir, 'SKILL.md');

    if (fs.existsSync(srcPath)) {
      if (fs.existsSync(skillDir)) {
        fs.rmSync(skillDir, { recursive: true, force: true });
      }
      // Create skill directory
      fs.mkdirSync(skillDir, { recursive: true });

      // Read source file and transform using shared transforms
      let content = fs.readFileSync(srcPath, 'utf8');
      const pluginInstallPath = path.join(installDir, 'plugins', plugin);
      content = transforms.transformForCodex(content, {
        skillName,
        description,
        pluginInstallPath
      });

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
    console.log('Nothing to remove. agentsys is not installed.');
    return;
  }

  console.log('Removing agentsys...');
  fs.rmSync(installDir, { recursive: true, force: true });

  console.log('\n[OK] Removed ~/.agentsys');
  console.log('\nTo fully uninstall, also remove:');
  console.log('  - Claude: /plugin marketplace remove agentsys');
  console.log('  - OpenCode: Remove files under ~/.config/opencode/ (commands/*.md, agents/*.md, skills/*/SKILL.md) and ~/.config/opencode/plugins/agentsys.ts');
  console.log('  - Codex: Remove ~/.codex/skills/*/');
}

function printHelp() {
  console.log(`
agentsys v${VERSION} - Workflow automation for AI coding assistants

Usage:
  agentsys                    Interactive installer (select platforms)
  agentsys --tool <name>      Install for single tool (claude, opencode, codex)
  agentsys --tools <list>     Install for multiple tools (comma-separated)
  agentsys --development      Development mode: install to ~/.claude/plugins
  agentsys --no-strip, -ns    Include model specifications (stripped by default)
  agentsys --remove           Remove local installation
  agentsys --version, -v      Show version
  agentsys --help, -h         Show this help

Non-Interactive Examples:
  agentsys --tool claude              # Install for Claude Code only
  agentsys --tool opencode            # Install for OpenCode only
  agentsys --tools "claude,opencode"  # Install for both
  agentsys --tools claude,opencode,codex  # Install for all three

Development Mode:
  agentsys --development      # Install plugins directly to ~/.claude/plugins
                                   # Bypasses marketplace for testing RC versions

Model Handling:
  By default, model specifications (sonnet/opus/haiku) are stripped from agents
  when installing for OpenCode. This is because most users don't have the
  required model mappings configured. Use --no-strip or -ns to include models.

Environment Variables:
  AGENTSYS_STRIP_MODELS=0     Same as --no-strip

Supported Platforms:
  claude   - Claude Code (marketplace install or development mode)
  opencode - OpenCode (local commands + native plugin)
  codex    - Codex CLI (local skills)

Install:  npm install -g agentsys && agentsys
Update:   npm update -g agentsys && agentsys
Remove:   npm uninstall -g agentsys && agentsys --remove

Docs: https://github.com/agent-sh/agentsys
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
    console.log(`agentsys v${VERSION}`);
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
    const title = `agentsys v${VERSION}`;
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
      console.log('  /plugin marketplace add agent-sh/agentsys');
      process.exit(0);
    }
  }

  console.log(`\nInstalling for: ${selected.join(', ')}\n`);

  // Only copy to ~/.agentsys if OpenCode or Codex selected (they need local files)
  const needsLocalInstall = selected.includes('opencode') || selected.includes('codex');
  let installDir = null;

  if (needsLocalInstall) {
    installDir = getInstallDir();
    cleanOldInstallation(installDir);
    copyFromPackage(installDir);
    installDependencies(installDir);
  }

  // Install for each platform
  const failedPlatforms = [];
  for (const platform of selected) {
    switch (platform) {
      case 'claude':
        if (args.development && !installForClaudeDevelopment()) {
          failedPlatforms.push('claude');
        } else {
          if (!args.development && !installForClaude()) {
            failedPlatforms.push('claude');
          }
        }
        break;
      case 'opencode':
        if (!installForOpenCode(installDir, { stripModels: args.stripModels })) {
          failedPlatforms.push('opencode');
        }
        break;
      case 'codex':
        if (!installForCodex(installDir)) {
          failedPlatforms.push('codex');
        }
        break;
    }
  }

  if (failedPlatforms.length > 0) {
    console.log(`\n[ERROR] Installation failed for: ${failedPlatforms.join(', ')}`);
    process.exitCode = 1;
  }

  console.log('─'.repeat(45));
  if (installDir) {
    console.log(`\nInstallation directory: ${installDir}`);
  }
  console.log('\nTo update:  npm update -g agentsys');
  console.log('To remove:  npm uninstall -g agentsys && agentsys --remove');
  console.log('\nDocs: https://github.com/agent-sh/agentsys');
}

// Export for testing when required as module
if (require.main === module) {
  main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}

module.exports = { parseArgs, VALID_TOOLS };
