/**
 * Plugin Discovery Module
 *
 * Convention-based filesystem scanning to discover plugins, commands,
 * agents, and skills. Replaces all hardcoded registration lists.
 *
 * Convention:
 * - plugins/<name>/.claude-plugin/plugin.json -> plugin
 * - plugins/<name>/commands/*.md -> commands
 * - plugins/<name>/agents/*.md -> agents
 * - plugins/<name>/skills/<skill>/SKILL.md -> skills
 *
 * @module discovery
 * @author Avi Fenesh
 * @license MIT
 */

const fs = require('fs');
const path = require('path');

// Module-level cache
let _cache = null;
let _cacheRoot = null;

/**
 * Parse YAML frontmatter from a markdown file's content.
 * Returns an object of key-value pairs from the frontmatter block.
 *
 * @param {string} content - File content
 * @returns {Object} Parsed frontmatter key-value pairs
 */
function parseFrontmatter(content) {
  if (!content || !content.startsWith('---')) {
    return {};
  }
  const endIdx = content.indexOf('\n---', 3);
  if (endIdx === -1) {
    return {};
  }
  const frontmatterBlock = content.substring(4, endIdx);
  const result = {};
  const lines = frontmatterBlock.split('\n');
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.substring(0, colonIdx).trim();
      let value = line.substring(colonIdx + 1).trim();
      // Strip surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
  }
  return result;
}

/**
 * Validate a plugin/directory name is safe for filesystem and shell use.
 * Only allows lowercase letters, digits, and hyphens.
 *
 * @param {string} name - Directory name to validate
 * @returns {boolean}
 */
function isValidPluginName(name) {
  return /^[a-z0-9][a-z0-9-]*$/.test(name);
}

/**
 * Resolve the plugins directory from a repo root.
 *
 * @param {string} [repoRoot] - Repository root path. Defaults to two levels up from this file.
 * @returns {string} Absolute path to plugins/ directory
 */
function resolvePluginsDir(repoRoot) {
  if (!repoRoot) {
    repoRoot = path.resolve(__dirname, '..', '..');
  }
  return path.join(repoRoot, 'plugins');
}

/**
 * Discover all plugins by scanning plugins/ for directories with .claude-plugin/plugin.json.
 *
 * @param {string} [repoRoot] - Repository root path
 * @returns {string[]} Sorted array of plugin names
 */
function discoverPlugins(repoRoot) {
  const cached = getCache(repoRoot);
  if (cached && cached.plugins) return cached.plugins;

  const pluginsDir = resolvePluginsDir(repoRoot);
  if (!fs.existsSync(pluginsDir)) return [];

  const entries = fs.readdirSync(pluginsDir);
  const plugins = entries.filter(name => {
    if (!isValidPluginName(name)) return false;
    const pluginJson = path.join(pluginsDir, name, '.claude-plugin', 'plugin.json');
    return fs.existsSync(pluginJson);
  }).sort();

  setCache(repoRoot, 'plugins', plugins);
  return plugins;
}

/**
 * Discover all commands by scanning plugins/<name>/commands/*.md.
 *
 * @param {string} [repoRoot] - Repository root path
 * @returns {Array<{name: string, plugin: string, file: string, frontmatter: Object}>}
 */
