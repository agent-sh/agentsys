const { main, findHardcodedTestCounts } = require('../scripts/validate-repo-consistency');

describe('hard-coded test count guard', () => {
  test('flags an exact count in prose, with or without a plus', () => {
    expect(findHardcodedTestCounts('<b>50 agents · 3,518 tests · 5 platforms</b>')).toHaveLength(1);
    expect(findHardcodedTestCounts('- [x] All 3,445+ tests passing')).toHaveLength(1);
    expect(findHardcodedTestCounts('Works with Kiro. 3662 tests. Production-grade.')).toHaveLength(1);
    expect(findHardcodedTestCounts('Runs 3.6k tests, 3,518 unit tests or 1307+ test cases')).toHaveLength(1);
    expect(findHardcodedTestCounts('`npm test` passes (all 1307+ tests)')).toHaveLength(1);
  });

  test('flags a Tests stat tile in site JSON and HTML', () => {
    expect(findHardcodedTestCounts('      "label": "Tests",')).toHaveLength(1);
    expect(findHardcodedTestCounts('<span class="stats__label">Tests Passing</span>')).toHaveLength(1);
  });

  test('reports the line number', () => {
    const hits = findHardcodedTestCounts('one\ntwo\n3,518 tests passing\n');
    expect(hits).toEqual([{ line: 3, text: '3,518 tests passing' }]);
  });

  test('allows prose with no number', () => {
    expect(findHardcodedTestCounts('30k lines of lib code · tests on Linux and Windows · 5 platforms')).toEqual([]);
    expect(findHardcodedTestCounts('- Jest suite runs on Linux and Windows in CI')).toEqual([]);
    expect(findHardcodedTestCounts('Multi-agent review loop (code, security, perf, tests)')).toEqual([]);
    expect(findHardcodedTestCounts('<span class="stats__label">Platforms</span>')).toEqual([]);
  });

  test('README, docs and site carry no exact test count', () => {
    const originalLog = console.log;
    console.log = jest.fn();
    try {
      expect(main()).toBe(0);
    } finally {
      console.log = originalLog;
    }
  });
});
