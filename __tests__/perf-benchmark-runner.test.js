const { parseMetrics, aggregateMetrics } = require('../lib/perf/benchmark-runner');

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

  it('aggregates median metrics', () => {
    const samples = [
      { duration_ms: 12, files: 3 },
      { duration_ms: 10, files: 3 },
      { duration_ms: 14, files: 3 }
    ];
    const result = aggregateMetrics(samples, 'median');
    expect(result.duration_ms).toBe(12);
    expect(result.files).toBe(3);
  });

  it('aggregates scenario metrics', () => {
    const samples = [
      { scenarios: { low: { latency_ms: 10 }, high: { latency_ms: 20 } } },
      { scenarios: { low: { latency_ms: 12 }, high: { latency_ms: 22 } } },
      { scenarios: { low: { latency_ms: 11 }, high: { latency_ms: 21 } } }
    ];
    const result = aggregateMetrics(samples, 'median');
    expect(result.scenarios.low.latency_ms).toBe(11);
    expect(result.scenarios.high.latency_ms).toBe(21);
  });
});
