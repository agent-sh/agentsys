'use strict';

/**
 * High-level embed orchestration. Glues together:
 *
 *   user preference  →  binary download  →  scan/update  →  set-embeddings
 *
 * Called from the `/repo-intel enrich` command after the existing
 * weighter and summarizer Haiku agents finish; degrades to a no-op
 * when the user has chosen `embedder: "none"`.
 *
 * Also exposes `runUpdate()` for the standalone `/repo-intel embed
 * update` action group (and the `npx ... embed update` CI hook).
 *
 * @module lib/embed/orchestrator
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const preference = require('./preference');
const embedBinary = require('./binary');
const mainBinary = require('../../binary');
const cache = require('../cache');

/**
 * Should the orchestrator run for this repo? Returns false when the
 * user has not opted in (preference unset or 'none'), which lets
 * callers safely no-op without wrapping every call site in a guard.
 *
 * @param {string} cwd
 * @returns {boolean}
 */
function isEnabled(cwd) {
  const pref = preference.read(cwd);
  return pref.embedder === 'small' || pref.embedder === 'big';
}

/**
 * Run a full scan: ensures the embed binary is downloaded, runs the
 * scan subcommand, pipes the JSON document into `agent-analyzer
 * repo-intel set-embeddings`. Returns a small status object so callers
 * can report what happened.
 *
 * @param {string} cwd
 * @returns {Promise<{ran: boolean, files?: number, durationMs?: number, reason?: string}>}
 */
async function runScan(cwd) {
  if (!isEnabled(cwd)) {
    return { ran: false, reason: 'embedder preference is "none" or unset' };
  }
  const pref = preference.read(cwd);
  const detail = preference.detailToCliArg(pref.embedderDetail || 'balanced');

  const mapFile = cache.getPath(cwd);
  if (!fs.existsSync(mapFile)) {
    return { ran: false, reason: 'no repo-intel map found; run `/repo-intel init` first' };
  }

  const start = Date.now();
  const embedBin = await embedBinary.ensureBinary();
  const mainBin = await mainBinary.ensureBinary();

  const result = await streamEmbedToSetEmbeddings(
    embedBin,
    ['scan', cwd, '--variant', pref.embedder, '--detail', detail],
    mainBin,
    mapFile
  );
  return Object.assign({ ran: true, durationMs: Date.now() - start }, result);
}

/**
 * Run a delta update: only re-embeds files whose content hash differs
 * from the existing sidecar. Falls back to a full scan when no
 * sidecar exists yet.
 *
 * @param {string} cwd
 * @returns {Promise<{ran: boolean, files?: number, durationMs?: number, reason?: string}>}
 */
async function runUpdate(cwd) {
  if (!isEnabled(cwd)) {
    return { ran: false, reason: 'embedder preference is "none" or unset' };
  }
  const pref = preference.read(cwd);
  const detail = preference.detailToCliArg(pref.embedderDetail || 'balanced');

  const mapFile = cache.getPath(cwd);
  if (!fs.existsSync(mapFile)) {
    return { ran: false, reason: 'no repo-intel map; run `/repo-intel init` then `enrich`' };
  }

  const start = Date.now();
  const embedBin = await embedBinary.ensureBinary();
  const mainBin = await mainBinary.ensureBinary();

  const result = await streamEmbedToSetEmbeddings(
    embedBin,
    ['update', cwd, '--map-file', mapFile, '--variant', pref.embedder, '--detail', detail],
    mainBin,
    mapFile
  );
  return Object.assign({ ran: true, durationMs: Date.now() - start }, result);
}

/**
 * Status snapshot: which preference is set, whether the binary is
 * installed, whether the bundled ONNX Runtime is present, whether the
 * sidecar exists.
 *
 * `ortBundled` surfaces the prerequisite the embed binary needs at runtime:
 * the binary loads libonnxruntime from beside itself (shipped in the release
 * tarball). On a platform that bundles ORT, a present binary with a missing
 * lib means an upgrade re-download is pending - ensureBinary handles it, but
 * status reports it so callers can explain a one-time re-fetch.
 *
 * @param {string} cwd
 * @returns {{enabled: boolean, embedder?: string, embedderDetail?: string, binaryInstalled: boolean, ortBundled: boolean, sidecarExists: boolean, sidecarPath?: string}}
 */
