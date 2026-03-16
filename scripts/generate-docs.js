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

// Role-based agents defined inline in audit-project (not file-based)
const ROLE_BASED_AGENT_COUNT = 10;

// audit-project role-based agent names (defined inline via Task tool).
// Canonical source: plugins/audit-project/commands/audit-project.md "Agent Selection" section.
// Must be kept in sync manually - validate-repo-consistency.js also parses these.
const AUDIT_ROLE_AGENTS = [
  'code-quality-reviewer',
  'security-expert',
  'performance-engineer',
  'test-quality-guardian',
  'architecture-reviewer',
  'database-specialist',
  'api-designer',
  'frontend-specialist',
  'backend-specialist',
  'devops-reviewer'
];

// Category mapping for skills table grouping
const CATEGORY_MAP = {
  'perf': 'Performance',
  'enhance': 'Enhancement',
  'next-task': 'Workflow',
  'deslop': 'Cleanup',
  'sync-docs': 'Cleanup',
  'drift-detect': 'Analysis',
  'repo-map': 'Analysis',
  'learn': 'AI Collaboration',
  'agnix': 'Linting',
  'consult': 'AI Collaboration',
  'debate': 'AI Collaboration',
  'skillers': 'AI Collaboration',
  'web-ctl': 'Web',
  'ship': 'Release',
  'git-map': 'Analysis',
  'onboard': 'Onboarding',
  'can-i-help': 'Onboarding',
  'audit-project': 'Code Review'
};

// Static skill definitions for cross-repo plugins (not discoverable locally)
const STATIC_SKILLS = [
  { plugin: 'next-task', name: 'orchestrate-review' },
  { plugin: 'next-task', name: 'discover-tasks' },
  { plugin: 'next-task', name: 'validate-delivery' },
  { plugin: 'enhance', name: 'enhance-orchestrator' },
  { plugin: 'enhance', name: 'enhance-plugins' },
  { plugin: 'enhance', name: 'enhance-agent-prompts' },
  { plugin: 'enhance', name: 'enhance-claude-memory' },
  { plugin: 'enhance', name: 'enhance-docs' },
  { plugin: 'enhance', name: 'enhance-prompts' },
  { plugin: 'enhance', name: 'enhance-hooks' },
  { plugin: 'enhance', name: 'enhance-skills' },
  { plugin: 'enhance', name: 'enhance-cross-file' },
  { plugin: 'perf', name: 'baseline' },
  { plugin: 'perf', name: 'benchmark' },
  { plugin: 'perf', name: 'profile' },
  { plugin: 'perf', name: 'theory-tester' },
  { plugin: 'perf', name: 'theory-gatherer' },
  { plugin: 'perf', name: 'code-paths' },
  { plugin: 'perf', name: 'investigation-logger' },
  { plugin: 'perf', name: 'perf-analyzer' },
  { plugin: 'deslop', name: 'deslop' },
  { plugin: 'sync-docs', name: 'sync-docs' },
  { plugin: 'drift-detect', name: 'drift-analysis' },
  { plugin: 'repo-map', name: 'repo-mapping' },
  { plugin: 'consult', name: 'consult' },
  { plugin: 'debate', name: 'debate' },
  { plugin: 'learn', name: 'learn' },
  { plugin: 'web-ctl', name: 'web-auth' },
  { plugin: 'web-ctl', name: 'web-browse' },
  { plugin: 'ship', name: 'release' },
  { plugin: 'skillers', name: 'skillers-compact' },
  { plugin: 'skillers', name: 'recommend' },
  { plugin: 'git-map', name: 'git-mapping' },
  { plugin: 'onboard', name: 'onboard' },
  { plugin: 'can-i-help', name: 'can-i-help' },
  { plugin: 'audit-project', name: 'audit-project' }
];

