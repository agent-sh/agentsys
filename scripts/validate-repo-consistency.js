#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const discovery = require(path.join(__dirname, '..', 'lib', 'discovery'));

const ROOT_DIR = path.join(__dirname, '..');
const PLUGINS_DIR = path.join(ROOT_DIR, 'plugins');

let errors = [];
const PLUGINS_ROOT = path.resolve(PLUGINS_DIR);

function isPathWithin(baseDir, targetPath) {
  const relative = path.relative(baseDir, targetPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function readJson(filePath, label) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    errors.push(`${label}: ${err.message}`);
    return null;
  }
}

function listPluginDirs() {
  if (!fs.existsSync(PLUGINS_DIR)) {
    // plugins/ extracted to standalone repos — this is expected
    return [];
  }
  return fs.readdirSync(PLUGINS_DIR)
    .filter(name => fs.statSync(path.join(PLUGINS_DIR, name)).isDirectory());
}

function normalizeList(list) {
  return [...new Set(list)].sort();
}

function compareLists(label, expected, actual) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);

  const missing = expected.filter(item => !actualSet.has(item));
  const extra = actual.filter(item => !expectedSet.has(item));

  if (missing.length > 0) {
    errors.push(`${label}: missing ${missing.join(', ')}`);
  }
  if (extra.length > 0) {
    errors.push(`${label}: extra ${extra.join(', ')}`);
  }
}

function listPluginsWithAgents() {
  const plugins = listPluginDirs();
  const pluginsWithAgents = [];
  for (const plugin of plugins) {
    const agentsDir = path.join(PLUGINS_DIR, plugin, 'agents');
    if (!fs.existsSync(agentsDir)) continue;
    const hasAgents = fs.readdirSync(agentsDir).some(file => file.endsWith('.md'));
    if (hasAgents) pluginsWithAgents.push(plugin);
  }
  return normalizeList(pluginsWithAgents);
}

function validateVersions() {
  const pkg = readJson(path.join(ROOT_DIR, 'package.json'), 'package.json');
  const rootPlugin = readJson(path.join(ROOT_DIR, '.claude-plugin', 'plugin.json'), '.claude-plugin/plugin.json');
  const marketplace = readJson(path.join(ROOT_DIR, '.claude-plugin', 'marketplace.json'), '.claude-plugin/marketplace.json');

  if (!pkg || !rootPlugin || !marketplace) return;
  const version = pkg.version;

  if (rootPlugin.version !== version) {
    errors.push(`root plugin.json version ${rootPlugin.version} does not match package.json ${version}`);
  }
  if (marketplace.version !== version) {
    errors.push(`marketplace.json version ${marketplace.version} does not match package.json ${version}`);
  }

  // Check package-lock.json version
  const lockPath = path.join(ROOT_DIR, 'package-lock.json');
  if (fs.existsSync(lockPath)) {
    const lock = readJson(lockPath, 'package-lock.json');
    if (lock && lock.version !== version) {
      errors.push(`package-lock.json version ${lock.version} does not match package.json ${version}`);
    }
  }

  // Check site/content.json meta.version
  const contentPath = path.join(ROOT_DIR, 'site', 'content.json');
  if (fs.existsSync(contentPath)) {
    const content = readJson(contentPath, 'site/content.json');
    if (content && content.meta && content.meta.version !== version) {
      errors.push(`site/content.json meta.version ${content.meta.version} does not match package.json ${version}`);
    }
  }

}

