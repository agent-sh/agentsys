/**
 * Profiling execution helper.
 *
 * @module lib/perf/profiling-runner
 */

const { execFileSync } = require('child_process');
const profilers = require('./profilers');
const { parseCommand, resolveExecutableForPlatform } = require('../utils/command-parser');

/**
 * Run a profiling command and return artifacts/hotspots metadata.
 * @param {object} options
 * @param {string} [options.repoPath]
 * @param {object} [options.profileOptions]
 * @returns {{ ok: boolean, result?: object, error?: string }}
 */
function runProfiling(options = {}) {
  const repoPath = options.repoPath || process.cwd();
  const timeoutMs = Number.isFinite(options.timeoutMs)
    ? Math.max(1, Math.floor(options.timeoutMs))
    : null;
  const profiler = profilers.selectProfiler(repoPath);

  if (!profiler || typeof profiler.buildCommand !== 'function') {
    return { ok: false, error: 'No profiler available' };
  }

  const command = profiler.buildCommand({
    command: options.command,
    output: options.output,
    ...(options.profileOptions || {})
  });
  const parsedCommand = parseCommand(command, 'Profiling command');
  const executable = resolveExecutableForPlatform(parsedCommand.executable);
  const env = {
    ...process.env,
    ...(options.env || {})
  };
  try {
    const execOptions = {
      stdio: 'pipe',
      env,
      cwd: repoPath,
      windowsHide: true
    };
    if (timeoutMs !== null) {
      execOptions.timeout = timeoutMs;
    }

    execFileSync(executable, parsedCommand.args, execOptions);
  } catch (error) {
    const stderr = error.stderr ? String(error.stderr).trim() : '';
    const stdout = error.stdout ? String(error.stdout).trim() : '';
    const details = stderr || stdout || error.message;
    return { ok: false, error: `Profiling command failed: ${details}` };
  }

  const parsed = typeof profiler.parseOutput === 'function'
    ? profiler.parseOutput()
    : { tool: profiler.id, hotspots: [], artifacts: [] };

  const result = {
    tool: profiler.id,
    command: parsedCommand.display,
    hotspots: parsed.hotspots || [],
    artifacts: parsed.artifacts || []
  };

  return { ok: true, result };
}

module.exports = {
  runProfiling
};
