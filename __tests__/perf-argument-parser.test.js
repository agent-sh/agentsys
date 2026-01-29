const { parseArguments } = require('../lib/perf/argument-parser');

describe('perf argument parser', () => {
  it('parses argv arrays with greedy flags', () => {
    const args = parseArguments([
      '--change',
      'repo-map',
      'oneshot',
      'runs3',
      '--runs',
      '3',
      '--aggregate',
      'median'
    ]);

    expect(args).toEqual([
      '--change',
      'repo-map oneshot runs3',
      '--runs',
      '3',
      '--aggregate',
      'median'
    ]);
  });

  it('parses quoted strings from raw input', () => {
    const args = parseArguments('--scenario \"repo map\" --runs 2');
    expect(args).toEqual(['--scenario', 'repo map', '--runs', '2']);
  });
});
