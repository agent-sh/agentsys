'use strict';

const transforms = require('../lib/adapter-transforms');

// A namespace of a plugin the marketplace still lists is stripped: deslop and
// learn, and skillers and agnix, whose commands spawn `skillers:skillers-compactor`
// and `agnix:agnix-agent`. next-task, web-ctl, ship and repo-intel left the
// marketplace (#434, #365 and the ship/repo-intel removal), repo-map became
// repo-intel, and prepare-delivery, sync-docs, audit-project, enhance, perf,
// drift-detect, consult, debate, onboard and can-i-help left on 2026-10-26: a
// retired namespace is left as written.
const KEPT = ['deslop', 'learn', 'skillers', 'agnix'];
const RETIRED = [
  'ship', 'repo-intel', 'repo-map', 'gate-and-ship', 'next-task', 'web-ctl',
  'prepare-delivery', 'sync-docs', 'audit-project', 'enhance', 'perf', 'drift-detect',
  'consult', 'debate', 'onboard', 'can-i-help'
];

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
