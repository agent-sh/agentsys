#!/usr/bin/env node
/**
 * Auto-Generate Documentation Sections from Plugin Source
 *
 * Reads plugin metadata via the discovery module and regenerates
 * marked sections in documentation files. Keeps docs in sync with
 * the actual filesystem without manual counting.
 *
 * Usage:
 *   node scripts/generate-docs.js           Write generated sections to files
 *   node scripts/generate-docs.js --check   Validate freshness (exit 1 if stale)
 *   node scripts/generate-docs.js --dry-run Show what would change without writing
 *
 * Exit codes:
 *   0 - Success (or up-to-date in --check mode)
 *   1 - Stale docs detected (--check mode) or write error
 *
 * @author Avi Fenesh
 * @license MIT
 */

const fs = require('fs');
const path = require('path');
const discovery = require(path.join(__dirname, '..', 'lib', 'discovery'));

const ROOT_DIR = path.join(__dirname, '..');

// Category mapping for skills table grouping
const CATEGORY_MAP = {
  'foreman': 'Workflow',
  'deslop': 'Cleanup',
  'banthis': 'Memory',
  'learn': 'AI Collaboration',
  'agnix': 'Linting',
  'skillers': 'AI Collaboration',
  'skill-curator': 'Enhancement',
  'system-prompt-curator': 'Enhancement',
  'glidemq': 'Message Queues',
  'mojo': 'Languages',
  'ada-spark': 'Languages'
};

// Static skill definitions for cross-repo plugins (not discoverable locally)
const STATIC_SKILLS = [
  { plugin: 'foreman', name: 'foreman' },
  { plugin: 'deslop', name: 'deslop' },
  { plugin: 'banthis', name: 'banthis' },
  { plugin: 'learn', name: 'learn' },
  { plugin: 'skill-curator', name: 'skill-curator' },
  { plugin: 'system-prompt-curator', name: 'system-prompt-curator' },
  { plugin: 'skillers', name: 'skillers-compact' },
  { plugin: 'skillers', name: 'recommend' },
  { plugin: 'mojo', name: 'mojo' },
  { plugin: 'ada-spark', name: 'ada-spark' },
  { plugin: 'glidemq', name: 'glide-mq' },
  { plugin: 'glidemq', name: 'glide-mq-migrate-bullmq' },
  { plugin: 'glidemq', name: 'glide-mq-migrate-bee' },
  { plugin: 'agnix', name: 'agnix' }
];

// Purpose mapping for architecture table
const PURPOSE_MAP = {
  'deslop': 'AI slop cleanup',
  'banthis': 'Durable negative behavior memory',
  'learn': 'Topic research and learning guides',
  'agnix': 'Agent config linting',
  'skillers': 'Workflow pattern learning',
  'skill-curator': 'Skill authoring and review',
  'system-prompt-curator': 'System prompt curation',
  'foreman': 'GitHub issue queue for native agents'
};

// ---------------------------------------------------------------------------
// Marker injection
// ---------------------------------------------------------------------------

/**
 * Replace content between GEN:START and GEN:END markers.
 *
 * @param {string} content - Full file content
 * @param {string} section - Section name (e.g. 'readme-commands')
 * @param {string} newContent - New content to inject between markers
 * @returns {string} Updated content, or original if markers not found
 */
function injectBetweenMarkers(content, section, newContent) {
  const startMarker = `<!-- GEN:START:${section} -->`;
  const endMarker = `<!-- GEN:END:${section} -->`;

  const startIdx = content.indexOf(startMarker);
  const endIdx = content.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return content;
  }

  const before = content.substring(0, startIdx + startMarker.length);
  const after = content.substring(endIdx);

  return before + '\n' + newContent + '\n' + after;
}

// ---------------------------------------------------------------------------
// Table generators
// ---------------------------------------------------------------------------

/**
 * Generate the commands table for README.md.
 */
