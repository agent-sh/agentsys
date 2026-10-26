'use strict';

const transforms = require('../lib/adapter-transforms');

// next-task left the marketplace and its repo was deleted (#434): its namespace
// is no longer one of ours, so a mention of it is left as written.
describe('adapter transforms strip agent-sh plugin namespaces', () => {
  const content = '---\nname: x\ndescription: d\n---\n' +
    'Use `ship:release-agent`, then `deslop:deslop-agent`. Not `next-task:ci-fixer`.\n';
  const cases = {
    transformRuleForCursor: () => transforms.transformRuleForCursor(content, {}),
    transformSkillForCursor: () => transforms.transformSkillForCursor(content, {}),
    transformCommandForCursor: () => transforms.transformCommandForCursor(content, {}),
    transformSkillForKiro: () => transforms.transformSkillForKiro(content, {}),
    transformCommandForKiro: () => transforms.transformCommandForKiro(content, {}),
    transformAgentForKiro: () => JSON.parse(transforms.transformAgentForKiro(content, {})).prompt,
  };

  test.each(Object.keys(cases))('%s strips ship: and deslop: and leaves next-task: alone', (name) => {
    const out = cases[name]();
    expect(out).toContain('`release-agent`');
    expect(out).toContain('`deslop-agent`');
    expect(out).toContain('`next-task:ci-fixer`');
  });
});
