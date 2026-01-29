const { parseMetrics } = require('../lib/perf/benchmark-runner');

describe('perf benchmark parser', () => {
  it('parses single scenario metrics', () => {
    const output = [
      'noise',
      'PERF_METRICS_START',
      '{"latency_ms":120,"throughput_rps":450}',
      'PERF_METRICS_END',
      'tail'
    ].join('\n');

    const result = parseMetrics(output);
    expect(result.ok).toBe(true);
    expect(result.metrics.latency_ms).toBe(120);
  });

  it('parses multi-scenario metrics', () => {
    const output = [
      'PERF_METRICS_START',
      '{"scenarios":{"low":{"latency_ms":120},"high":{"latency_ms":450}}}',
      'PERF_METRICS_END'
    ].join('\n');

    const result = parseMetrics(output);
    expect(result.ok).toBe(true);
    expect(result.metrics.scenarios.low.latency_ms).toBe(120);
  });

  it('parses line metrics', () => {
    const output = [
      'noise',
      'PERF_METRICS latency_ms=120 throughput_rps=450',
      'tail'
    ].join('\n');

    const result = parseMetrics(output);
    expect(result.ok).toBe(true);
    expect(result.metrics.latency_ms).toBe(120);
    expect(result.metrics.throughput_rps).toBe(450);
  });

  it('parses line metrics with scenarios', () => {
    const output = [
      'PERF_METRICS scenario=low latency_ms=120',
      'PERF_METRICS scenario=high latency_ms=450'
    ].join('\n');

    const result = parseMetrics(output);
    expect(result.ok).toBe(true);
    expect(result.metrics.scenarios.low.latency_ms).toBe(120);
    expect(result.metrics.scenarios.high.latency_ms).toBe(450);
  });

  it('fails when markers are missing', () => {
    const result = parseMetrics('no metrics here');
    expect(result.ok).toBe(false);
  });
});