function generateCommandsTable(commands) {
  const lines = [
    '| Command | What it does |',
    '|---------|--------------|'
  ];

  // Curated display order (featured commands first, then alphabetical)
  const COMMAND_ORDER = [
    'foreman',
    'banthis', 'agnix', 'deslop',
    'learn', 'skillers',
    'skill-curator', 'system-prompt-curator'
  ];

  // Command descriptions for the table (short, human-written summaries)
  const COMMAND_SUMMARIES = {
    'banthis': 'Durable negative memory: persist banned agent behaviors',
    'agnix': 'Lint agent configurations (757 rules)',
    'deslop': 'Clean AI slop patterns',
    'learn': 'Research topics, create learning guides',
    'skillers': 'Workflow pattern learning and automation',
    'skill-curator': 'Create and improve reliable SKILL.md files',
    'system-prompt-curator': 'Create and improve autonomous agent system prompts',
    'foreman': 'Work the GitHub issue queue with native subagents, from pick to land'
  };

  // Build lookup of discovered commands
  const cmdMap = {};
  for (const cmd of commands) {
    if (!cmdMap[cmd.name]) cmdMap[cmd.name] = cmd;
  }

  // Emit in curated order. Prefer curated summaries; fall back to discovered frontmatter.
  const emitted = new Set();
  for (const name of COMMAND_ORDER) {
    let summary = COMMAND_SUMMARIES[name] || '';
    if (!summary && cmdMap[name]) {
      summary = cmdMap[name].frontmatter.description || '';
    }
    if (!summary && !cmdMap[name]) continue;
    emitted.add(name);
    lines.push(`| [\`/${name}\`](#${name}) | ${summary} |`);
  }

  // Any commands discovered but not in curated order (future-proof)
  for (const cmd of commands) {
    if (emitted.has(cmd.name)) continue;
    if (!COMMAND_SUMMARIES[cmd.name] && cmd.name !== cmd.plugin) continue;
    emitted.add(cmd.name);
    const summary = COMMAND_SUMMARIES[cmd.name] || cmd.frontmatter.description || '';
    lines.push(`| [\`/${cmd.name}\`](#${cmd.name}) | ${summary} |`);
  }

  return lines.join('\n');
}

/**
 * Generate the skills table for README.md grouped by category.
 */
function generateSkillsTable(skills) {
  // Use static skills as fallback when discovery finds nothing (cross-repo plugins)
  const effectiveSkills = skills.length > 0 ? skills : STATIC_SKILLS;
  const totalSkills = effectiveSkills.length;

  // Group skills by category
  const groups = {};
  for (const skill of effectiveSkills) {
    const category = CATEGORY_MAP[skill.plugin] || 'Other';
    if (!groups[category]) groups[category] = [];
    groups[category].push(`\`${skill.name}\``);
  }

  // Sort skills within each group
  for (const cat of Object.keys(groups)) {
    groups[cat].sort();
  }

  // Defined category order
  const categoryOrder = [
    'Workflow', 'Message Queues', 'Enhancement', 'Performance', 'Cleanup',
    'Code Review', 'AI Collaboration', 'Onboarding',
    'Analysis', 'Memory', 'Linting', 'Languages', 'Other'
  ];

  const lines = [
    `${totalSkills} skills included across the plugins:`,
    '',
    '| Category | Skills |',
    '|----------|--------|'
  ];

  for (const cat of categoryOrder) {
    if (!groups[cat]) continue;
    lines.push(`| **${cat}** | ${groups[cat].join(', ')} |`);
  }

  return lines.join('\n');
}

/**
 * Generate the architecture table for AGENTS.md.
 */
