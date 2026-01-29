const { runOptimizationExperiment } = require('../lib/perf/optimization-runner');

describe('perf optimization runner', () => {
  it('runs experiment and returns delta', () => {
    const command = 'node -e "console.log(\'PERF_METRICS_START\'); console.log(JSON.stringify({latency_ms:120})); console.log(\'PERF_METRICS_END\');"';
    const result = runOptimizationExperiment({
      command,
      changeSummary: 'noop change',
      requireClean: false
    });

    expect(result.baseline.metrics.latency_ms).toBe(120);
    expect(result.experiment.metrics.latency_ms).toBe(120);
    expect(result.delta.metrics.latency_ms.delta).toBe(0);
  });
});
