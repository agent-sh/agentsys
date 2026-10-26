'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// next-task left the marketplace and its repo was deleted (#434). Its policy
// questions, its task release and its ship hand-off docs go with it.
const repoRoot = path.join(__dirname, '..');

test('lib has no policy-question library or export', () => {
  const lib = require('../lib');
  expect(lib.policyQuestions).toBeUndefined();
  for (const name of ['getPolicyQuestions', 'getCustomNameQuestion', 'parseAndCachePolicy', 'getProjectQuestions']) {
    expect(lib.sources[name]).toBeUndefined();
  }
  expect(fs.existsSync(path.join(repoRoot, 'lib', 'sources', 'policy-questions.js'))).toBe(false);
});

test('workflow state has no task release', () => {
  expect(require('../lib/state/workflow-state').releaseTask).toBeUndefined();
  expect(require('../lib').workflowState.releaseTask).toBeUndefined();
});

test('migrate-opencode does not read a policy-questions file', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'migrate-opencode-'));
  try {
    fs.mkdirSync(path.join(target, 'lib', 'sources'), { recursive: true });
    fs.writeFileSync(
      path.join(target, 'lib', 'sources', 'policy-questions.js'),
      "module.exports = [{ label: 'A label well past the thirty character limit' }];\n"
    );
    const result = spawnSync(process.execPath, [path.join(repoRoot, 'scripts', 'migrate-opencode.js'), '--target', target, '--dry-run'], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).not.toMatch(/label/i);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test('docs describe no ship state-file hand-off', () => {
  const hits = [];
  for (const rel of ['docs/workflows/SHIP.md', 'docs/USAGE.md', 'agent-docs/workflow.md', 'checklists/cross-platform-compatibility.md']) {
    fs.readFileSync(path.join(repoRoot, rel), 'utf8').split('\n').forEach((line, i) => {
      if (/--state-file|releaseTask|nextPhase|policy-questions/.test(line)) hits.push(`${rel}:${i + 1}`);
    });
  }
  expect(hits).toEqual([]);
});