function discoverCommands(repoRoot) {
  const cached = getCache(repoRoot);
  if (cached && cached.commands) return cached.commands;

  const pluginsDir = resolvePluginsDir(repoRoot);
  const plugins = discoverPlugins(repoRoot);
  const commands = [];

  for (const plugin of plugins) {
    const commandsDir = path.join(pluginsDir, plugin, 'commands');
    if (!fs.existsSync(commandsDir)) continue;

    const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.md')).sort();
    for (const file of files) {
      const filePath = path.join(commandsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const frontmatter = parseFrontmatter(content);
      commands.push({
        name: file.replace(/\.md$/, ''),
        plugin,
        file,
        frontmatter
      });
    }
  }

  setCache(repoRoot, 'commands', commands);
  return commands;
}

/**
 * Discover all file-based agents by scanning plugins/<name>/agents/*.md.
 *
 * @param {string} [repoRoot] - Repository root path
 * @returns {Array<{name: string, plugin: string, file: string}>}
 */
function discoverAgents(repoRoot) {
  const cached = getCache(repoRoot);
  if (cached && cached.agents) return cached.agents;

  const pluginsDir = resolvePluginsDir(repoRoot);
  const plugins = discoverPlugins(repoRoot);
  const agents = [];

  for (const plugin of plugins) {
    const agentsDir = path.join(pluginsDir, plugin, 'agents');
    if (!fs.existsSync(agentsDir)) continue;

    const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md')).sort();
    for (const file of files) {
      agents.push({
        name: file.replace(/\.md$/, ''),
        plugin,
        file
      });
    }
  }

  setCache(repoRoot, 'agents', agents);
  return agents;
}

/**
 * Discover all skills by scanning plugins/<name>/skills/<skill>/SKILL.md.
 *
 * @param {string} [repoRoot] - Repository root path
 * @returns {Array<{name: string, plugin: string, dir: string}>}
 */
function discoverSkills(repoRoot) {
  const cached = getCache(repoRoot);
  if (cached && cached.skills) return cached.skills;

  const pluginsDir = resolvePluginsDir(repoRoot);
  const plugins = discoverPlugins(repoRoot);
  const skills = [];

  for (const plugin of plugins) {
    const skillsDir = path.join(pluginsDir, plugin, 'skills');
    if (!fs.existsSync(skillsDir)) continue;

    const entries = fs.readdirSync(skillsDir).sort();
    for (const entry of entries) {
      const skillFile = path.join(skillsDir, entry, 'SKILL.md');
      if (fs.existsSync(skillFile)) {
        skills.push({
          name: entry,
          plugin,
          dir: entry
        });
      }
    }
  }

  setCache(repoRoot, 'skills', skills);
  return skills;
}

/**
 * Build OpenCode command mappings from discovered commands.
 * Returns [targetFile, pluginName, sourceFile] tuples.
 *
 * @param {string} [repoRoot] - Repository root path
 * @returns {Array<[string, string, string]>}
 */
function getCommandMappings(repoRoot) {
  const commands = discoverCommands(repoRoot);
  return commands.map(cmd => [cmd.file, cmd.plugin, cmd.file]);
}

/**
 * Build Codex skill mappings from discovered commands.
 * Returns [skillName, pluginName, sourceFile, description] tuples.
 * Uses codex-description frontmatter field, falls back to description.
 *
 * @param {string} [repoRoot] - Repository root path
 * @returns {Array<[string, string, string, string]>}
 */
function getCodexSkillMappings(repoRoot) {
  const commands = discoverCommands(repoRoot);
  return commands.map(cmd => {
    const description = cmd.frontmatter['codex-description'] ||
                        cmd.frontmatter.description ||
                        '';
    return [cmd.name, cmd.plugin, cmd.file, description];
  });
}

/**
 * Build a dynamic regex for stripping plugin prefixes from agent references.
 * Example: `next-task:agent-name` -> `agent-name`
 *
 * @param {string} [repoRoot] - Repository root path
 * @returns {RegExp} Regex matching plugin prefix patterns
 */
function getPluginPrefixRegex(repoRoot) {
  const plugins = discoverPlugins(repoRoot);
  if (plugins.length === 0) return /$^/g; // Matches nothing
  const escaped = plugins.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(${escaped.join('|')})`, 'g');
}

/**
 * Get all discovery results in a single call.
 *
 * @param {string} [repoRoot] - Repository root path
 * @returns {{plugins: string[], commands: Array, agents: Array, skills: Array}}
 */
function discoverAll(repoRoot) {
  return {
    plugins: discoverPlugins(repoRoot),
    commands: discoverCommands(repoRoot),
    agents: discoverAgents(repoRoot),
    skills: discoverSkills(repoRoot)
  };
}

// --- Cache helpers ---

function getCache(repoRoot) {
  const root = repoRoot || path.resolve(__dirname, '..', '..');
  if (_cache && _cacheRoot === root) return _cache;
  return null;
}

function setCache(repoRoot, key, value) {
  const root = repoRoot || path.resolve(__dirname, '..', '..');
  if (!_cache || _cacheRoot !== root) {
    _cache = {};
    _cacheRoot = root;
  }
  _cache[key] = value;
}

/**
 * Invalidate the module-level cache. Used for testing.
 */
function invalidateCache() {
  _cache = null;
  _cacheRoot = null;
}

module.exports = {
  parseFrontmatter,
  isValidPluginName,
  discoverPlugins,
  discoverCommands,
  discoverAgents,
  discoverSkills,
  discoverAll,
  getCommandMappings,
  getCodexSkillMappings,
  getPluginPrefixRegex,
  invalidateCache
};
