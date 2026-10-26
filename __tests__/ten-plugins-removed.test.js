'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// prepare-delivery, drift-detect, perf, audit-project, sync-docs, enhance,
// consult, debate, onboard and can-i-help left the marketplace and their repos
// were deleted (2026-10-26). agentsys must not offer, install, pin, document or
// test them, and lib/ keeps only what the kept plugins and agentsys use.
const repoRoot = path.join(__dirname, '..');
const REMOVED = [
  'prepare-delivery', 'drift-detect', 'perf', 'audit-project', 'sync-docs',
  'enhance', 'consult', 'debate', 'onboard', 'can-i-help'
];
const REMOVED_AGENTS = [
  'prepare-delivery-agent', 'delivery-validator', 'test-coverage-checker', 'plan-synthesizer',
  'perf-orchestrator', 'perf-theory-gatherer', 'perf-theory-tester', 'perf-code-paths',
  'perf-investigation-logger', 'perf-analyzer', 'plugin-enhancer', 'agent-enhancer',
  'claudemd-enhancer', 'docs-enhancer', 'prompt-enhancer', 'hooks-enhancer', 'skills-enhancer',
  'cross-file-enhancer', 'sync-docs-agent', 'consult-agent', 'debate-orchestrator',
  'onboard-agent', 'can-i-help-agent', 'reviewer-quality-security', 'reviewer-perf-test'
];
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(repoRoot, rel));
const alternation = names => names.map(n => n.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')).join('|');

function walk(rel, exts, out = []) {
  const full = path.join(repoRoot, rel);
  if (!fs.existsSync(full)) return out;
  if (fs.statSync(full).isFile()) {
    out.push(rel);
    return out;
  }
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const child = path.join(rel, entry.name);
    if (entry.isDirectory()) walk(child, exts, out);
    else if (exts.includes(path.extname(entry.name))) out.push(child);
  }
  return out;
}

// What a user reads or installs from. CHANGELOG.md and changelogs/ keep history.
const OFFERED = [
  'README.md', 'AGENTS.md', 'SECURITY.md', 'CONTRIBUTING.md', 'package.json',
  '.claude-plugin', '.codex-plugin', '.github/ISSUE_TEMPLATE',
  'bin', 'adapters', 'docs', 'agent-docs', 'checklists', 'site', 'meta', 'scripts', 'templates'
].flatMap(rel => walk(rel, ['.md', '.json', '.js', '.ts', '.html', '.yml', '.txt']));

// site/content.json keeps its release history (recent_releases) as written.
function offeredText(rel) {
  if (rel.split(path.sep).join('/') !== 'site/content.json') return read(rel);
  const content = JSON.parse(read(rel));
  delete content.recent_releases;
  return JSON.stringify(content, null, 2);
}

function hits(pattern) {
  const found = [];
  for (const rel of OFFERED) {
    offeredText(rel).split('\n').forEach((line, i) => {
      // Posix separators, so the paths read the same on Windows.
      if (pattern.test(line)) found.push(`${rel.split(path.sep).join('/')}:${i + 1}: ${line.trim().slice(0, 120)}`);
    });
  }
  return found;
}

test('the marketplace, plugins.txt and the Codex metadata list none of the ten', () => {
  const marketplace = JSON.parse(read('.claude-plugin/marketplace.json'));
  const names = marketplace.plugins.map(p => p.name);
  for (const name of REMOVED) expect(names).not.toContain(name);
  expect(names).toHaveLength(11);
  expect(marketplace.description).toMatch(/^11 specialized plugins/);
  const listed = read('scripts/plugins.txt').split('\n').filter(Boolean);
  expect(listed).toEqual([...names].sort());
  const codex = JSON.parse(read('.codex-plugin/plugin.json'));
  expect(JSON.stringify(codex)).not.toMatch(new RegExp(`/(${alternation(REMOVED)})\\b`));
  expect(codex.interface.capabilities).not.toEqual(expect.arrayContaining(['performance']));
  expect(codex.interface.capabilities).not.toEqual(expect.arrayContaining(['code-review']));
  expect(codex.interface.shortDescription).toBe('AI agent orchestration with 14 skills and 5 agents');
});

