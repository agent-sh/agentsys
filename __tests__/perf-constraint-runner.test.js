const { runConstraintTest } = require('../lib/perf/constraint-runner');

describe('perf constraint runner', () => {
  it('returns baseline, constrained, and delta metrics', () => {
    const command = 'node -e "console.log(\'PERF_METRICS_START\'); console.log(JSON.stringify({latency_ms:120})); console.log(\'PERF_METRICS_END\');"';
    const result = runConstraintTest({
      command,
      constraints: { cpu: '1', memory: '1GB' }
    });

    expect(result.baseline.metrics.latency_ms).toBe(120);
    expect(result.constrained.metrics.latency_ms).toBe(120);
    expect(result.delta.metrics.latency_ms.delta).toBe(0);
  });
});
