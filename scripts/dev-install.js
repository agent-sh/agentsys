#!/usr/bin/env node
/**
 * Development installer for AgentSys
 *
 * Installs the current local version to all tools at once for quick testing.
 * Use this during development to test changes before publishing.
 *
 * Usage:
 *   node scripts/dev-install.js           # Install to all tools (Claude, OpenCode, Codex)
 *   node scripts/dev-install.js claude    # Install to Claude only
 *   node scripts/dev-install.js opencode  # Install to OpenCode only
 *   node scripts/dev-install.js codex     # Install to Codex only
 *   node scripts/dev-install.js --clean   # Remove all installations first
 *
 * This script:
 *   - Uses local source files (not npm package)
 *   - Installs Claude in development mode (bypasses marketplace)
 *   - Strips models from OpenCode agents (default)
 *   - Runs synchronously for quick feedback
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Source directory is the project root
const SOURCE_DIR = path.join(__dirname, '..');
const VERSION = require(path.join(SOURCE_DIR, 'package.json')).version;
const discovery = require(path.join(SOURCE_DIR, 'lib', 'discovery'));
const transforms = require(path.join(SOURCE_DIR, 'lib', 'adapter-transforms'));

// Target directories
const HOME = process.env.HOME || process.env.USERPROFILE;
const CLAUDE_PLUGINS_DIR = path.join(HOME, '.claude', 'plugins');

function getOpenCodeConfigDir() {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome && xdgConfigHome.trim()) {
    return path.join(xdgConfigHome, 'opencode');
  }
  return path.join(HOME, '.config', 'opencode');
}

const OPENCODE_CONFIG_DIR = getOpenCodeConfigDir();
// Legacy path - kept for cleanup of old installations
const LEGACY_OPENCODE_DIR = path.join(HOME, '.opencode');
const CODEX_DIR = path.join(HOME, '.codex');
const AGENTSYS_DIR = path.join(HOME, '.agentsys');

// Discover plugins from filesystem
const PLUGINS = discovery.discoverPlugins(SOURCE_DIR);

function log(msg) {
  console.log(`[dev-install] ${msg}`);
}

function commandExists(cmd) {
  try {
    execSync(`${process.platform === 'win32' ? 'where' : 'which'} ${cmd}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function cleanAll() {
  log('Cleaning all installations...');

  // Clean Claude plugins (current and pre-rename)
  for (const plugin of PLUGINS) {
    for (const suffix of ['agentsys', 'awesome-slash']) {
      const pluginDir = path.join(CLAUDE_PLUGINS_DIR, `${plugin}@${suffix}`);
      if (fs.existsSync(pluginDir)) {
        fs.rmSync(pluginDir, { recursive: true, force: true });
        log(`  Removed Claude plugin: ${plugin}@${suffix}`);
      }
    }
  }

  // Clean OpenCode (correct XDG path: ~/.config/opencode/)
  // OpenCode expects commands directly in commands/, not a subdirectory
  const opencodeCommandsDir = path.join(OPENCODE_CONFIG_DIR, 'commands');
  const opencodePluginDir = path.join(OPENCODE_CONFIG_DIR, 'plugins');
  const opencodeAgentsDir = path.join(OPENCODE_CONFIG_DIR, 'agents');
  // Note: Skills cleanup not implemented yet - would need skill list similar to agents

  // Discover agent and command filenames from filesystem
  const knownAgents = discovery.discoverAgents(SOURCE_DIR).map(a => a.file);
  const knownCommands = discovery.discoverCommands(SOURCE_DIR).map(c => c.file);

  // Clean commands (remove our files, not the whole directory)
  if (fs.existsSync(opencodeCommandsDir)) {
    let removedCount = 0;
    for (const file of knownCommands) {
      const filePath = path.join(opencodeCommandsDir, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        removedCount++;
      }
    }
    // Also clean lib directory we install
    const libDir = path.join(opencodeCommandsDir, 'lib');
    if (fs.existsSync(libDir)) {
      fs.rmSync(libDir, { recursive: true, force: true });
      removedCount++;
    }
    if (removedCount > 0) {
      log(`  Removed ${removedCount} OpenCode commands/lib`);
    }
  }

  // Clean plugin files (current and pre-rename)
  for (const name of ['agentsys.ts', 'awesome-slash.ts']) {
    const pluginFile = path.join(opencodePluginDir, name);
    if (fs.existsSync(pluginFile)) {
      fs.unlinkSync(pluginFile);
      log(`  Removed OpenCode plugin ${name}`);
    }
  }

  // Clean agent files installed by us - only known agentsys agents
  if (fs.existsSync(opencodeAgentsDir)) {
    let removedCount = 0;
    for (const file of knownAgents) {
      const filePath = path.join(opencodeAgentsDir, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        removedCount++;
      }
    }
    // Remove legacy agent files from pre-rename installs
    const legacyAgentFiles = ['review.md', 'ship.md', 'workflow.md'];
    for (const legacyFile of legacyAgentFiles) {
      const legacyPath = path.join(opencodeAgentsDir, legacyFile);
      if (fs.existsSync(legacyPath)) {
        fs.unlinkSync(legacyPath);
        removedCount++;
      }
    }
    if (removedCount > 0) {
      log(`  Removed ${removedCount} OpenCode agents`);
    }
  }

  // Clean legacy OpenCode paths (~/.opencode/ - incorrect, pre-XDG)
  // Also clean pre-rename paths (awesome-slash) for users upgrading from v4.x
  const legacyCommandsDir = path.join(LEGACY_OPENCODE_DIR, 'commands', 'agentsys');
  const legacyPluginDir = path.join(LEGACY_OPENCODE_DIR, 'plugins', 'agentsys');
  const preRenameCommandsDir = path.join(LEGACY_OPENCODE_DIR, 'commands', 'awesome-slash');
  const preRenamePluginDir = path.join(LEGACY_OPENCODE_DIR, 'plugins', 'awesome-slash');
  const legacyAgentsDir = path.join(LEGACY_OPENCODE_DIR, 'agents');

  if (fs.existsSync(legacyCommandsDir)) {
    fs.rmSync(legacyCommandsDir, { recursive: true, force: true });
    log('  Removed legacy ~/.opencode/commands/agentsys');
  }
  if (fs.existsSync(legacyPluginDir)) {
    fs.rmSync(legacyPluginDir, { recursive: true, force: true });
    log('  Removed legacy ~/.opencode/plugins/agentsys');
  }
  if (fs.existsSync(preRenameCommandsDir)) {
    fs.rmSync(preRenameCommandsDir, { recursive: true, force: true });
    log('  Removed pre-rename ~/.opencode/commands/awesome-slash');
  }
  if (fs.existsSync(preRenamePluginDir)) {
    fs.rmSync(preRenamePluginDir, { recursive: true, force: true });
    log('  Removed pre-rename ~/.opencode/plugins/awesome-slash');
  }
  if (fs.existsSync(legacyAgentsDir)) {
    let removedCount = 0;
    for (const file of knownAgents) {
      const filePath = path.join(legacyAgentsDir, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        removedCount++;
      }
    }
    if (removedCount > 0) {
      log(`  Removed ${removedCount} legacy OpenCode agents from ~/.opencode/`);
    }
  }

  // Clean Codex
  const codexSkillsDir = path.join(CODEX_DIR, 'skills');
  if (fs.existsSync(codexSkillsDir)) {
    const ourSkills = discovery.getCodexSkillMappings(SOURCE_DIR).map(([name]) => name);
    for (const skill of fs.readdirSync(codexSkillsDir)) {
      const skillPath = path.join(codexSkillsDir, skill);
      // Only remove skills we know are ours (discovered from filesystem)
      if (ourSkills.includes(skill)) {
        fs.rmSync(skillPath, { recursive: true, force: true });
        log(`  Removed Codex skill: ${skill}`);
      }
    }
  }

  // Clean ~/.agentsys
  if (fs.existsSync(AGENTSYS_DIR)) {
    fs.rmSync(AGENTSYS_DIR, { recursive: true, force: true });
    log('  Removed ~/.agentsys');
  }

  log('Clean complete.');
}

function installClaude() {
  log('Installing for Claude Code (development mode)...');

  if (!commandExists('claude')) {
    log('  [SKIP] Claude CLI not found');
    return false;
  }

  // Remove marketplace plugins first
  try {
    execSync('claude plugin marketplace remove agent-sh/agentsys', { stdio: 'pipe' });
    log('  Removed marketplace');
  } catch {
    // May not exist
  }

  for (const plugin of PLUGINS) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(plugin)) continue;
    // Uninstall both current and pre-rename plugin IDs
    for (const suffix of ['agentsys', 'awesome-slash']) {
      try {
        execSync(`claude plugin uninstall ${plugin}@${suffix}`, { stdio: 'pipe' });
      } catch {
        // May not be installed
      }
    }
  }

  // Create plugins directory
  fs.mkdirSync(CLAUDE_PLUGINS_DIR, { recursive: true });

  // Copy each plugin directly from source
  const installedPlugins = {};
  for (const plugin of PLUGINS) {
    const srcDir = path.join(SOURCE_DIR, 'plugins', plugin);
    const destDir = path.join(CLAUDE_PLUGINS_DIR, `${plugin}@agentsys`);

    if (fs.existsSync(srcDir)) {
      if (fs.existsSync(destDir)) {
        fs.rmSync(destDir, { recursive: true, force: true });
      }

      fs.cpSync(srcDir, destDir, {
        recursive: true,
        filter: (src) => {
          const basename = path.basename(src);
          return basename !== 'node_modules' && basename !== '.git';
        }
      });

      // Register the plugin
      installedPlugins[`${plugin}@agentsys`] = {
        source: 'local',
        installedAt: new Date().toISOString()
      };
      log(`  [OK] ${plugin}`);
    }
  }

  // Write installed_plugins.json
  const installedPluginsPath = path.join(CLAUDE_PLUGINS_DIR, 'installed_plugins.json');
  fs.writeFileSync(installedPluginsPath, JSON.stringify({
    version: 2,
    plugins: installedPlugins
  }, null, 2));

  // Enable plugins in settings.json
  const settingsPath = path.join(HOME, '.claude', 'settings.json');
  if (fs.existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      settings.enabledPlugins = settings.enabledPlugins || {};
      for (const plugin of PLUGINS) {
        // Remove pre-rename entries and add current ones
        delete settings.enabledPlugins[`${plugin}@awesome-slash`];
        settings.enabledPlugins[`${plugin}@agentsys`] = true;
      }
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      log('  [OK] Enabled in settings.json');
    } catch (e) {
      log(`  [WARN] Could not update settings.json: ${e.message}`);
    }
  }

  log('Claude installation complete.');
  return true;
}

function installOpenCode() {
  log('Installing for OpenCode...');

  // Create directories in correct XDG location (~/.config/opencode/)
  // OpenCode expects commands directly in commands/, not a subdirectory
  const commandsDir = path.join(OPENCODE_CONFIG_DIR, 'commands');
  const pluginDir = path.join(OPENCODE_CONFIG_DIR, 'plugins');
  const agentsDir = path.join(OPENCODE_CONFIG_DIR, 'agents');

  fs.mkdirSync(commandsDir, { recursive: true });
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.mkdirSync(agentsDir, { recursive: true });

  // Clean up legacy paths (~/.opencode/) if they exist
  const legacyCommandsDir = path.join(LEGACY_OPENCODE_DIR, 'commands', 'agentsys');
  const legacyPluginDir = path.join(LEGACY_OPENCODE_DIR, 'plugins', 'agentsys');
  if (fs.existsSync(legacyCommandsDir)) {
    fs.rmSync(legacyCommandsDir, { recursive: true, force: true });
    log('  Cleaned up legacy ~/.opencode/commands/agentsys');
  }
  if (fs.existsSync(legacyPluginDir)) {
    fs.rmSync(legacyPluginDir, { recursive: true, force: true });
    log('  Cleaned up legacy ~/.opencode/plugins/agentsys');
  }

  // Copy to ~/.agentsys first (OpenCode needs local files)
  copyToAgentSys();

  // Copy native plugin (OpenCode expects plugins as single .ts files in ~/.config/opencode/plugins/)
  const pluginSrcDir = path.join(SOURCE_DIR, 'adapters', 'opencode-plugin');
  if (fs.existsSync(pluginSrcDir)) {
    const srcPath = path.join(pluginSrcDir, 'index.ts');
    const destPath = path.join(pluginDir, 'agentsys.ts');
    // Remove legacy plugin file from pre-rename installs to prevent dual loading
    const legacyPluginFile = path.join(pluginDir, 'awesome-slash.ts');
    if (fs.existsSync(legacyPluginFile)) {
      fs.unlinkSync(legacyPluginFile);
    }
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      log('  [OK] Native plugin');
    }
  }

  // Discover command mappings from filesystem
  const commandMappings = discovery.getCommandMappings(SOURCE_DIR);

  for (const [target, plugin, source] of commandMappings) {
    const srcPath = path.join(SOURCE_DIR, 'plugins', plugin, 'commands', source);
    const destPath = path.join(commandsDir, target);
    if (fs.existsSync(srcPath)) {
      let content = fs.readFileSync(srcPath, 'utf8');
      content = transforms.transformBodyForOpenCode(content, SOURCE_DIR);
      content = transforms.transformCommandFrontmatterForOpenCode(content);
      fs.writeFileSync(destPath, content);
    }
  }
  log('  [OK] Commands');

  // Copy agents (strip models by default, use full body transform)
  let agentCount = 0;
  for (const plugin of PLUGINS) {
    const srcAgentsDir = path.join(SOURCE_DIR, 'plugins', plugin, 'agents');
    if (fs.existsSync(srcAgentsDir)) {
      const agentFiles = fs.readdirSync(srcAgentsDir).filter(f => f.endsWith('.md'));
      for (const agentFile of agentFiles) {
        const srcPath = path.join(srcAgentsDir, agentFile);
        const destPath = path.join(agentsDir, agentFile);
        let content = fs.readFileSync(srcPath, 'utf8');

        content = transforms.transformBodyForOpenCode(content, SOURCE_DIR);
        content = transforms.transformAgentFrontmatterForOpenCode(content, { stripModels: true });

        fs.writeFileSync(destPath, content);
        agentCount++;
      }
    }
  }
  log(`  [OK] ${agentCount} agents`);
  log('OpenCode installation complete.');
  return true;
}

function installCodex() {
  log('Installing for Codex CLI...');

  const configDir = CODEX_DIR;
  const skillsDir = path.join(configDir, 'skills');

  fs.mkdirSync(configDir, { recursive: true });
  fs.mkdirSync(skillsDir, { recursive: true });

  // Copy to ~/.agentsys first
  copyToAgentSys();

  // Discover skill mappings from filesystem (descriptions from codex-description frontmatter)
  const skillMappings = discovery.getCodexSkillMappings(SOURCE_DIR);

  for (const [skillName, plugin, sourceFile, description] of skillMappings) {
    const srcPath = path.join(SOURCE_DIR, 'plugins', plugin, 'commands', sourceFile);
    const skillDir = path.join(skillsDir, skillName);
    const destPath = path.join(skillDir, 'SKILL.md');

    if (fs.existsSync(srcPath)) {
      if (fs.existsSync(skillDir)) {
        fs.rmSync(skillDir, { recursive: true, force: true });
      }
      fs.mkdirSync(skillDir, { recursive: true });

      let content = fs.readFileSync(srcPath, 'utf8');
      const pluginInstallPath = path.join(AGENTSYS_DIR, 'plugins', plugin);
      content = transforms.transformForCodex(content, {
        skillName,
        description,
        pluginInstallPath
      });

      fs.writeFileSync(destPath, content);
      log(`  [OK] ${skillName}`);
    }
  }

  log('Codex installation complete.');
  return true;
}

let agentSysCopied = false;
function copyToAgentSys() {
  if (agentSysCopied) return;

  log('Copying to ~/.agentsys...');

  if (fs.existsSync(AGENTSYS_DIR)) {
    fs.rmSync(AGENTSYS_DIR, { recursive: true, force: true });
  }

  fs.cpSync(SOURCE_DIR, AGENTSYS_DIR, {
    recursive: true,
    filter: (src) => {
      const basename = path.basename(src);
      return basename !== 'node_modules' && basename !== '.git';
    }
  });

  // Install dependencies
  log('  Installing dependencies...');
  execSync('npm install --production', { cwd: AGENTSYS_DIR, stdio: 'pipe' });

  agentSysCopied = true;
  log('  [OK] ~/.agentsys');
}

function main() {
  const args = process.argv.slice(2);

  console.log(`\n[dev-install] agentsys v${VERSION}\n`);

  // Handle --clean flag
  if (args.includes('--clean')) {
    cleanAll();
    console.log();
    return;
  }

  // Determine which tools to install
  const validTools = ['claude', 'opencode', 'codex'];
  let tools = args.filter(a => validTools.includes(a.toLowerCase())).map(a => a.toLowerCase());

  if (tools.length === 0) {
    // Default: install to all tools
    tools = validTools;
  }

  log(`Installing to: ${tools.join(', ')}\n`);

  const results = {};

  for (const tool of tools) {
    switch (tool) {
      case 'claude':
        results.claude = installClaude();
        break;
      case 'opencode':
        results.opencode = installOpenCode();
        break;
      case 'codex':
        results.codex = installCodex();
        break;
    }
    console.log();
  }

  // Summary
  console.log('─'.repeat(50));
  log('Summary:');
  for (const [tool, success] of Object.entries(results)) {
    log(`  ${tool}: ${success ? '[OK]' : '[SKIP]'}`);
  }
  console.log();
  log('To clean all: node scripts/dev-install.js --clean');
  log('To revert Claude to marketplace: agentsys --tool claude');
  console.log();
}

if (require.main === module) {
  main();
}

module.exports = { main };
