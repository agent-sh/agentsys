const { runBreakingPointSearch } = require('../lib/perf/breaking-point-runner');

describe('perf breaking point runner', () => {
  let originalAllowShort;

  beforeEach(() => {
    originalAllowShort = process.env.PERF_ALLOW_SHORT;
    process.env.PERF_ALLOW_SHORT = '1';
  });

  afterEach(() => {
    if (originalAllowShort === undefined) {
      delete process.env.PERF_ALLOW_SHORT;
    } else {
      process.env.PERF_ALLOW_SHORT = originalAllowShort;
    }
  });

  it('finds breaking point in synthetic range', async () => {
    const originalEnv = process.env.PERF_PARAM_VALUE;

    const result = await runBreakingPointSearch({
      command: 'node -e "const v=parseInt(process.env.PERF_PARAM_VALUE||\'0\',10); if(v>=5){process.exit(1);} console.log(\'PERF_METRICS_START\\n{}\\nPERF_METRICS_END\');"',
      paramEnv: 'PERF_PARAM_VALUE',
      min: 1,
      max: 8
    });

    process.env.PERF_PARAM_VALUE = originalEnv;

    expect(result.attempts).toBeGreaterThan(0);
    expect(result.breakingPoint).toBe(5);
  });
});