test('the docs generator counts only the kept plugins and no role-based agents', () => {
  const genDocs = require('../scripts/generate-docs');
  const source = read('scripts/generate-docs.js');
  for (const name of REMOVED) expect(source).not.toContain(`'${name}'`);
  const marketplace = JSON.parse(read('.claude-plugin/marketplace.json'));
  expect(Object.keys(genDocs.STATIC_PLUGIN_AGENT_COUNTS).sort()).toEqual(marketplace.plugins.map(p => p.name).sort());
  expect(genDocs.STATIC_PLUGIN_COUNT).toBe(11);
  expect(genDocs.STATIC_AGENT_COUNT).toBe(5);
  expect(genDocs.STATIC_SKILLS).toHaveLength(14);
  expect(genDocs.ROLE_BASED_AGENT_COUNT).toBeUndefined();
  expect(source).not.toMatch(/role-based|AUDIT_ROLE_AGENTS/);
});

test('no offered file runs a removed command', () => {
  // `/perf` or `$consult`, but not a path such as `agent-sh/perf` or `commands/perf.md`.
  const found = hits(new RegExp(`(?<![\\w./}-])[/$](${alternation(REMOVED)})(?![\\w-]|\\.\\w)`));
  expect(found).toEqual([]);
});

test('no offered file installs or links a removed plugin, or names its agents', () => {
  expect(hits(new RegExp(`\\b(${alternation(REMOVED)})@agentsys\\b`))).toEqual([]);
  expect(hits(new RegExp(`agent-sh/(${alternation(REMOVED)})(?![\\w-])`))).toEqual([]);
  expect(hits(new RegExp(`\\b(${alternation(REMOVED_AGENTS)})\\b`))).toEqual([]);
});

test('the per-plugin pages and snippets of the ten are gone', () => {
  for (const rel of [
    'docs/perf-requirements.md', 'docs/perf-research-methodology.md', 'docs/consult-command-test-strategy.md',
    'agent-docs/workflow.md', 'templates/agent-snippets/enhance-integration-points.md',
    'templates/agent-snippets/enhance-skill-delegation.md', 'scripts/perf'
  ]) {
    expect([rel, exists(rel)]).toEqual([rel, false]);
  }
});

test('lib/ drops the modules only the ten used and keeps what deslop and agentsys use', () => {
  for (const rel of ['lib/enhance', 'lib/perf', 'lib/drift-detect', 'lib/collectors', 'lib/repo-map', 'lib/patterns/review-patterns.js']) {
    expect([rel, exists(rel)]).toEqual([rel, false]);
  }
  const lib = require('../lib');
  for (const key of ['enhance', 'perf', 'collectors', 'repoMap', 'reviewPatterns']) {
    expect([key, lib[key]]).toEqual([key, undefined]);
  }
  expect(lib.patterns.review).toBeUndefined();
  expect(typeof lib.repoIntel.init).toBe('function');
  expect(typeof lib.repoIntel.queries.testGaps).toBe('function');
  expect(typeof lib.patterns.pipeline.runPipeline).toBe('function');
  expect(typeof lib.binary.ensureBinary).toBe('function');
  expect(require('../lib/cross-platform').getSuppressionPath).toBeUndefined();
  const transforms = require('../lib/adapter-transforms');
  expect(transforms.generateCombinedReviewerAgent).toBeUndefined();
  expect(read('lib/agentsys.js')).not.toMatch(/repo-map|repoMap/);
  expect(read('scripts/validate-cross-platform.js')).not.toMatch(/lib.{0,4}enhance|'enhance'/);
});

test('Kiro prompts keep parallel delegations without the removed combined reviewers', () => {
  const { transformCommandForKiro } = require('../lib/adapter-transforms');
  const tasks = ['security-review', 'performance-review', 'test-review', 'quality-review']
    .map(agent => `  Task({ subagent_type: "x:${agent}", prompt: \`Review it\` }),`).join('\n');
  const out = transformCommandForKiro('```javascript\nawait Promise.all([\n' + tasks + '\n]);\n```\n', {
    pluginInstallPath: '/p', name: 'x', description: 'd'
  });
  expect(out).toContain('Delegate to the `security-review` subagent');
  expect(out).toContain('Delegate to the `quality-review` subagent');
  expect(out).not.toMatch(/reviewer-quality-security|reviewer-perf-test|combined reviewers/);
});