function generateArchitectureTable(plugins, agents, skills) {
  const effectivePlugins = plugins.length > 0 ? plugins : Object.keys(STATIC_PLUGIN_AGENT_COUNTS);
  const effectiveSkills = skills.length > 0 ? skills : STATIC_SKILLS;
  const totalAgents = agents.length > 0 ? agents.length : STATIC_AGENT_COUNT;
  const totalSkills = effectiveSkills.length;

  // Count agents per plugin
  const agentsByPlugin = {};
  if (agents.length > 0) {
    for (const agent of agents) {
      agentsByPlugin[agent.plugin] = (agentsByPlugin[agent.plugin] || 0) + 1;
    }
  } else {
    Object.assign(agentsByPlugin, STATIC_PLUGIN_AGENT_COUNTS);
  }
  // Count skills per plugin
  const skillsByPlugin = {};
  for (const skill of effectiveSkills) {
    skillsByPlugin[skill.plugin] = (skillsByPlugin[skill.plugin] || 0) + 1;
  }

  const lines = [
    '```',
    'lib/          \u2192 Shared library (vendored to plugins)',
    `plugins/      \u2192 ${effectivePlugins.length} plugins, ${totalAgents} agents, ${totalSkills} skills`,
    'adapters/     \u2192 Platform adapters (opencode-plugin/, opencode/, codex/)',
    'checklists/   \u2192 Action checklists (9 files)',
    'bin/cli.js    \u2192 npm CLI installer',
    '```',
    '',
    '| Plugin | Agents | Skills | Purpose |',
    '|--------|--------|--------|---------|'
  ];

  for (const plugin of effectivePlugins) {
    const agentCount = agentsByPlugin[plugin] || 0;
    const skillCount = skillsByPlugin[plugin] || 0;
    const purpose = PURPOSE_MAP[plugin] || '';
    lines.push(`| ${plugin} | ${agentCount} | ${skillCount} | ${purpose} |`);
  }

  return lines.join('\n');
}

/**
 * Generate the agent navigation table for docs/reference/AGENTS.md.
 */
function generateAgentNavTable(agents, plugins) {
  const lines = [
    '| Plugin | Agents | Jump to |',
    '|--------|--------|---------|'
  ];

  // Group agents by plugin
  const agentsByPlugin = {};
  for (const agent of agents) {
    if (!agentsByPlugin[agent.plugin]) agentsByPlugin[agent.plugin] = [];
    agentsByPlugin[agent.plugin].push(agent.name);
  }

  for (const plugin of plugins) {
    const agentNames = agentsByPlugin[plugin] || [];
    const count = agentNames.length;

    if (count === 0) continue;

    const jumpLinks = agentNames
      .map(name => `[${name}](#${name})`)
      .join(', ');

    lines.push(`| ${plugin} | ${count} | ${jumpLinks} |`);
  }

  return lines.join('\n');
}

/**
 * Generate the agents count summary line for docs/reference/AGENTS.md.
 *
 * Uses static fallbacks when local discovery returns nothing: the agentsys
 * monorepo no longer contains plugins/, so discovery is empty in CI. Static
 * counts are derived from STATIC_PLUGIN_AGENT_COUNTS so they stay in sync as
 * plugins are added.
 */
function generateAgentCounts(agents, plugins) {
  const totalAgents = agents.length > 0 ? agents.length : STATIC_AGENT_COUNT;
  const totalPlugins = plugins.length > 0 ? plugins.length : STATIC_PLUGIN_COUNT;

  const pluginsWithAgentsCount = agents.length > 0
    ? new Set(agents.map(a => a.plugin)).size
    : Object.values(STATIC_PLUGIN_AGENT_COUNTS).filter(c => c > 0).length;

  return `**TL;DR:** ${totalAgents} agents across ${totalPlugins} plugins (${pluginsWithAgentsCount} have agents). Each agent names a model family (opus, sonnet, haiku; currently Opus 5.5, Sonnet 5.5, Haiku 4.5) or inherits the caller's model, and does one thing. <!-- AGENT_COUNT_TOTAL: ${totalAgents} -->`;
}

// ---------------------------------------------------------------------------
// site/content.json updater
// ---------------------------------------------------------------------------

/**
 * Update counts in site/content.json programmatically.
 */
