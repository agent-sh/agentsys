const fs = require('fs');
const path = require('path');
const { init } = require('../../lib/repo-map');
const { getStateDirPath } = require('../../lib/platform/state-dir');

const start = Date.now();
const stateDir = getStateDirPath(process.cwd());
const mapPath = path.join(stateDir, 'repo-map.json');
const stalePath = path.join(stateDir, 'repo-map.stale');

if (fs.existsSync(mapPath)) fs.unlinkSync(mapPath);
if (fs.existsSync(stalePath)) fs.unlinkSync(stalePath);

const rawLimit = parseInt(process.env.PERF_PARAM_VALUE || '0', 10);
const fileLimit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : undefined;
const rawDuration = parseInt(process.env.PERF_RUN_DURATION || '60', 10);
const targetSeconds = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 60;
const runMode = process.env.PERF_RUN_MODE === 'oneshot' ? 'oneshot' : 'duration';

init(process.cwd(), { force: true, fileLimit })
  .then((res) => {
    const durationMs = Date.now() - start;
    const metrics = {
      duration_ms: durationMs,
      files: res.summary?.files || 0,
      symbols: res.summary?.symbols || 0
    };

    const emitMetrics = () => {
      console.log('PERF_METRICS_START');
      console.log(JSON.stringify(metrics));
      console.log('PERF_METRICS_END');
    };

    if (runMode === 'oneshot') {
      emitMetrics();
      return;
    }

    const remaining = Math.max(0, targetSeconds * 1000 - durationMs);
    setTimeout(emitMetrics, remaining);
  })
  .catch((err) => {
    console.error(err.message || String(err));
    process.exit(1);
  });
