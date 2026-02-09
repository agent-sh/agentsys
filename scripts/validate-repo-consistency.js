#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const discovery = require(path.join(__dirname, '..', 'lib', 'discovery'));

const ROOT_DIR = path.join(__dirname, '..');
const PLUGINS_DIR = path.join(ROOT_DIR, 'plugins');

const errors = [];
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
    errors.push('plugins/: directory not found');
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

function parseRoleBasedAgents() {
  const auditPath = path.join(ROOT_DIR, 'plugins', 'audit-project', 'commands', 'audit-project.md');
  if (!fs.existsSync(auditPath)) {
    errors.push('audit-project.md not found for role-based agents');
    return [];
  }

  const content = fs.readFileSync(auditPath, 'utf8');
  const sectionStart = content.indexOf('### Agent Selection');
  if (sectionStart === -1) {
    errors.push('Agent Selection section missing in audit-project.md');
    return [];
  }
  const section = content.slice(sectionStart);
  const phaseIndex = section.indexOf('## Phase 2');
  const selectionSection = phaseIndex === -1 ? section : section.slice(0, phaseIndex);

  const matches = [...selectionSection.matchAll(/- `([^`]+)`/g)].map(match => match[1]);
  return normalizeList(matches);
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

  for (const plugin of marketplace.plugins || []) {
    if (plugin.version !== version) {
      errors.push(`marketplace.json plugin ${plugin.name} version ${plugin.version} does not match package.json ${version}`);
    }
  }

  const pluginDirs = listPluginDirs();
  for (const plugin of pluginDirs) {
    const pluginJsonPath = path.join(PLUGINS_DIR, plugin, '.claude-plugin', 'plugin.json');
    if (!fs.existsSync(pluginJsonPath)) {
      errors.push(`${plugin}: missing .claude-plugin/plugin.json`);
      continue;
    }
    const pluginJson = readJson(pluginJsonPath, `${plugin} plugin.json`);
    if (pluginJson && pluginJson.version !== version) {
      errors.push(`${plugin} plugin.json version ${pluginJson.version} does not match package.json ${version}`);
    }
  }

}

function validateMappings() {
  // Use discovery module instead of parsing hardcoded arrays from source
  const discoveredPlugins = normalizeList(discovery.discoverPlugins(ROOT_DIR));
  const commandMappings = discovery.getCommandMappings(ROOT_DIR);
  const skillMappings = discovery.getCodexSkillMappings(ROOT_DIR);

  if (discoveredPlugins.length === 0) {
    errors.push('discovery found no plugins');
  }

  if (commandMappings.length === 0) {
    errors.push('discovery found no command mappings');
  }

  if (skillMappings.length === 0) {
    errors.push('discovery found no skill mappings');
  }

  const pluginDirs = normalizeList(listPluginDirs());
  const marketplace = readJson(path.join(ROOT_DIR, '.claude-plugin', 'marketplace.json'), 'marketplace.json');
  const marketplacePlugins = normalizeList((marketplace?.plugins || []).map(p => p.name));

  // Compare discovered plugins vs filesystem
  compareLists('Discovered plugins vs plugins/', pluginDirs, discoveredPlugins);

  if (marketplacePlugins.length > 0) {
    compareLists('Marketplace plugins vs plugins/', pluginDirs, marketplacePlugins);
  }
  if (marketplacePlugins.length > 0) {
    compareLists('Marketplace plugins vs discovered plugins', marketplacePlugins, discoveredPlugins);
  }

  // Validate command mappings - source files exist
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

function validateAgentCounts() {
  const fileBasedCount = listPluginsWithAgents()
    .map(plugin => {
      const agentsDir = path.join(PLUGINS_DIR, plugin, 'agents');
      return fs.readdirSync(agentsDir).filter(file => file.endsWith('.md')).length;
    })
    .reduce((sum, count) => sum + count, 0);

  const roleBasedAgents = parseRoleBasedAgents();
  const roleBasedCount = roleBasedAgents.length;
  const totalCount = fileBasedCount + roleBasedCount;

  const agentsDocPath = path.join(ROOT_DIR, 'docs', 'reference', 'AGENTS.md');
  const docsIndexPath = path.join(ROOT_DIR, 'docs', 'README.md');
  const readmePath = path.join(ROOT_DIR, 'README.md');

  if (fs.existsSync(agentsDocPath)) {
    const content = fs.readFileSync(agentsDocPath, 'utf8');
    const totalMatch = content.match(/<!--\s*AGENT_COUNT_TOTAL:\s*(\d+)\s*-->/)
      || content.match(/\*\*TL;DR:\*\*\s*(\d+) agents/);
    const fileMatch = content.match(/<!--\s*AGENT_COUNT_FILE_BASED:\s*(\d+)\s*-->/)
      || content.match(/File-based agents(?:\*\*)?\s*\((\d+)\)/);
    const roleMatch = content.match(/<!--\s*AGENT_COUNT_ROLE_BASED:\s*(\d+)\s*-->/)
      || content.match(/Role-based agents(?:\*\*)?\s*\((\d+)\)/);

    if (!totalMatch || Number(totalMatch[1]) !== totalCount) {
      errors.push(`docs/reference/AGENTS.md total count mismatch (${totalMatch ? totalMatch[1] : 'missing'} vs ${totalCount})`);
    }
    if (!fileMatch || Number(fileMatch[1]) !== fileBasedCount) {
      errors.push(`docs/reference/AGENTS.md file-based count mismatch (${fileMatch ? fileMatch[1] : 'missing'} vs ${fileBasedCount})`);
    }
    if (!roleMatch || Number(roleMatch[1]) !== roleBasedCount) {
      errors.push(`docs/reference/AGENTS.md role-based count mismatch (${roleMatch ? roleMatch[1] : 'missing'} vs ${roleBasedCount})`);
    }
  }

  if (fs.existsSync(docsIndexPath)) {
    const content = fs.readFileSync(docsIndexPath, 'utf8');
    const match = content.match(/<!--\s*AGENT_COUNT_TOTAL:\s*(\d+)\s*-->/)
      || content.match(/All\s+(\d+)\s+agents/);
    if (!match || Number(match[1]) !== totalCount) {
      errors.push(`docs/README.md agent count mismatch (${match ? match[1] : 'missing'} vs ${totalCount})`);
    }
  }

  if (fs.existsSync(readmePath)) {
    const content = fs.readFileSync(readmePath, 'utf8');
    const match = content.match(/<!--\s*AGENT_COUNT_ROLE_BASED:\s*(\d+)\s*-->/)
      || content.match(/Up to\s+(\d+)\s+specialized role-based agents/);
    if (!match || Number(match[1]) !== roleBasedCount) {
      errors.push(`README.md role-based agent count mismatch (${match ? match[1] : 'missing'} vs ${roleBasedCount})`);
    }
  }
}

function validatePerfDocs() {
  const requiredDocs = [
    path.join(ROOT_DIR, 'docs', 'perf-requirements.md'),
    path.join(ROOT_DIR, 'docs', 'perf-research-methodology.md')
  ];

  for (const docPath of requiredDocs) {
    if (!fs.existsSync(docPath)) {
      errors.push(`Missing perf doc: ${path.relative(ROOT_DIR, docPath)}`);
    }
  }
}

function validatePerfAgentSkillUsage() {
  const perfDir = path.join(PLUGINS_DIR, 'perf');
  const agentsDir = path.join(perfDir, 'agents');
  const skillsDir = path.join(perfDir, 'skills');

  if (!fs.existsSync(agentsDir) || !fs.existsSync(skillsDir)) return;

  const skillNames = new Set();
  const skillDirs = fs.readdirSync(skillsDir)
    .filter(name => fs.statSync(path.join(skillsDir, name)).isDirectory());

  for (const dir of skillDirs) {
    const skillPath = path.join(skillsDir, dir, 'SKILL.md');
    if (!fs.existsSync(skillPath)) continue;
    const skillContent = fs.readFileSync(skillPath, 'utf8');
    const skillMatch = skillContent.match(/^name:\s*([^\s]+)\s*$/m);
    if (skillMatch) {
      skillNames.add(skillMatch[1].trim());
    }
  }

  const agentFiles = fs.readdirSync(agentsDir).filter(file => file.endsWith('.md'));
  for (const file of agentFiles) {
    const filePath = path.join(agentsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const nameMatch = content.match(/^name:\s*([^\s]+)\s*$/m);
    if (!nameMatch) continue;

    const agentName = nameMatch[1].trim();
    if (!skillNames.has(agentName)) continue;

    const requiredLine = `MUST execute the ${agentName} skill`;
    if (!content.includes(requiredLine)) {
      errors.push(`perf agent ${file} must require skill usage: "${requiredLine}"`);
    }
  }
}

function validateEnhanceAgentSkillUsage() {
  const enhanceDir = path.join(PLUGINS_DIR, 'enhance');
  const agentsDir = path.join(enhanceDir, 'agents');
  const skillsDir = path.join(enhanceDir, 'skills');

  if (!fs.existsSync(agentsDir) || !fs.existsSync(skillsDir)) return;

  const skillNames = new Set();
  const skillDirs = fs.readdirSync(skillsDir)
    .filter(name => fs.statSync(path.join(skillsDir, name)).isDirectory());

  for (const dir of skillDirs) {
    const skillPath = path.join(skillsDir, dir, 'SKILL.md');
    if (!fs.existsSync(skillPath)) continue;
    const skillContent = fs.readFileSync(skillPath, 'utf8');
    const skillMatch = skillContent.match(/^name:\s*([^\s]+)\s*$/m);
    if (skillMatch) {
      skillNames.add(skillMatch[1].trim());
    }
  }

  const agentFiles = fs.readdirSync(agentsDir).filter(file => file.endsWith('.md'));
  for (const file of agentFiles) {
    const filePath = path.join(agentsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const usageMatch = content.match(/MUST execute the `?([^\s`]+)`? skill/);
    if (!usageMatch) {
      errors.push(`enhance agent ${file} must require skill usage with "MUST execute the <skill> skill"`);
      continue;
    }

    const skillName = usageMatch[1].trim();
    if (!skillNames.has(skillName)) {
      errors.push(`enhance agent ${file} references missing skill: ${skillName}`);
    }
  }
}

function main() {
  console.log('Repository Consistency Validator');
  console.log('===============================\n');

  validateVersions();
  validateMappings();
  validateAgentCounts();
  validatePerfDocs();
  validatePerfAgentSkillUsage();
  validateEnhanceAgentSkillUsage();

  if (errors.length > 0) {
    console.log('[ERROR] Consistency checks failed:\n');
    errors.forEach(error => console.log(`- ${error}`));
    process.exit(1);
  }

  console.log('[OK] Repository consistency checks passed');
}

main();