function status(cwd) {
  const pref = preference.read(cwd);
  const mapFile = cache.getPath(cwd);
  const sidecarPath = deriveSidecarPath(mapFile);
  return {
    enabled: isEnabled(cwd),
    embedder: pref.embedder,
    embedderDetail: pref.embedderDetail,
    binaryInstalled: embedBinary.isAvailable(),
    ortBundled: !embedBinary.platformBundlesOrt() || fs.existsSync(embedBinary.getBundledOrtPath()),
    sidecarExists: fs.existsSync(sidecarPath),
    sidecarPath: sidecarPath
  };
}

/**
 * Stream the embed binary's stdout directly into the main binary's
 * `set-embeddings --input -` stdin. The intermediate JSON document
 * can run into the megabytes for big repos at high detail; piping
 * keeps memory flat instead of buffering the whole document.
 *
 * The promise resolves with `{ files }` when both children exit cleanly;
 * rejects with the failing child's exit code + captured stderr otherwise.
 *
 * Hardened against the failure modes a bare `pipe()` leaves open: a stream
 * error (e.g. set-embeddings dies mid-write) used to leave the promise
 * unsettled forever and leak the surviving process. Now any failure path
 * — spawn error, stream error, or non-zero exit — kills the sibling and
 * rejects once. Embed stderr is captured (not inherited) so the error
 * message carries the diagnostic instead of just an exit code.
 */
function streamEmbedToSetEmbeddings(embedBinPath, embedArgs, mainBinPath, mapFile) {
  return new Promise(function (resolve, reject) {
    const embedChild = cp.spawn(embedBinPath, embedArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });
    const setChild = cp.spawn(
      mainBinPath,
      ['repo-intel', 'set-embeddings', '--map-file', mapFile, '--input', '-'],
      { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }
    );

    let embedExit = null;
    let setExit = null;
    let settled = false;
    let setStdout = '';
    let embedStderr = '';
    let setStderr = '';

    // Single exit path. Kills the sibling on any failure so neither process
    // is left running against a closed pipe (FD leak / zombie).
    function done(err, value) {
      if (settled) return;
      settled = true;
      if (err) {
        try { embedChild.kill('SIGTERM'); } catch (e) { /* already gone */ }
        try { setChild.kill('SIGTERM'); } catch (e) { /* already gone */ }
        reject(err);
      } else {
        resolve(value);
      }
    }

    function maybeFinish() {
      if (settled || embedExit === null || setExit === null) return;
      if (embedExit !== 0) {
        return done(new Error(
          embedBinary.EMBED_BINARY_NAME + ' exited ' + embedExit +
          (embedStderr.trim() ? ': ' + embedStderr.trim().slice(0, 500) : '')
        ));
      }
      if (setExit !== 0) {
        return done(new Error(
          'agent-analyzer set-embeddings exited ' + setExit +
          (setStderr.trim() ? ': ' + setStderr.trim().slice(0, 500) : '')
        ));
      }
      const m = setStdout.match(/(\d+)\s+files?/);
      done(null, { files: m ? parseInt(m[1], 10) : undefined });
    }

    // stderr piped (not inherited) so failures carry a message.
    embedChild.stderr.on('data', function (d) { embedStderr += d.toString('utf8'); });
    setChild.stderr.on('data', function (d) { setStderr += d.toString('utf8'); });
    setChild.stdout.on('data', function (d) { setStdout += d.toString('utf8'); });

    // Stream wiring with error handling on BOTH ends of the pipe — a bare
    // .pipe() swallows these and hangs.
    embedChild.stdout.on('error', function (e) { done(e); });
    setChild.stdin.on('error', function (e) {
      // EPIPE when set-embeddings has already exited is benign — its close
      // handler reports the real cause. Only surface other stdin errors.
      if (e && e.code !== 'EPIPE') done(e);
    });
    embedChild.stdout.pipe(setChild.stdin);

    embedChild.on('error', function (e) { done(e); });
    setChild.on('error', function (e) { done(e); });
    embedChild.on('close', function (code) { embedExit = code; maybeFinish(); });
    setChild.on('close', function (code) { setExit = code; maybeFinish(); });
  });
}

function deriveSidecarPath(mapFile) {
  if (!mapFile) return '';
  const dir = path.dirname(mapFile);
  const stem = path.basename(mapFile, path.extname(mapFile));
  return path.join(dir, stem + '.embeddings.bin');
}

module.exports = {
  isEnabled,
  runScan,
  runUpdate,
  status,
  // exported for testing the dual-process pipe in isolation
  streamEmbedToSetEmbeddings
};
