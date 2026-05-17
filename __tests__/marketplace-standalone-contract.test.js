'use strict';

const fs = require('fs');
const path = require('path');

const marketplace = require('../.claude-plugin/marketplace.json');
const codexPlugin = require('../.codex-plugin/plugin.json');
const siteContent = require('../site/content.json');

const repoRoot = path.join(__dirname, '..');

const expectedStandalonePlugins = {
  'skill-curator': {
    version: '1.0.0',
    ref: 'v1.0.0',
    commit: 'e30ebfe3e7a5307e97fa4e6d59f538b12f8074c5',
    command: '/skill-curator',
    category: 'development',
  },
  'system-prompt-curator': {
    version: '2.0.0',
    ref: 'v2.0.0',
    commit: '277bee4b8b3b796d2a627132c88fb132479cbde0',
    command: '/system-prompt-curator',
    category: 'development',
  },
  banthis: {
    version: '0.3.1',
    ref: 'v0.3.1',
    commit: '197c8f8b2a074ba22791ee04407f60344f5eee7c',
    command: '/banthis',
    category: 'productivity',
  },
};

function pluginByName(name) {
  return marketplace.plugins.find((plugin) => plugin.name === name);
}

test('marketplace plugin names are unique and mirrored in plugins.txt', () => {
  const names = marketplace.plugins.map((plugin) => plugin.name);
  expect(new Set(names).size).toBe(names.length);

  const pluginsTxt = fs
    .readFileSync(path.join(repoRoot, 'scripts/plugins.txt'), 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean);

  expect([...pluginsTxt].sort()).toEqual([...names].sort());
});

test('standalone curator and memory plugins are pinned to immutable release commits', () => {
  for (const [name, expected] of Object.entries(expectedStandalonePlugins)) {
    const plugin = pluginByName(name);
    expect(plugin).toBeTruthy();
    expect(plugin.version).toBe(expected.version);
    expect(plugin.category).toBe(expected.category);
    expect(plugin.homepage).toBe(`https://github.com/agent-sh/${name}`);
    expect(plugin.source).toEqual({
      source: 'url',
      url: `https://github.com/agent-sh/${name}.git`,
      ref: expected.ref,
      commit: expected.commit,
    });
  }
});

test('standalone plugins are represented in user-facing docs and Codex metadata', () => {
  const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
  const architecture = fs.readFileSync(path.join(repoRoot, 'docs/ARCHITECTURE.md'), 'utf8');
  const siteCommands = new Set(siteContent.commands.map((command) => command.name));
  const codexDescription = codexPlugin.interface.longDescription;

  for (const [name, expected] of Object.entries(expectedStandalonePlugins)) {
    expect(siteCommands.has(expected.command)).toBe(true);
    expect(readme).toContain(expected.command);
    expect(architecture).toContain(expected.command);
    expect(codexDescription).toContain(expected.command);
    expect(codexDescription).toContain(name);
  }
});

test('all url-sourced marketplace plugins carry a commit pin', () => {
  for (const plugin of marketplace.plugins) {
    if (plugin.source?.source !== 'url') continue;

    expect(plugin.source.url).toMatch(/^https:\/\/github\.com\/agent-sh\/.+\.git$/);
    expect(plugin.source.commit).toMatch(/^[0-9a-f]{40}$/);
    if (plugin.source.ref) {
      expect(plugin.source.ref).toBe(`v${plugin.version}`);
    }
  }
});
