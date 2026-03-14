'use strict';

/**
 * Binary resolver for the agent-analyzer Rust binary.
 *
 * Handles lazy downloading and execution. Since Claude Code plugins have no
 * postinstall hooks, the binary is downloaded at runtime on first use.
 *
 * @module lib/binary
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const cp = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(cp.execFile);

const { ANALYZER_MIN_VERSION, BINARY_NAME, GITHUB_REPO } = require('./version');

const PLATFORM_MAP = {
  'darwin-arm64': 'aarch64-apple-darwin',
  'darwin-x64':   'x86_64-apple-darwin',
  'linux-x64':    'x86_64-unknown-linux-gnu',
  'linux-arm64':  'aarch64-unknown-linux-gnu',
  'win32-x64':    'x86_64-pc-windows-msvc'
};

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/**
 * Returns the expected path to the agent-analyzer binary.
 * @returns {string}
 */
function getBinaryPath() {
  const ext = process.platform === 'win32' ? '.exe' : '';
  return path.join(os.homedir(), '.agent-sh', 'bin', BINARY_NAME + ext);
}

/**
 * Returns the Rust target triple for the current platform.
 * @returns {string|null}
 */
function getPlatformKey() {
  const key = process.platform + '-' + process.arch;
  return PLATFORM_MAP[key] || null;
}

// ---------------------------------------------------------------------------
// Version helpers
// ---------------------------------------------------------------------------

/**
 * Compare a version string against a minimum requirement.
 * @param {string} version
 * @param {string} minVersion
 * @returns {boolean}
 */
function meetsMinimumVersion(version, minVersion) {
  if (!version) return false;
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return false;
  const parts = match.slice(1).map(Number);
  const req = minVersion.split('.').map(Number);
  if (parts[0] > req[0]) return true;
  if (parts[0] < req[0]) return false;
  if (parts[1] > req[1]) return true;
  if (parts[1] < req[1]) return false;
  return parts[2] >= req[2];
}

/**
 * Run the binary with --version and return the version string, or null on failure.
 * @returns {string|null}
 */
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

// ---------------------------------------------------------------------------
// Availability checks
// ---------------------------------------------------------------------------

/**
 * Sync check: returns true if the binary exists and meets the minimum version.
 * Does NOT download.
 * @returns {boolean}
 */
function isAvailable() {
  const binPath = getBinaryPath();
  if (!fs.existsSync(binPath)) return false;
  const ver = getVersion();
  return meetsMinimumVersion(ver, ANALYZER_MIN_VERSION);
}

/**
 * Async check: returns true if the binary exists and meets the minimum version.
 * Does NOT download.
 * @returns {Promise<boolean>}
 */