// Purpose mapping for architecture table
const PURPOSE_MAP = {
  'next-task': 'Master workflow orchestration',
  'enhance': 'Code quality analyzers',
  'ship': 'PR creation and deployment',
  'perf': 'Performance investigation',
  'audit-project': 'Multi-agent code review',
  'deslop': 'AI slop cleanup',
  'drift-detect': 'Plan drift detection',
  'repo-map': 'AST repo mapping',
  'sync-docs': 'Documentation sync',
  'learn': 'Topic research and learning guides',
  'agnix': 'Agent config linting',
  'consult': 'Cross-tool AI consultation',
  'debate': 'Multi-perspective debate analysis',
  'web-ctl': 'Browser automation for AI agents',
  'skillers': 'Workflow pattern learning',
  'git-map': 'Git history analysis',
  'onboard': 'Codebase onboarding',
  'can-i-help': 'Contributor guidance'
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
    'next-task', 'agnix', 'ship', 'deslop', 'perf',
    'drift-detect', 'audit-project', 'enhance',
    'repo-map', 'sync-docs', 'learn', 'consult',
    'debate', 'web-ctl', 'release', 'skillers',
    'git-map', 'onboard', 'can-i-help'
  ];

  // Command descriptions for the table (short, human-written summaries)
  const COMMAND_SUMMARIES = {
    'next-task': 'Task workflow: discovery, implementation, PR, merge',
    'agnix': 'Lint agent configurations (342 rules)',
    'ship': 'PR creation, CI monitoring, merge',
    'deslop': 'Clean AI slop patterns',
    'perf': 'Performance investigation with baselines and profiling',
    'drift-detect': 'Compare plan vs implementation',
    'audit-project': 'Multi-agent iterative code review',
    'enhance': 'Plugin, agent, and prompt analyzers',
    'repo-map': 'AST-based repository map',
    'sync-docs': 'Sync documentation with code changes',
    'learn': 'Research topics, create learning guides',
    'consult': 'Cross-tool AI consultation',
    'debate': 'Structured debate between AI tools',
    'web-ctl': 'Browser automation for AI agents',
    'release': 'Versioned release with ecosystem detection',
    'skillers': 'Workflow pattern learning and automation',
    'git-map': 'Git history analysis: hotspots, coupling, ownership, bus factor',
    'onboard': 'Codebase orientation for newcomers',
    'can-i-help': 'Match contributor skills to project needs'
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
    'Workflow', 'Enhancement', 'Performance', 'Cleanup',
    'Code Review', 'AI Collaboration', 'Onboarding',
    'Web', 'Release', 'Analysis', 'Linting', 'Other'
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
 * Generate the architecture table for CLAUDE.md / AGENTS.md.
 */
function generateArchitectureTable(plugins, agents, skills) {
  const fileBasedAgents = agents.length;
  const totalAgents = fileBasedAgents + ROLE_BASED_AGENT_COUNT;
  const totalSkills = skills.length;

  // Count agents per plugin (file-based only)
  const agentsByPlugin = {};
  for (const agent of agents) {
    agentsByPlugin[agent.plugin] = (agentsByPlugin[agent.plugin] || 0) + 1;
  }
  // audit-project has role-based agents
  agentsByPlugin['audit-project'] = (agentsByPlugin['audit-project'] || 0) + ROLE_BASED_AGENT_COUNT;

  // Count skills per plugin
  const skillsByPlugin = {};
  for (const skill of skills) {
    skillsByPlugin[skill.plugin] = (skillsByPlugin[skill.plugin] || 0) + 1;
  }

  const lines = [
    '```',
    'lib/          \u2192 Shared library (vendored to plugins)',
    `plugins/      \u2192 ${plugins.length} plugins, ${totalAgents} agents (${fileBasedAgents} file-based + ${ROLE_BASED_AGENT_COUNT} role-based), ${totalSkills} skills`,
    'adapters/     \u2192 Platform adapters (opencode-plugin/, opencode/, codex/)',
    'checklists/   \u2192 Action checklists (9 files)',
    'bin/cli.js    \u2192 npm CLI installer',
    '```',
    '',
    '| Plugin | Agents | Skills | Purpose |',
    '|--------|--------|--------|---------|'
  ];

  for (const plugin of plugins) {
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
    let agentNames;
    let count;

    if (plugin === 'audit-project') {
      // Role-based agents
      agentNames = AUDIT_ROLE_AGENTS;
      count = ROLE_BASED_AGENT_COUNT;
    } else {
      agentNames = agentsByPlugin[plugin] || [];
      count = agentNames.length;
    }

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
 */
function generateAgentCounts(agents, plugins) {
  const fileBasedAgents = agents.length;
  const totalAgents = fileBasedAgents + ROLE_BASED_AGENT_COUNT;

  // Count plugins with agents (file-based or role-based)
  const pluginsWithAgents = new Set();
  for (const agent of agents) {
    pluginsWithAgents.add(agent.plugin);
  }
  pluginsWithAgents.add('audit-project'); // role-based
  const pluginCount = pluginsWithAgents.size;

  return `**TL;DR:** ${totalAgents} agents across ${plugins.length} plugins (${pluginCount} have agents). opus for reasoning, sonnet for patterns, haiku for execution. Each agent does one thing well. <!-- AGENT_COUNT_TOTAL: ${totalAgents} -->`;
}

// ---------------------------------------------------------------------------
// site/content.json updater
// ---------------------------------------------------------------------------

/**
 * Update counts in site/content.json programmatically.
 */
function updateSiteContent(plugins, agents, skills) {
  const contentPath = path.join(ROOT_DIR, 'site', 'content.json');
  if (!fs.existsSync(contentPath)) return null;

  const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
  const totalAgents = agents.length + ROLE_BASED_AGENT_COUNT;

  // Update stats array
  if (content.stats && Array.isArray(content.stats)) {
    for (const stat of content.stats) {
      if (stat.label === 'Plugins') stat.value = String(plugins.length);
      if (stat.label === 'Agents') stat.value = String(totalAgents);
      if (stat.label === 'Skills') stat.value = String(skills.length);
    }
  }

  // Update agents section
  if (content.agents) {
    content.agents.total = totalAgents;
    content.agents.file_based = agents.length;
    content.agents.role_based = ROLE_BASED_AGENT_COUNT;
  }

  return content;
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

// Section names mapped to the files they appear in
const FILE_MAP = {
  'README.md': ['readme-commands', 'readme-skills'],
  'CLAUDE.md': ['claude-architecture'],
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
  const totalAgents = agents.length + ROLE_BASED_AGENT_COUNT;

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
  ROLE_BASED_AGENT_COUNT,
  STATIC_SKILLS
};
