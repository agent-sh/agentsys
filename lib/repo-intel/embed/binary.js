'use strict';

/**
 * Binary resolver for `agent-analyzer-embed`.
 *
 * Mirrors the structure of `lib/binary/index.js` but for the separate
 * embedder binary. Kept as its own module rather than parameterizing
 * the existing resolver — the current single-binary helper is heavily
 * specialized and a refactor would touch every call site for one
 * use case.
 *
 * Both binaries share:
 *   - the same install dir (`~/.agent-sh/bin/`)
 *   - the same release-tag-aware download (latest tag with TTL cache)
 *   - the same platform map
 *
 * They differ in:
 *   - binary name (`agent-analyzer-embed` here)
 *   - GitHub release asset path uses the embed binary name
 *
 * @module lib/embed/binary
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const cp = require('child_process');

// Reuse PLATFORM_MAP from the main resolver to avoid drift if a new
// platform is added.
const mainBinary = require('../../binary');
// Reuse HTTP + archive helpers so a single bug fix to e.g. timeout
// behavior or redirect handling lands once and applies to both
// binaries (`agent-analyzer` and `agent-analyzer-embed`).
const sharedHelpers = require('../../binary/shared-helpers');

const EMBED_BINARY_NAME = 'agent-analyzer-embed';
const EMBED_GITHUB_REPO = 'agent-sh/agent-analyzer';
const LATEST_VERSION_TTL_MS = 60 * 60 * 1000;
const PLATFORM_MAP = mainBinary.PLATFORM_MAP;

function getBinaryPath() {
  const ext = process.platform === 'win32' ? '.exe' : '';
  return path.join(os.homedir(), '.agent-sh', 'bin', EMBED_BINARY_NAME + ext);
}

// Platform-specific ONNX Runtime dylib bundled beside the embed binary in the
// release tarball (see release.yml). The Rust binary's runtime resolver
// (resolve_and_preflight_ort) looks for exactly this name next to the
// executable. Mirrored here so the JS side can tell whether an existing
// install predates the bundling and needs a re-download.
function getBundledOrtName() {
  if (process.platform === 'win32') return 'onnxruntime.dll';
  if (process.platform === 'darwin') return 'libonnxruntime.dylib';
  return 'libonnxruntime.so';
}

function getBundledOrtPath() {
  return path.join(path.dirname(getBinaryPath()), getBundledOrtName());
}

// musl has no bundled ORT (no MS musl build; a glibc dylib cannot dlopen under
// musl). On musl we never expect a sibling lib, so its absence must not trigger
// a perpetual re-download loop.
function platformBundlesOrt() {
  const key = getPlatformKey();
  return !!key && !key.includes('musl');
}

function getPlatformKey() {
  const key = process.platform + '-' + process.arch;
  return PLATFORM_MAP[key] || null;
}

function getVersion() {
  const binPath = getBinaryPath();
  if (!fs.existsSync(binPath)) return null;
  try {
    const out = cp.execFileSync(binPath, ['--version'], {
      timeout: 5000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    const match = out.trim().match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : out.trim();
  } catch (e) {
    return null;
  }
}

function isAvailable() {
  return fs.existsSync(getBinaryPath());
}

let _latestVersionCache = null;

async function getLatestReleaseVersion() {
  if (
    _latestVersionCache &&
    Date.now() - _latestVersionCache.fetchedAt < LATEST_VERSION_TTL_MS
  ) {
    return _latestVersionCache.version;
  }
  return new Promise(function (resolve, reject) {
    const ghToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    const headers = {
      'User-Agent': 'agent-sh/embed-resolver',
      'Accept': 'application/vnd.github+json'
    };
    if (ghToken) headers['Authorization'] = 'Bearer ' + ghToken;

    const url = 'https://api.github.com/repos/' + EMBED_GITHUB_REPO + '/releases/latest';
    const fail = function (msg) {
      reject(new Error(msg + ' fetching ' + url));
    };
    const req = https.get(url, { headers: headers, timeout: 5000 }, function (res) {
      if (res.statusCode !== 200) {
        res.resume();
        fail('HTTP ' + res.statusCode);
        return;
      }
      const chunks = [];
      res.on('data', function (chunk) { chunks.push(chunk); });
      res.on('end', function () {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          const tag = (body && body.tag_name) || '';
          const version = tag.replace(/^v/, '');
          if (/^\d+\.\d+\.\d+/.test(version)) {
            _latestVersionCache = { version: version, fetchedAt: Date.now() };
            resolve(version);
          } else {
            fail('No valid release tag');
          }
        } catch (e) {
          fail('Failed to parse release JSON: ' + e.message);
        }
      });
      res.on('error', function (e) { fail(e.message); });
    });
    req.on('error', function (e) { fail(e.message); });
    req.on('timeout', function () { req.destroy(); fail('Timeout'); });
  });
}

function buildDownloadUrl(ver, platformKey) {
  const ext = process.platform === 'win32' ? '.zip' : '.tar.gz';
  return (
    'https://github.com/' +
    EMBED_GITHUB_REPO +
    '/releases/download/v' +
    ver +
    '/' +
    EMBED_BINARY_NAME +
    '-' +
    platformKey +
    ext
  );
}

// Per-call shim so the embed resolver passes its own User-Agent
// header without duplicating the rest of the HTTP plumbing.
function downloadToBuffer(url) {
  return sharedHelpers.downloadToBuffer(url, { userAgent: 'agent-sh/embed-resolver' });
}

const extractTarGz = sharedHelpers.extractTarGz;
const extractZip = sharedHelpers.extractZip;

async function downloadBinary(ver) {
  const platformKey = getPlatformKey();
  if (!platformKey) {
    throw new Error(
      'Unsupported platform: ' + process.platform + '-' + process.arch + '. ' +
      'Supported: ' + Object.keys(PLATFORM_MAP).join(', ')
    );
  }
  const url = buildDownloadUrl(ver, platformKey);
  process.stderr.write('Downloading ' + EMBED_BINARY_NAME + ' v' + ver + ' for ' + platformKey + '...\n');

  const binPath = getBinaryPath();
  const binDir = path.dirname(binPath);
  fs.mkdirSync(binDir, { recursive: true });

  let buf;
  try {
    buf = await downloadToBuffer(url);
  } catch (err) {
    throw new Error(
      'Failed to download ' + EMBED_BINARY_NAME + ':\n' +
      '  URL: ' + url + '\n' +
      '  Error: ' + err.message + '\n\n' +
      'To install manually:\n' +
      '  1. Download: ' + url + '\n' +
      '  2. Extract the binary to: ' + binDir + '\n' +
      '  3. Ensure it is named: ' + path.basename(binPath)
    );
  }

  if (process.platform === 'win32') {
    await extractZip(buf, binDir, path.basename(binPath));
  } else {
    await extractTarGz(buf, binDir);
  }
  if (process.platform !== 'win32') {
    fs.chmodSync(binPath, 0o755);
  }
  return binPath;
}

async function ensureBinary(options) {
  const opts = options || {};
  const binPath = getBinaryPath();
  if (fs.existsSync(binPath)) {
    // An install from before ORT bundling has the binary but no sibling
    // dylib; without it the embedder fails at runtime. Re-download once to
    // pick up the bundled lib. Skip on musl (never bundled) so this can't loop.
    if (platformBundlesOrt() && !fs.existsSync(getBundledOrtPath())) {
      const targetVer = opts.version || (await getLatestReleaseVersion());
      return downloadBinary(targetVer);
    }
    return binPath;
  }
  const targetVer = opts.version || (await getLatestReleaseVersion());
  return downloadBinary(targetVer);
}

module.exports = {
  EMBED_BINARY_NAME,
  getBinaryPath,
  getBundledOrtName,
  getBundledOrtPath,
  platformBundlesOrt,
  getVersion,
  getPlatformKey,
  getLatestReleaseVersion,
  isAvailable,
  ensureBinary,
  buildDownloadUrl
};