function validateMappings() {
  const pluginDirs = listPluginDirs();
  const pluginsPopulated = pluginDirs.length > 0;

  // Use discovery module instead of parsing hardcoded arrays from source
  const discoveredPlugins = normalizeList(discovery.discoverPlugins(ROOT_DIR));
  const commandMappings = discovery.getCommandMappings(ROOT_DIR);
  const skillMappings = discovery.getCodexSkillMappings(ROOT_DIR);

  // Only require plugins when plugins/ directory has actual plugin subdirectories
  if (pluginsPopulated) {
    if (discoveredPlugins.length === 0) {
      errors.push('discovery found no plugins');
    }

    if (commandMappings.length === 0) {
      errors.push('discovery found no command mappings');
    }

    if (skillMappings.length === 0) {
      errors.push('discovery found no skill mappings');
    }
  }

  const normalizedPluginDirs = normalizeList(pluginDirs);
  const marketplace = readJson(path.join(ROOT_DIR, '.claude-plugin', 'marketplace.json'), 'marketplace.json');
  const marketplacePlugins = normalizeList((marketplace?.plugins || []).map(p => p.name));

  // Compare discovered plugins vs filesystem only when plugins/ exists
  if (pluginsPopulated) {
    compareLists('Discovered plugins vs plugins/', normalizedPluginDirs, discoveredPlugins);

    if (marketplacePlugins.length > 0) {
      compareLists('Marketplace plugins vs plugins/', normalizedPluginDirs, marketplacePlugins);
    }
    if (marketplacePlugins.length > 0) {
      compareLists('Marketplace plugins vs discovered plugins', marketplacePlugins, discoveredPlugins);
    }
  }

  // Validate command mappings - source files exist (only when plugins/ exists)
  if (pluginsPopulated) {
    const seenTargets = new Set();
    for (const [target, plugin, source] of commandMappings) {
      if (seenTargets.has(target)) {
        errors.push(`commandMappings duplicate target: ${target}`);
      }
      seenTargets.add(target);

      const srcPath = path.join(PLUGINS_DIR, plugin, 'commands', source);
      const resolvedPath = path.resolve(srcPath);
      if (!isPathWithin(PLUGINS_ROOT, resolvedPath)) {
        errors.push(`commandMappings path traversal: ${plugin}/${source}`);
        continue;
      }
      if (!fs.existsSync(resolvedPath)) {
        errors.push(`commandMappings missing source: ${plugin}/${source}`);
      }
    }

    // Validate skill mappings - source files exist
    const commandMapSet = new Set(commandMappings.map(([, plugin, source]) => `${plugin}/${source}`));
    const seenSkills = new Set();
    for (const [skill, plugin, source] of skillMappings) {
      if (seenSkills.has(skill)) {
        errors.push(`skillMappings duplicate skill: ${skill}`);
      }
      seenSkills.add(skill);

      const srcPath = path.join(PLUGINS_DIR, plugin, 'commands', source);
      const resolvedPath = path.resolve(srcPath);
      if (!isPathWithin(PLUGINS_ROOT, resolvedPath)) {
        errors.push(`skillMappings path traversal: ${plugin}/${source}`);
        continue;
      }
      if (!fs.existsSync(resolvedPath)) {
        errors.push(`skillMappings missing source: ${plugin}/${source}`);
      }
      if (!commandMapSet.has(`${plugin}/${source}`)) {
        errors.push(`skillMappings entry not in commandMappings: ${plugin}/${source}`);
      }
    }
  }
}

function validateAgentCounts() {
  if (listPluginDirs().length === 0) return;
  const fileBasedCount = listPluginsWithAgents()
    .map(plugin => {
      const agentsDir = path.join(PLUGINS_DIR, plugin, 'agents');
      return fs.readdirSync(agentsDir).filter(file => file.endsWith('.md')).length;
    })
    .reduce((sum, count) => sum + count, 0);

  const agentsDocPath = path.join(ROOT_DIR, 'docs', 'reference', 'AGENTS.md');
  const docsIndexPath = path.join(ROOT_DIR, 'docs', 'README.md');

  if (fs.existsSync(agentsDocPath)) {
    const content = fs.readFileSync(agentsDocPath, 'utf8');
    const totalMatch = content.match(/<!--\s*AGENT_COUNT_TOTAL:\s*(\d+)\s*-->/)
      || content.match(/\*\*TL;DR:\*\*\s*(\d+) agents/);

    if (!totalMatch || Number(totalMatch[1]) !== fileBasedCount) {
      errors.push(`docs/reference/AGENTS.md total count mismatch (${totalMatch ? totalMatch[1] : 'missing'} vs ${fileBasedCount})`);
    }
  }

  if (fs.existsSync(docsIndexPath)) {
    const content = fs.readFileSync(docsIndexPath, 'utf8');
    const match = content.match(/<!--\s*AGENT_COUNT_TOTAL:\s*(\d+)\s*-->/)
      || content.match(/All\s+(\d+)\s+agents/);
    if (!match || Number(match[1]) !== fileBasedCount) {
      errors.push(`docs/README.md agent count mismatch (${match ? match[1] : 'missing'} vs ${fileBasedCount})`);
    }
  }
}

// Docs and site must not carry an exact test count: it goes stale every release.
const TEST_COUNT_FILES = [
  'README.md',
  'checklists/cross-platform-compatibility.md',
  'docs/ARCHITECTURE.md',
  'site/content.json',
  'site/index.html',
  'site/ux-spec.md'
];
const TEST_COUNT_PATTERNS = [
  /\b\d[\d,.]*[k+]?\s+(?:(?:unit|e2e|integration)\s+)?(?:tests|test\s+cases)\b/i,
  /(?:"label":\s*"|stats__label">)Tests\b/i
];