async function isAvailableAsync() {
  return isAvailable();
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

/**
 * Build the GitHub release download URL.
 * @param {string} ver
 * @param {string} platformKey
 * @returns {string}
 */
function buildDownloadUrl(ver, platformKey) {
  const ext = process.platform === 'win32' ? '.zip' : '.tar.gz';
  return 'https://github.com/' + GITHUB_REPO + '/releases/download/v' + ver + '/' + BINARY_NAME + '-' + platformKey + ext;
}

/**
 * Download a URL to a Buffer, following up to 5 redirects.
 * Supports GITHUB_TOKEN / GH_TOKEN for auth.
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
function downloadToBuffer(url) {
  return new Promise(function(resolve, reject) {
    const ghToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

    function request(reqUrl, redirectCount) {
      if (redirectCount > 5) {
        reject(new Error('Too many redirects fetching from ' + url));
        return;
      }
      const headers = {
        'User-Agent': 'agent-core/binary-resolver',
        'Accept': 'application/octet-stream'
      };
      if (ghToken) headers['Authorization'] = 'Bearer ' + ghToken;

      https.get(reqUrl, { headers: headers }, function(res) {
        const sc = res.statusCode;
        if (sc === 301 || sc === 302 || sc === 307 || sc === 308) {
          res.resume();
          request(res.headers.location, redirectCount + 1);
          return;
        }
        if (sc !== 200) {
          res.resume();
          const hint = sc === 403 ? ' (rate limited - set GITHUB_TOKEN env var)' : '';
          reject(new Error('HTTP ' + sc + hint + ' fetching ' + reqUrl));
          return;
        }
        const chunks = [];
        res.on('data', function(chunk) { chunks.push(chunk); });
        res.on('end', function() { resolve(Buffer.concat(chunks)); });
        res.on('error', reject);
      }).on('error', reject);
    }

    request(url, 0);
  });
}

/**
 * Extract a tar.gz buffer into a directory using the system tar command.
 * @param {Buffer} buf
 * @param {string} destDir
 * @returns {Promise<void>}
 */
function extractTarGz(buf, destDir) {
  return new Promise(function(resolve, reject) {
    const tarDest = process.platform === 'win32' ? destDir.replace(/\\/g, '/') : destDir;
    const tar = cp.spawn('tar', ['xz', '-C', tarDest], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let stderr = '';
    tar.stderr.on('data', function(d) { stderr += d; });
    tar.stdin.write(buf);
    tar.stdin.end();
    tar.on('close', function(code) {
      if (code !== 0) {
        reject(new Error('tar extraction failed (code ' + code + '): ' + stderr));
      } else {
        resolve();
      }
    });
    tar.on('error', reject);
  });
}

/**
 * Extract a zip buffer into a directory using PowerShell Expand-Archive (Windows).
 * @param {Buffer} buf
 * @param {string} destDir
 * @param {string} binaryName
 * @returns {Promise<void>}
 */
function extractZip(buf, destDir, binaryName) {
  return new Promise(function(resolve, reject) {
    const tmpZip = path.join(os.tmpdir(), binaryName + '-' + Date.now() + '.zip');
    fs.writeFileSync(tmpZip, buf);
    const cmd = 'Expand-Archive -Path \'' + tmpZip + '\' -DestinationPath \'' + destDir + '\' -Force';
    const ps = cp.spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', cmd], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stderr = '';
    ps.stderr.on('data', function(d) { stderr += d; });
    ps.on('close', function(code) {
      try { fs.unlinkSync(tmpZip); } catch (e) { /* ignore */ }
      if (code !== 0) {
        reject(new Error('zip extraction failed (code ' + code + '): ' + stderr));
      } else {
        resolve();
      }
    });
    ps.on('error', reject);
  });
}

/**
 * Download and install the binary for the current platform into ~/.agent-sh/bin/.
 * @param {string} ver
 * @returns {Promise<string>}
 */
async function downloadBinary(ver) {
  const platformKey = getPlatformKey();
  if (!platformKey) {
    throw new Error(
      'Unsupported platform: ' + process.platform + '-' + process.arch + '. ' +
      'Supported platforms: ' + Object.keys(PLATFORM_MAP).join(', ')
    );
  }

  const url = buildDownloadUrl(ver, platformKey);
  process.stderr.write('Downloading ' + BINARY_NAME + ' v' + ver + ' for ' + platformKey + '...' + '\n');

  const binPath = getBinaryPath();
  const binDir = path.dirname(binPath);
  fs.mkdirSync(binDir, { recursive: true });

  let buf;
  try {
    buf = await downloadToBuffer(url);
  } catch (err) {
    throw new Error(
      'Failed to download ' + BINARY_NAME + ':\n' +
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

  const installedVer = getVersion();
  if (!installedVer) {
    throw new Error(
      BINARY_NAME + ' was downloaded to ' + binPath + ' but could not be executed. ' +
      'Check the file is a valid binary for this platform.'
    );
  }

  return binPath;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Ensure the binary exists and meets the minimum version. Downloads if needed.
 * @param {Object} [options]
 * @param {string} [options.version]
 * @returns {Promise<string>}
 */
async function ensureBinary(options) {
  const opts = options || {};
  const targetVer = opts.version || ANALYZER_MIN_VERSION;
  const binPath = getBinaryPath();

  if (fs.existsSync(binPath)) {
    const ver = getVersion();
    if (meetsMinimumVersion(ver, ANALYZER_MIN_VERSION)) {
      return binPath;
    }
  }

  return downloadBinary(targetVer);
}

/**
 * Sync version of ensureBinary. Downloads if needed via a child node process.
 * Prefer ensureBinary() unless a sync API is strictly required.
 * @param {Object} [options]
 * @param {string} [options.version]
 * @returns {string}
 */
function ensureBinarySync(options) {
  const binPath = getBinaryPath();

  if (fs.existsSync(binPath)) {
    const ver = getVersion();
    if (meetsMinimumVersion(ver, ANALYZER_MIN_VERSION)) {
      return binPath;
    }
  }

  const targetVer = (options && options.version) || ANALYZER_MIN_VERSION;
  const selfPath = __filename;
  const helperLines = [
    'var b = require(' + JSON.stringify(selfPath) + ');',
    'b.ensureBinary({ version: ' + JSON.stringify(targetVer) + ' })',
    '  .then(function(p) { process.stdout.write(p); })',
    '  .catch(function(e) { process.stderr.write(e.message); process.exit(1); });'
  ];

  try {
    const result = cp.execFileSync(process.execPath, ['-e', helperLines.join('\n')], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'inherit'],
      timeout: 120000
    });
    return result.trim() || binPath;
  } catch (err) {
    throw new Error('Failed to ensure binary (sync): ' + err.message);
  }
}

/**
 * Run agent-analyzer with the given arguments (sync). Downloads binary if needed.
 * @param {string[]} args
 * @param {Object} [options]
 * @returns {string}
 */
function runAnalyzer(args, options) {
  const binPath = ensureBinarySync();
  const opts = Object.assign({ encoding: 'utf8', windowsHide: true }, options);
  if (!opts.stdio) opts.stdio = ['pipe', 'pipe', 'pipe'];
  const result = cp.execFileSync(binPath, args, opts);
  return typeof result === 'string' ? result : result.toString('utf8');
}

/**
 * Run agent-analyzer with the given arguments asynchronously. Downloads binary if needed.
 * @param {string[]} args
 * @param {Object} [options]
 * @returns {Promise<string>}
 */
async function runAnalyzerAsync(args, options) {
  const binPath = await ensureBinary();
  const opts = Object.assign({ encoding: 'utf8', windowsHide: true }, options);
  const result = await execFileAsync(binPath, args, opts);
  return result.stdout;
}

module.exports = {
  ensureBinary,
  ensureBinarySync,
  runAnalyzer,
  runAnalyzerAsync,
  getBinaryPath,
  getVersion,
  getPlatformKey,
  isAvailable,
  isAvailableAsync,
  meetsMinimumVersion,
  buildDownloadUrl,
  PLATFORM_MAP
};
