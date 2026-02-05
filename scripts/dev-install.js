#!/usr/bin/env node
/**
 * Development installer for awesome-slash
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

// Target directories
const HOME = process.env.HOME || process.env.USERPROFILE;
const CLAUDE_PLUGINS_DIR = path.join(HOME, '.claude', 'plugins');

/**
 * Get OpenCode config directory following XDG Base Directory Specification.
 * OpenCode uses ~/.config/opencode/ by default, or $XDG_CONFIG_HOME/opencode if set.
 */
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
const AWESOME_SLASH_DIR = path.join(HOME, '.awesome-slash');

// Plugins list
const PLUGINS = ['next-task', 'ship', 'deslop', 'audit-project', 'drift-detect', 'enhance', 'sync-docs', 'repo-map', 'perf'];

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

/**
 * Clean all installations
 */
function cleanAll() {
  log('Cleaning all installations...');

  // Clean Claude plugins
  for (const plugin of PLUGINS) {
    const pluginDir = path.join(CLAUDE_PLUGINS_DIR, `${plugin}@awesome-slash`);
    if (fs.existsSync(pluginDir)) {
      fs.rmSync(pluginDir, { recursive: true, force: true });
      log(`  Removed Claude plugin: ${plugin}`);
    }
  }

  // Clean OpenCode (correct XDG path: ~/.config/opencode/)
  // OpenCode expects commands directly in commands/, not a subdirectory
  const opencodeCommandsDir = path.join(OPENCODE_CONFIG_DIR, 'commands');
  const opencodePluginDir = path.join(OPENCODE_CONFIG_DIR, 'plugins');
  const opencodeAgentsDir = path.join(OPENCODE_CONFIG_DIR, 'agents');
  // Note: Skills cleanup not implemented yet - would need skill list similar to agents

  // List of agent filenames we install (from plugins/*/agents/*.md)
  // Generated from: ls plugins/*/agents/*.md | xargs basename | sort -u
  const knownAgents = [
    'agent-enhancer.md', 'ci-fixer.md', 'ci-monitor.md', 'claudemd-enhancer.md',
    'delivery-validator.md', 'deslop-agent.md', 'docs-enhancer.md', 'enhancement-orchestrator.md',
    'exploration-agent.md', 'hooks-enhancer.md', 'implementation-agent.md', 'learn-agent.md',
    'map-validator.md', 'perf-analyzer.md', 'perf-code-paths.md', 'perf-investigation-logger.md',
    'perf-orchestrator.md', 'perf-theory-gatherer.md', 'perf-theory-tester.md', 'plan-synthesizer.md',
    'planning-agent.md', 'plugin-enhancer.md', 'prompt-enhancer.md', 'simple-fixer.md',
    'skills-enhancer.md', 'sync-docs-agent.md', 'task-discoverer.md', 'test-coverage-checker.md',
    'worktree-manager.md'
  ];

  // Known commands we install
  const knownCommands = [
    'deslop.md', 'enhance.md', 'next-task.md', 'delivery-approval.md',
    'sync-docs.md', 'audit-project.md', 'ship.md', 'drift-detect.md',
    'repo-map.md', 'perf.md'
  ];

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

  // Clean plugin file
  const pluginFile = path.join(opencodePluginDir, 'awesome-slash.ts');
  if (fs.existsSync(pluginFile)) {
    fs.unlinkSync(pluginFile);
    log('  Removed OpenCode plugin');
  }

  // Clean agent files installed by us - only known awesome-slash agents
  if (fs.existsSync(opencodeAgentsDir)) {
    let removedCount = 0;
    for (const file of knownAgents) {
      const filePath = path.join(opencodeAgentsDir, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        removedCount++;
      }
    }
    if (removedCount > 0) {
      log(`  Removed ${removedCount} OpenCode agents`);
    }
  }

  // Clean legacy OpenCode paths (~/.opencode/ - incorrect, pre-XDG)
  const legacyCommandsDir = path.join(LEGACY_OPENCODE_DIR, 'commands', 'awesome-slash');
  const legacyPluginDir = path.join(LEGACY_OPENCODE_DIR, 'plugins', 'awesome-slash');
  const legacyAgentsDir = path.join(LEGACY_OPENCODE_DIR, 'agents');

  if (fs.existsSync(legacyCommandsDir)) {
    fs.rmSync(legacyCommandsDir, { recursive: true, force: true });
    log('  Removed legacy ~/.opencode/commands/awesome-slash');
  }
  if (fs.existsSync(legacyPluginDir)) {
    fs.rmSync(legacyPluginDir, { recursive: true, force: true });
    log('  Removed legacy ~/.opencode/plugins/awesome-slash');
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
    for (const skill of fs.readdirSync(codexSkillsDir)) {
      const skillPath = path.join(codexSkillsDir, skill);
      // Only remove skills we know are ours
      if (['next-task', 'ship', 'deslop', 'audit-project', 'drift-detect', 'enhance', 'sync-docs', 'repo-map', 'perf', 'delivery-approval'].includes(skill)) {
        fs.rmSync(skillPath, { recursive: true, force: true });
        log(`  Removed Codex skill: ${skill}`);
      }
    }
  }

  // Clean ~/.awesome-slash
  if (fs.existsSync(AWESOME_SLASH_DIR)) {
    fs.rmSync(AWESOME_SLASH_DIR, { recursive: true, force: true });
    log('  Removed ~/.awesome-slash');
  }

  log('Clean complete.');
}

