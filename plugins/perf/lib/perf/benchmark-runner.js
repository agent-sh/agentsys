/**
 * Sequential benchmark runner utilities.
 *
 * @module lib/perf/benchmark-runner
 */

const { execSync } = require('child_process');
const { validateBaseline } = require('./schemas');

const DEFAULT_MIN_DURATION = 60;
const BINARY_SEARCH_MIN_DURATION = 30;
const DEFAULT_DURATION_SLACK_SECONDS = 1;

/**
 * Normalize benchmark options and enforce minimum durations.
 * @param {object} options
 * @returns {object}
 */
function normalizeBenchmarkOptions(options = {}) {
  const mode = options.mode || 'full';
  const minDuration = mode === 'binary-search'
    ? BINARY_SEARCH_MIN_DURATION
    : DEFAULT_MIN_DURATION;

  const duration = Math.max(options.duration || minDuration, minDuration);
  return {
    ...options,
    mode,
    duration,
    warmup: options.warmup || 10,
    allowShort: options.allowShort === true
  };
}

/**
 * Run a benchmark command synchronously (sequential only).
 * @param {string} command
 * @param {object} options
 * @returns {{ success: boolean, output: string }}
 */
function runBenchmark(command, options = {}) {
  if (!command || typeof command !== 'string') {
    throw new Error('Benchmark command must be a non-empty string');
  }

  const normalized = normalizeBenchmarkOptions(options);
  const env = { ...process.env, ...normalized.env };

  const start = Date.now();
  const output = execSync(command, {
    stdio: 'pipe',
    encoding: 'utf8',
    env
  });
  const elapsedSeconds = (Date.now() - start) / 1000;

  const allowShort = normalized.allowShort || process.env.PERF_ALLOW_SHORT === '1';
  if (!allowShort && elapsedSeconds + DEFAULT_DURATION_SLACK_SECONDS < normalized.duration) {
    throw new Error(`Benchmark finished too quickly (${elapsedSeconds.toFixed(2)}s < ${normalized.duration}s)`);
  }

  return {
    success: true,
    output,
    duration: normalized.duration,
    warmup: normalized.warmup,
    mode: normalized.mode,
    elapsedSeconds
  };
}

function parseLineMetrics(output) {
  const lines = output.split(/\r?\n/);
  const metrics = {};
  let sawMarker = false;

  for (const line of lines) {
    const markerIndex = line.indexOf('PERF_METRICS');
    if (markerIndex === -1) continue;

    sawMarker = true;
    const rest = line.slice(markerIndex + 'PERF_METRICS'.length).trim();
    if (!rest) continue;

    const tokens = rest.split(/\s+/).filter(Boolean);
    let scenario = null;
    const lineMetrics = {};

    for (const token of tokens) {
      const eqIndex = token.indexOf('=');
      if (eqIndex === -1) continue;

      const key = token.slice(0, eqIndex).trim();
      const rawValue = token.slice(eqIndex + 1).trim();
      if (!key) continue;

      if (key === 'scenario') {
        scenario = rawValue;
        continue;
      }

      const value = Number(rawValue);
      if (!Number.isFinite(value)) {
        return { ok: false, error: `Metric ${key} must be a number` };
      }

      lineMetrics[key] = value;
    }

    if (Object.keys(lineMetrics).length === 0) {
      continue;
    }

    if (scenario) {
      if (!metrics.scenarios) {
        metrics.scenarios = {};
      }
      metrics.scenarios[scenario] = {
        ...(metrics.scenarios[scenario] || {}),
        ...lineMetrics
      };
    } else {
      Object.assign(metrics, lineMetrics);
    }
  }

  if (!sawMarker) {
    return { ok: false, error: 'Metrics markers not found' };
  }

  return { ok: true, metrics };
}

/**
 * Parse metrics from benchmark output using PERF_METRICS markers.
 * @param {string} output
 * @returns {{ ok: boolean, metrics?: object, error?: string }}
 */
function parseMetrics(output) {
  if (typeof output !== 'string') {
    return { ok: false, error: 'Output must be a string' };
  }

  const startMarker = 'PERF_METRICS_START';
  const endMarker = 'PERF_METRICS_END';
  const startIndex = output.indexOf(startMarker);
  const endIndex = output.indexOf(endMarker);

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const jsonStart = startIndex + startMarker.length;
    const raw = output.slice(jsonStart, endIndex).trim();

    try {
      const parsed = JSON.parse(raw);
      const validation = validateBaseline({
        version: 'temp',
        recordedAt: new Date().toISOString(),
        command: 'temp',
        metrics: parsed
      });
      if (!validation.ok) {
        return { ok: false, error: `Invalid metrics: ${validation.errors.join(', ')}` };
      }
      return { ok: true, metrics: parsed };
    } catch (error) {
      return { ok: false, error: `Failed to parse metrics JSON: ${error.message}` };
    }
  }

  const lineParsed = parseLineMetrics(output);
  if (!lineParsed.ok) {
    return lineParsed;
  }

  const validation = validateBaseline({
    version: 'temp',
    recordedAt: new Date().toISOString(),
    command: 'temp',
    metrics: lineParsed.metrics
  });
  if (!validation.ok) {
    return { ok: false, error: `Invalid metrics: ${validation.errors.join(', ')}` };
  }
  return { ok: true, metrics: lineParsed.metrics };
}

module.exports = {
  DEFAULT_MIN_DURATION,
  BINARY_SEARCH_MIN_DURATION,
  normalizeBenchmarkOptions,
  runBenchmark,
  parseMetrics
};