test('rule 7 and the pre-push hook use agnix, not the removed /enhance', () => {
  const agents = read('AGENTS.md');
  const rule7 = agents.split('\n').find(line => line.startsWith('7. '));
  expect(rule7).toContain('agnix');
  expect(rule7).not.toMatch(/\/enhance|ENHANCE_CONFIRMED/);
  const hooks = read('scripts/setup-hooks.js');
  expect(hooks).not.toMatch(/\/enhance|ENHANCE_CONFIRMED/);
  expect(hooks).toContain('agnix');
});

// The hook is POSIX sh; Windows contributors run it through Git Bash, which CI does not have.
(process.platform === 'win32' ? describe.skip : describe)('pre-push hook agnix step', () => {
  const hookSource = read('scripts/setup-hooks.js').match(/const prePushHook = `([\s\S]*?)`;\n/)[1];
  // eslint-disable-next-line no-new-func
  const hook = new Function(`return \`${hookSource}\`;`)();
  let scratch;

  function scratchRepo(agnixExit) {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agentsys-hook-'));
    const repo = path.join(scratch, 'repo');
    const bin = path.join(scratch, 'bin');
    fs.mkdirSync(path.join(repo, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(repo, 'skills', 'x'), { recursive: true });
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(repo, 'scripts', 'preflight.js'), 'process.exit(0);\n');
    fs.writeFileSync(path.join(bin, 'agnix'), `#!/bin/sh\necho "$@" > "${path.join(scratch, 'agnix-args')}"\nexit ${agnixExit}\n`, { mode: 0o755 });
    const git = (...args) => spawnSync('git', [
      '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', '-c', `core.hooksPath=${path.join(scratch, 'no-hooks')}`, ...args
    ], { cwd: repo, encoding: 'utf8' });
    git('init', '-q');
    git('commit', '-q', '--allow-empty', '-m', 'base');
    fs.writeFileSync(path.join(repo, 'skills', 'x', 'SKILL.md'), '---\nname: x\ndescription: Use when x\n---\n');
    fs.writeFileSync(path.join(repo, 'notes.md'), 'not an agent config\n');
    git('add', '.');
    git('commit', '-q', '-m', 'skill');
    fs.writeFileSync(path.join(scratch, 'pre-push'), hook, { mode: 0o755 });
    return { repo, bin };
  }

  function runHook({ repo, bin }) {
    return spawnSync('sh', [path.join(scratch, 'pre-push')], {
      cwd: repo, input: '', encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` }
    });
  }

  afterEach(() => {
    if (scratch) fs.rmSync(scratch, { recursive: true, force: true });
    scratch = null;
  });

  test('lints only the changed agent configs and passes when agnix does', () => {
    const result = runHook(scratchRepo(0));
    expect(result.stdout).toContain('[OK] agnix found no errors');
    expect(result.status).toBe(0);
    expect(fs.readFileSync(path.join(scratch, 'agnix-args'), 'utf8').trim()).toBe('skills/x/SKILL.md');
  });

  test('blocks the push when agnix reports an error', () => {
    const result = runHook(scratchRepo(1));
    expect(result.stdout).toContain('[ERROR] BLOCKED: agnix reported errors');
    expect(result.status).toBe(1);
  });
});

test('CHANGELOG says how to uninstall each of the ten on every platform', () => {
  const changelog = read('CHANGELOG.md');
  const unreleased = changelog.slice(changelog.indexOf('## [Unreleased]'), changelog.indexOf('\n## [', changelog.indexOf('## [Unreleased]') + 1));
  for (const name of REMOVED) {
    expect(unreleased).toContain(`/plugin uninstall ${name}@agentsys`);
    expect(unreleased).toContain(`agentsys remove ${name}`);
  }
  for (const platform of ['OpenCode', 'Codex', 'Cursor', 'Kiro']) expect(unreleased).toContain(platform);
});
