'use strict';

const transforms = require('../lib/adapter-transforms');

// next-task and web-ctl left the marketplace and repo-map became repo-intel
// (#434 and #365): a retired namespace is left as written.
describe('adapter transforms strip agent-sh plugin namespaces', () => {
  const content = '---\nname: x\ndescription: d\n---\n' +
    'Use `ship:release-agent`, `deslop:deslop-agent` and `repo-intel:map-validator`.\n' +
    'Not `next-task:ci-fixer`, `web-ctl:web-session` or `repo-map:map-validator`.\n';
  const cases = {
    transformRuleForCursor: () => transforms.transformRuleForCursor(content, {}),
    transformSkillForCursor: () => transforms.transformSkillForCursor(content, {}),
    transformCommandForCursor: () => transforms.transformCommandForCursor(content, {}),
    transformSkillForKiro: () => transforms.transformSkillForKiro(content, {}),
    transformCommandForKiro: () => transforms.transformCommandForKiro(content, {}),
    transformAgentForKiro: () => JSON.parse(transforms.transformAgentForKiro(content, {})).prompt,
  };

  test.each(Object.keys(cases))('%s strips current plugin namespaces and leaves retired ones alone', (name) => {
    const out = cases[name]();
    expect(out).toContain('`release-agent`');
    expect(out).toContain('`deslop-agent`');
    expect(out).toContain('`next-task:ci-fixer`');
    expect(out).toContain('and `map-validator`.');
    expect(out).toContain('`web-ctl:web-session`');
    expect(out).toContain('`repo-map:map-validator`');
  });
});