function findHardcodedTestCounts(text) {
  const found = [];
  text.split('\n').forEach((line, index) => {
    if (TEST_COUNT_PATTERNS.some(pattern => pattern.test(line))) {
      found.push({ line: index + 1, text: line.trim() });
    }
  });
  return found;
}

function validateNoHardcodedTestCount() {
  for (const file of TEST_COUNT_FILES) {
    const filePath = path.join(ROOT_DIR, file);
    if (!fs.existsSync(filePath)) continue;
    const hits = findHardcodedTestCounts(fs.readFileSync(filePath, 'utf8'));
    for (const hit of hits) {
      errors.push(`${file}:${hit.line} hard-codes a test count (it goes stale every release): ${hit.text}`);
    }
  }
}

function namesInPanel(html, panelId) {
  const start = html.indexOf(`id="${panelId}"`);
  if (start < 0) return null;
  const nextPanel = html.indexOf('id="agent-tier-', start + 1);
  const skillsTitle = html.indexOf('agents-skills__skills-title', start);
  let end = html.length;
  if (nextPanel > start) end = Math.min(end, nextPanel);
  if (skillsTitle > start) end = Math.min(end, skillsTitle);
  return [...html.slice(start, end).matchAll(/agent-card__name">([^<]+)/g)].map(match => match[1]);
}

function listDiff(label, actual, expected) {
  const missing = expected.filter(name => !actual.includes(name));
  const extra = actual.filter(name => !expected.includes(name));
  if (missing.length === 0 && extra.length === 0) return null;
  return `${label}: missing ${missing.join(', ') || 'none'}; extra ${extra.join(', ') || 'none'}`;
}

function duplicateNames(list) {
  const seen = new Set();
  const dupes = [];
  for (const name of list) {
    if (seen.has(name)) dupes.push(name);
    seen.add(name);
  }
  return dupes;
}

// The agents/skills section of site/index.html is static. Headings, tab
// counts and cards have to match site/content.json and the skill list, or
// the page advertises agents and skills it does not show.
function siteCatalogMismatches(html, content, { skillNames = [], pluginCount = null } = {}) {
  const found = [];
  const push = (message) => { if (message) found.push(message); };

  const heading = html.match(/id="as-title">(\d+) Agents\. (\d+) Skills\./);
  const skillsTitle = html.match(/agents-skills__skills-title[^>]*>(\d+) Skills across (\d+) Plugins/);
  if (!heading) push('site/index.html is missing the "N Agents. M Skills." heading');
  if (!skillsTitle) push('site/index.html is missing the "N Skills across P Plugins" heading');

  const agents = content && content.agents;
  const stats = Array.isArray(content && content.stats) ? content.stats : [];
  const statValue = (label) => {
    const row = stats.find(item => item.label === label);
    return row ? Number(row.value) : null;
  };

  const byModel = agents && Array.isArray(agents.by_model)
    ? agents.by_model.flatMap(group => group.agents || [])
    : [];
  const tabPanels = [...html.matchAll(/aria-controls="(agent-tier-[^"]+)"[^>]*>[\s\S]*?agent-tabs__count">(\d+)/g)];
  const cardNames = [];

  if (tabPanels.length === 0) push('site/index.html has no agent tier tabs');
  for (const [, panelId, countText] of tabPanels) {
    const names = namesInPanel(html, panelId);
    if (!names) {
      push(`site/index.html tab ${panelId} has no panel`);
      continue;
    }
    cardNames.push(...names);
    if (names.length !== Number(countText)) {
      push(`site/index.html ${panelId} shows ${countText} but has ${names.length} cards`);
    }
  }

  push(listDiff('site agent cards vs content.json agents.by_model', cardNames, byModel));

  const cardDupes = duplicateNames(cardNames);
  const modelDupes = duplicateNames(byModel);
  if (cardDupes.length) push(`site/index.html repeats agent cards: ${cardDupes.join(', ')}`);
  if (modelDupes.length) push(`site/content.json repeats agents: ${modelDupes.join(', ')}`);

  if (agents) {
    if (byModel.length !== agents.total) {
      push(`content.json by_model lists ${byModel.length} agents, agents.total is ${agents.total}`);
    }
    if (cardNames.length !== agents.total) {
      push(`site agent cards are ${cardNames.length}, agents.total is ${agents.total}`);
    }
  } else {
    push('site/content.json is missing agents');
  }

  if (heading && agents && Number(heading[1]) !== agents.total) {
    push(`site heading says ${heading[1]} agents, agents.total is ${agents.total}`);
  }
  const skillStat = statValue('Skills');
  const agentStat = statValue('Agents');
  const pluginStat = statValue('Plugins');
  if (heading && skillStat !== null && Number(heading[2]) !== skillStat) {
    push(`site heading says ${heading[2]} skills, stats Skills is ${skillStat}`);
  }
  if (heading && agentStat !== null && Number(heading[1]) !== agentStat) {
    push(`site heading says ${heading[1]} agents, stats Agents is ${agentStat}`);
  }
  if (skillsTitle && heading && skillsTitle[1] !== heading[2]) {
    push(`skills heading says ${skillsTitle[1]}, agents heading says ${heading[2]} skills`);
  }
  if (skillsTitle && pluginStat !== null && Number(skillsTitle[2]) !== pluginStat) {
    push(`skills heading says ${skillsTitle[2]} plugins, stats Plugins is ${pluginStat}`);
  }
  if (pluginCount !== null && skillsTitle && Number(skillsTitle[2]) !== pluginCount) {
    push(`skills heading says ${skillsTitle[2]} plugins, marketplace has ${pluginCount}`);
  }

  const htmlStats = [...html.matchAll(/data-target="(\d+)"[\s\S]*?stats__label">([^<]+)/g)];
  for (const label of ['Plugins', 'Agents', 'Skills']) {
    const pair = htmlStats.find(([, , name]) => name.trim() === label);
    const expected = statValue(label);
    if (!pair) {
      push(`site/index.html stats bar is missing ${label}`);
    } else if (expected !== null && Number(pair[1]) !== expected) {
      push(`site/index.html stats bar ${label} is ${pair[1]}, content.json is ${expected}`);
    }
  }

  const skillCards = [...html.matchAll(/class="skill-card">([^<]+)/g)].map(match => match[1]);
  if (heading && skillCards.length !== Number(heading[2])) {
    push(`site skill cards are ${skillCards.length}, heading says ${heading[2]}`);
  }
  if (skillNames.length) {
    push(listDiff('site skill cards vs STATIC_SKILLS', skillCards, skillNames));
  }

  return found;
}

function staticSkillNames(source) {
  const block = source.match(/const STATIC_SKILLS = \[([\s\S]*?)\];/);
  if (!block) return [];
  return [...block[1].matchAll(/name:\s*'([^']+)'/g)].map(match => match[1]);
}

function validateSiteCatalog() {
  const htmlPath = path.join(ROOT_DIR, 'site', 'index.html');
  const contentPath = path.join(ROOT_DIR, 'site', 'content.json');
  const docsPath = path.join(ROOT_DIR, 'scripts', 'generate-docs.js');
  const marketPath = path.join(ROOT_DIR, '.claude-plugin', 'marketplace.json');
  if (!fs.existsSync(htmlPath) || !fs.existsSync(contentPath)) return;

  const content = readJson(contentPath, 'site/content.json');
  if (!content) return;
  const marketplace = readJson(marketPath, '.claude-plugin/marketplace.json');
  const skillSource = fs.existsSync(docsPath) ? fs.readFileSync(docsPath, 'utf8') : '';
  const mismatches = siteCatalogMismatches(
    fs.readFileSync(htmlPath, 'utf8'),
    content,
    {
      skillNames: staticSkillNames(skillSource),
      pluginCount: marketplace && Array.isArray(marketplace.plugins) ? marketplace.plugins.length : null
    }
  );
  for (const mismatch of mismatches) {
    errors.push(`site catalog: ${mismatch}`);
  }
}

function main() {
  // Reset errors for each invocation (prevents state leakage across requires)
  errors = [];

  console.log('Repository Consistency Validator');
  console.log('===============================\n');

  validateVersions();
  validateMappings();
  validateAgentCounts();
  validateNoHardcodedTestCount();
  validateSiteCatalog();

  if (errors.length > 0) {
    console.log('[ERROR] Consistency checks failed:\n');
    errors.forEach(error => console.log(`- ${error}`));
    return 1;
  }

  console.log('[OK] Repository consistency checks passed');
  return 0;
}

if (require.main === module) {
  const code = main();
  if (typeof code === 'number') process.exit(code);
}

module.exports = { main, findHardcodedTestCounts, siteCatalogMismatches };