// Static counts for cross-repo plugins not discoverable locally.
// Per-plugin agent counts. Update this map when agents are added/removed
// in a plugin repo - it's the canonical source for the STATIC_AGENT_COUNT fallback.
const STATIC_PLUGIN_AGENT_COUNTS = {
  'foreman': 0,
  'deslop': 1,
  'banthis': 0,
  'learn': 1,
  'agnix': 1,
  'skill-curator': 0,
  'system-prompt-curator': 0,
  'skillers': 2,
  'zig-lsp': 0,
  'mojo': 0,
  'ada-spark': 0
};
const STATIC_PLUGIN_COUNT = Object.keys(STATIC_PLUGIN_AGENT_COUNTS).length;
const STATIC_AGENT_COUNT = Object.values(STATIC_PLUGIN_AGENT_COUNTS).reduce((sum, count) => sum + count, 0);

function updateSiteContent(plugins, agents, skills) {
  const contentPath = path.join(ROOT_DIR, 'site', 'content.json');
  if (!fs.existsSync(contentPath)) return null;

  const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));

  // Sync meta.version from package.json
  const pkgPath = path.join(ROOT_DIR, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (content.meta && pkg.version) {
      content.meta.version = pkg.version;
    }
  }

  // Use static counts as fallback (cross-repo plugins not discoverable locally)
  const effectivePlugins = plugins.length > 0 ? plugins.length : STATIC_PLUGIN_COUNT;
  const effectiveAgents = agents.length > 0 ? agents.length : STATIC_AGENT_COUNT;
  const effectiveSkills = skills.length > 0 ? skills.length : STATIC_SKILLS.length;

  // Update stats array
  if (content.stats && Array.isArray(content.stats)) {
    for (const stat of content.stats) {
      if (stat.label === 'Plugins') stat.value = String(effectivePlugins);
      if (stat.label === 'Agents') stat.value = String(effectiveAgents);
      if (stat.label === 'Skills') stat.value = String(effectiveSkills);
    }
  }

  // Update agents section
  if (content.agents) {
    content.agents.total = effectiveAgents;
  }

  return content;
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

// Section names mapped to the files they appear in
const FILE_MAP = {
  'README.md': ['readme-commands', 'readme-skills'],
  'AGENTS.md': ['claude-architecture'],
  'docs/reference/AGENTS.md': ['agents-nav', 'agents-counts']
};

/**
 * Core generation logic shared by main() and checkFreshness().
 * Discovers metadata, generates all sections, and compares against disk.
 *
 * @returns {{ sections: Object, siteContent: Object|null, staleFiles: string[], siteStale: boolean, plugins: Array, agents: Array, skills: Array }}
 */
function computeSections() {
  discovery.invalidateCache();

  const plugins = discovery.discoverPlugins(ROOT_DIR);
  const commands = discovery.discoverCommands(ROOT_DIR);
  const agents = discovery.discoverAgents(ROOT_DIR);
  const skills = discovery.discoverSkills(ROOT_DIR);

  const sections = {
    'readme-commands': generateCommandsTable(commands),
    'readme-skills': generateSkillsTable(skills),
    'claude-architecture': generateArchitectureTable(plugins, agents, skills),
    'agents-nav': generateAgentNavTable(agents, plugins),
    'agents-counts': generateAgentCounts(agents, plugins)
  };

  // Determine which files are stale
  const staleFiles = [];
  for (const [relPath, sectionNames] of Object.entries(FILE_MAP)) {
    const filePath = path.join(ROOT_DIR, relPath);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf8');
    for (const section of sectionNames) {
      const updated = injectBetweenMarkers(content, section, sections[section]);
      if (updated !== content) {
        staleFiles.push(relPath);
        break;
      }
    }
  }

  // Check site/content.json
  const siteContent = updateSiteContent(plugins, agents, skills);
  let siteStale = false;
  if (siteContent) {
    const siteContentPath = path.join(ROOT_DIR, 'site', 'content.json');
    if (fs.existsSync(siteContentPath)) {
      const currentJson = fs.readFileSync(siteContentPath, 'utf8');
      const newJson = JSON.stringify(siteContent, null, 2) + '\n';
      if (currentJson !== newJson) siteStale = true;
    }
  }

  return { sections, siteContent, staleFiles, siteStale, plugins, agents, skills };
}

/**
 * Run doc generation. Returns { changed: boolean, files: string[] }.
 *
 * @param {string[]} args - CLI arguments
 * @returns {{ changed: boolean, files: string[], diffs: Object[] }}
 */
