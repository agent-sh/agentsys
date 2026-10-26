'use strict';

const transforms = require('../lib/adapter-transforms');

// A namespace of a plugin the marketplace still lists is stripped. next-task,
// web-ctl, ship and repo-intel left the marketplace (#434, #365 and the
// ship/repo-intel removal), and repo-map became repo-intel: a retired
// namespace is left as written.
const KEPT = ['deslop', 'sync-docs', 'audit-project', 'enhance', 'perf', 'drift-detect', 'consult', 'debate', 'learn'];
const RETIRED = ['ship', 'repo-intel', 'repo-map', 'gate-and-ship', 'next-task', 'web-ctl'];

describe('adapter transforms strip agent-sh plugin namespaces', () => {
  const body = [
    ...KEPT.map(ns => `Kept \`${ns}:${ns}-agent\`.`),
    ...RETIRED.map(ns => `Retired \`${ns}:${ns}-agent\`.`)
  ].join('\n');
  const content = '---\nname: x\ndescription: d\n---\n' + body + '\n';
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
    for (const ns of KEPT) {
      expect(out).toContain(`Kept \`${ns}-agent\`.`);
    }
    for (const ns of RETIRED) {
      expect(out).toContain(`Retired \`${ns}:${ns}-agent\`.`);
    }
  });
});