/**
 * Install for Claude in development mode
 */
function installClaude() {
  log('Installing for Claude Code (development mode)...');

  if (!commandExists('claude')) {
    log('  [SKIP] Claude CLI not found');
    return false;
  }

  // Remove marketplace plugins first
  try {
    execSync('claude plugin marketplace remove avifenesh/awesome-slash', { stdio: 'pipe' });
    log('  Removed marketplace');
  } catch {
    // May not exist
  }

  for (const plugin of PLUGINS) {
    try {
      execSync(`claude plugin uninstall ${plugin}@awesome-slash`, { stdio: 'pipe' });
    } catch {
      // May not be installed
    }
  }

  // Create plugins directory
  fs.mkdirSync(CLAUDE_PLUGINS_DIR, { recursive: true });

  // Copy each plugin directly from source
  const installedPlugins = {};
  for (const plugin of PLUGINS) {
    const srcDir = path.join(SOURCE_DIR, 'plugins', plugin);
    const destDir = path.join(CLAUDE_PLUGINS_DIR, `${plugin}@awesome-slash`);

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
      installedPlugins[`${plugin}@awesome-slash`] = {
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
        settings.enabledPlugins[`${plugin}@awesome-slash`] = true;
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

/**
 * Install for OpenCode
 */
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
  const legacyCommandsDir = path.join(LEGACY_OPENCODE_DIR, 'commands', 'awesome-slash');
  const legacyPluginDir = path.join(LEGACY_OPENCODE_DIR, 'plugins', 'awesome-slash');
  if (fs.existsSync(legacyCommandsDir)) {
    fs.rmSync(legacyCommandsDir, { recursive: true, force: true });
    log('  Cleaned up legacy ~/.opencode/commands/awesome-slash');
  }
  if (fs.existsSync(legacyPluginDir)) {
    fs.rmSync(legacyPluginDir, { recursive: true, force: true });
    log('  Cleaned up legacy ~/.opencode/plugins/awesome-slash');
  }

  // Copy to ~/.awesome-slash first (OpenCode needs local files)
  copyToAwesomeSlash();

  // Copy native plugin (OpenCode expects plugins as single .ts files in ~/.config/opencode/plugins/)
  const pluginSrcDir = path.join(SOURCE_DIR, 'adapters', 'opencode-plugin');
  if (fs.existsSync(pluginSrcDir)) {
    const srcPath = path.join(pluginSrcDir, 'index.ts');
    const destPath = path.join(pluginDir, 'awesome-slash.ts');
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      log('  [OK] Native plugin');
    }
  }

  // Transform helpers
  function transformForOpenCode(content) {
    content = content.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, '${PLUGIN_ROOT}');
    content = content.replace(/\$CLAUDE_PLUGIN_ROOT/g, '$PLUGIN_ROOT');
    content = content.replace(/\.claude\//g, '.opencode/');
    content = content.replace(/\.claude'/g, ".opencode'");
    content = content.replace(/\.claude"/g, '.opencode"');
    content = content.replace(/\.claude`/g, '.opencode`');
    return content;
  }

  function transformCommandFrontmatter(content) {
    return content.replace(
      /^---\n([\s\S]*?)^---/m,
      (match, frontmatter) => {
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
        let opencodeFrontmatter = '---\n';
        if (parsed.description) opencodeFrontmatter += `description: ${parsed.description}\n`;
        opencodeFrontmatter += 'agent: general\n---';
        return opencodeFrontmatter;
      }
    );
  }

  // Copy commands
  const commandMappings = [
    ['deslop.md', 'deslop', 'deslop.md'],
    ['enhance.md', 'enhance', 'enhance.md'],
    ['next-task.md', 'next-task', 'next-task.md'],
    ['delivery-approval.md', 'next-task', 'delivery-approval.md'],
    ['sync-docs.md', 'sync-docs', 'sync-docs.md'],
    ['audit-project.md', 'audit-project', 'audit-project.md'],
    ['ship.md', 'ship', 'ship.md'],
    ['drift-detect.md', 'drift-detect', 'drift-detect.md'],
    ['repo-map.md', 'repo-map', 'repo-map.md'],
    ['perf.md', 'perf', 'perf.md']
  ];

  for (const [target, plugin, source] of commandMappings) {
    const srcPath = path.join(SOURCE_DIR, 'plugins', plugin, 'commands', source);
    const destPath = path.join(commandsDir, target);
    if (fs.existsSync(srcPath)) {
      let content = fs.readFileSync(srcPath, 'utf8');
      content = transformForOpenCode(content);
      content = transformCommandFrontmatter(content);
      fs.writeFileSync(destPath, content);
    }
  }
  log('  [OK] Commands');

  // Copy agents (strip models by default)
  let agentCount = 0;
  for (const plugin of PLUGINS) {
    const srcAgentsDir = path.join(SOURCE_DIR, 'plugins', plugin, 'agents');
    if (fs.existsSync(srcAgentsDir)) {
      const agentFiles = fs.readdirSync(srcAgentsDir).filter(f => f.endsWith('.md'));
      for (const agentFile of agentFiles) {
        const srcPath = path.join(srcAgentsDir, agentFile);
        const destPath = path.join(agentsDir, agentFile);
        let content = fs.readFileSync(srcPath, 'utf8');

        content = transformForOpenCode(content);

        // Transform agent frontmatter (strip models)
        content = content.replace(
          /^---\n([\s\S]*?)^---/m,
          (match, frontmatter) => {
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

            let opencodeFrontmatter = '---\n';
            if (parsed.name) opencodeFrontmatter += `name: ${parsed.name}\n`;
            if (parsed.description) opencodeFrontmatter += `description: ${parsed.description}\n`;
            opencodeFrontmatter += 'mode: subagent\n';
            // NOTE: Models are stripped by default for dev installs

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
  log(`  [OK] ${agentCount} agents`);
  log('OpenCode installation complete.');
  return true;
}

/**
 * Install for Codex
 */
function installCodex() {
  log('Installing for Codex CLI...');

  const configDir = CODEX_DIR;
  const skillsDir = path.join(configDir, 'skills');

  fs.mkdirSync(configDir, { recursive: true });
  fs.mkdirSync(skillsDir, { recursive: true });

  // Copy to ~/.awesome-slash first
  copyToAwesomeSlash();

  // Skill mappings
  const skillMappings = [
    ['enhance', 'enhance', 'enhance.md', 'Runs enhancement analyzers on prompts, agents, plugins, docs.'],
    ['next-task', 'next-task', 'next-task.md', 'Orchestrates complete task-to-production workflow.'],
    ['ship', 'ship', 'ship.md', 'Complete PR workflow: commit, create PR, monitor CI, merge.'],
    ['deslop', 'deslop', 'deslop.md', 'Detects and removes AI-generated slop patterns.'],
    ['audit-project', 'audit-project', 'audit-project.md', 'Multi-agent iterative code review.'],
    ['drift-detect', 'drift-detect', 'drift-detect.md', 'Analyzes documentation vs actual code.'],
    ['repo-map', 'repo-map', 'repo-map.md', 'Builds AST-based repo map using ast-grep.'],
    ['perf', 'perf', 'perf.md', 'Structured perf investigations with baselines.'],
    ['delivery-approval', 'next-task', 'delivery-approval.md', 'Autonomous validation for shipping.'],
    ['sync-docs', 'sync-docs', 'sync-docs.md', 'Compares documentation to actual code.']
  ];

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

      const escapedDescription = description.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const yamlDescription = `"${escapedDescription}"`;

      if (content.startsWith('---')) {
        content = content.replace(
          /^---\n[\s\S]*?\n---\n/,
          `---\nname: ${skillName}\ndescription: ${yamlDescription}\n---\n`
        );
      } else {
        content = `---\nname: ${skillName}\ndescription: ${yamlDescription}\n---\n\n${content}`;
      }

      // Use absolute path to local install
      const pluginInstallPath = path.join(AWESOME_SLASH_DIR, 'plugins', plugin);
      content = content.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, pluginInstallPath);
      content = content.replace(/\$CLAUDE_PLUGIN_ROOT/g, pluginInstallPath);
      content = content.replace(/\$\{PLUGIN_ROOT\}/g, pluginInstallPath);
      content = content.replace(/\$PLUGIN_ROOT/g, pluginInstallPath);

      fs.writeFileSync(destPath, content);
      log(`  [OK] ${skillName}`);
    }
  }

  log('Codex installation complete.');
  return true;
}

/**
 * Copy source to ~/.awesome-slash (for OpenCode/Codex)
 */
let awesomeSlashCopied = false;
function copyToAwesomeSlash() {
  if (awesomeSlashCopied) return;

  log('Copying to ~/.awesome-slash...');

  if (fs.existsSync(AWESOME_SLASH_DIR)) {
    fs.rmSync(AWESOME_SLASH_DIR, { recursive: true, force: true });
  }

  fs.cpSync(SOURCE_DIR, AWESOME_SLASH_DIR, {
    recursive: true,
    filter: (src) => {
      const basename = path.basename(src);
      return basename !== 'node_modules' && basename !== '.git';
    }
  });

  // Install dependencies
  log('  Installing dependencies...');
  execSync('npm install --production', { cwd: AWESOME_SLASH_DIR, stdio: 'pipe' });

  awesomeSlashCopied = true;
  log('  [OK] ~/.awesome-slash');
}

/**
 * Main
 */
function main() {
  const args = process.argv.slice(2);

  console.log(`\n[dev-install] awesome-slash v${VERSION}\n`);

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
  log('To revert Claude to marketplace: awesome-slash --tool claude');
  console.log();
}

main();