function main(args) {
  args = args || [];
  const checkMode = args.includes('--check');
  const dryRun = args.includes('--dry-run');

  const { sections, siteContent, staleFiles, siteStale, plugins, agents, skills } = computeSections();
  const totalAgents = agents.length;

  if (!checkMode && !dryRun) {
    console.log(`[OK] Discovered: ${plugins.length} plugins, ${totalAgents} agents, ${skills.length} skills`);
  }

  const changedFiles = [];
  const diffs = [];

  // Process each file
  for (const [relPath, sectionNames] of Object.entries(FILE_MAP)) {
    const filePath = path.join(ROOT_DIR, relPath);
    if (!fs.existsSync(filePath)) {
      if (!checkMode) {
        console.log(`[WARN] ${relPath}: file not found, skipping`);
      }
      continue;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    for (const section of sectionNames) {
      const updated = injectBetweenMarkers(content, section, sections[section]);
      if (updated !== content) {
        content = updated;
        modified = true;
      }
    }

    if (modified) {
      changedFiles.push(relPath);
      diffs.push({ file: relPath, sections: sectionNames });

      if (!checkMode && !dryRun) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`[OK] Updated: ${relPath}`);
      } else if (dryRun) {
        console.log(`[CHANGE] Would update: ${relPath}`);
      }
    } else if (!checkMode && !dryRun) {
      console.log(`[OK] Up to date: ${relPath}`);
    }
  }

  // Update site/content.json
  if (siteStale && siteContent) {
    const siteContentPath = path.join(ROOT_DIR, 'site', 'content.json');
    const newJson = JSON.stringify(siteContent, null, 2) + '\n';

    changedFiles.push('site/content.json');
    diffs.push({ file: 'site/content.json', sections: ['stats', 'agents'] });

    if (!checkMode && !dryRun) {
      fs.writeFileSync(siteContentPath, newJson, 'utf8');
      console.log('[OK] Updated: site/content.json');
    } else if (dryRun) {
      console.log('[CHANGE] Would update: site/content.json');
    }
  } else if (siteContent && !checkMode && !dryRun) {
    console.log('[OK] Up to date: site/content.json');
  }

  // Summary
  const changed = changedFiles.length > 0;

  if (checkMode) {
    if (changed) {
      console.log(`[ERROR] Stale docs detected in ${changedFiles.length} file(s):`);
      for (const f of changedFiles) {
        console.log(`  - ${f}`);
      }
      console.log('\nRun: node scripts/generate-docs.js');
      return 1;
    }
    return 0;
  }

  if (!dryRun) {
    console.log(`\n[OK] ${changed ? changedFiles.length + ' file(s) updated' : 'All docs up to date'}`);
  }

  return { changed, files: changedFiles, diffs };
}

/**
 * Check if generated documentation is fresh. For preflight integration.
 *
 * @returns {{ status: string, message: string, staleFiles: string[] }}
 */
function checkFreshness() {
  const { staleFiles, siteStale } = computeSections();
  const allStale = siteStale ? [...staleFiles, 'site/content.json'] : staleFiles;

  if (allStale.length === 0) {
    return {
      status: 'fresh',
      message: 'All generated docs are up to date',
      staleFiles: []
    };
  }

  return {
    status: 'stale',
    message: `${allStale.length} file(s) have stale generated sections`,
    staleFiles: allStale
  };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);
  const result = main(args);

  // In --check mode, main returns an exit code number
  if (typeof result === 'number') {
    process.exit(result);
  }
}

module.exports = {
  main,
  checkFreshness,
  injectBetweenMarkers,
  generateCommandsTable,
  generateSkillsTable,
  generateArchitectureTable,
  generateAgentNavTable,
  generateAgentCounts,
  updateSiteContent,
  CATEGORY_MAP,
  PURPOSE_MAP,
  STATIC_SKILLS,
  STATIC_PLUGIN_AGENT_COUNTS,
  STATIC_PLUGIN_COUNT,
  STATIC_AGENT_COUNT
};
