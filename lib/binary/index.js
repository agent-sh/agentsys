'use strict';

/**
 * Binary resolver for the agent-analyzer Rust binary.
 *
 * Handles lazy downloading and execution. Since Claude Code plugins have no
 * postinstall hooks, the binary is downloaded at runtime on first use.
 *
 * Security hardening (2026-04-26 audit):
 *   - Every release asset is verified against its `<asset>.sha256` sidecar
 *     before extraction. A mismatch aborts with a clear message.
 *   - Archives are extracted into an isolated tmpdir. Each entry path is
 *     validated to reject absolute paths, Windows drive letters, and parent
 *     traversal (`..`). The expected binary is then moved to the final
 *     destination; everything else is discarded.
 *   - The Windows zip path runs a PowerShell helper script via `-File` and
 *     passes paths through environment variables, so PowerShell never
 *     re-parses a command string (which broke on spaces/brackets). The
 *     script validates every zip entry before extracting it and rejects
 *     absolute, UNC, and parent-traversal entries.
 *
 * Verification chain (in order, each gate must pass to proceed):
 *   1. TLS - https.get() pins the GitHub CA chain at the OS level.
 *   2. SHA-256 sidecar - `<asset>.sha256` fetched from the same release and
 *      verified against the downloaded bytes. Closes basic tampering.
 *   3. SLSA build provenance (optional / required) - `gh attestation verify`
 *      checks the Sigstore-signed attestation that agent-analyzer's release
 *      workflow publishes via `actions/attest-build-provenance`. This closes
 *      the "stolen release token uploads attacker binary + attacker sha256"
 *      hole that steps 1 and 2 cannot see.
 *
 *      SLSA verification is SOFT by default: if `gh` is not on PATH we log
 *      a warning and proceed with just SHA-256. Set env var
 *      `AGENT_ANALYZER_REQUIRE_ATTESTATION=1` to make a missing `gh` a hard
 *      failure (recommended for CI). A present `gh` that reports a failed
 *      verification is ALWAYS a hard failure regardless of the env var.
 *
 * @module lib/binary
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const cp = require('child_process');
const crypto = require('crypto');
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
// Download + checksum verification
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
 * Parse the leading 64-hex digest from a `.sha256` sidecar body.
 * Tolerant of these formats (GNU coreutils + BSD `shasum`):
 *   "<64-hex>\n"
 *   "<64-hex>  <filename>\n"        (text mode, two-space separator)
 *   "<64-hex>  *<filename>\n"       (binary mode, leading asterisk)
 *   "<64-hex> <filename>\n"         (single-space variants)
 * Throws if no valid digest is found.
 * @param {string} body
 * @returns {string} lower-cased 64-char hex digest
 */
function parseSha256Sidecar(body) {
  if (typeof body !== 'string') body = String(body || '');
  const match = body.trim().match(/^([A-Fa-f0-9]{64})\b/);
  if (!match) {
    throw new Error('Could not parse SHA-256 digest from sidecar body');
  }
  return match[1].toLowerCase();
}

/**
 * Fetch and parse a `.sha256` sidecar next to an asset URL.
 * @param {string} assetUrl full URL of the archive (not the sidecar)
 * @returns {Promise<string>} lower-cased hex digest
 */
async function downloadSha256(assetUrl) {
  const sidecarUrl = assetUrl + '.sha256';
  const buf = await downloadToBuffer(sidecarUrl);
  return parseSha256Sidecar(buf.toString('utf8'));
}

/**
 * Compute the lower-case hex SHA-256 of a Buffer.
 * @param {Buffer} buf
 * @returns {string}
 */
function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * Verify a downloaded buffer against an expected hex digest.
 * Throws with a security-focused message on mismatch.
 * @param {Buffer} buf
 * @param {string} expectedHex
 * @param {string} filename user-facing name for the error message
 */
function verifySha256(buf, expectedHex, filename) {
  const expected = String(expectedHex || '').toLowerCase();
  const actual = sha256Hex(buf);
  if (expected !== actual) {
    throw new Error(
      'SHA-256 verification failed for ' + filename + ': ' +
      'expected ' + expected + ', got ' + actual + '. ' +
      'This could indicate a tampered release. Do not extract.'
    );
  }
}

// ---------------------------------------------------------------------------
// Archive entry validation
// ---------------------------------------------------------------------------

/**
 * Reject archive entries with paths that could escape the extract directory.
 * Rules:
 *   - No absolute POSIX paths (leading `/`)
 *   - No Windows absolute paths (drive letter like `C:\` or `C:/`)
 *   - No UNC paths (`\\server\share`)
 *   - No `..` as a path component
 *   - No empty entry names
 * @param {string} entry
 * @throws {Error} on unsafe entry
 */
function assertSafeArchiveEntry(entry) {
  if (!entry || typeof entry !== 'string') {
    throw new Error('Refusing to extract archive with empty entry name');
  }
  const name = entry.replace(/\\/g, '/').trim();
  if (name.length === 0) {
    throw new Error('Refusing to extract archive with empty entry name');
  }
  if (name.startsWith('//')) {
    throw new Error('Refusing to extract archive with UNC entry: ' + entry);
  }
  if (name.startsWith('/')) {
    throw new Error('Refusing to extract archive with absolute entry: ' + entry);
  }
  if (/^[A-Za-z]:[\\/]/.test(entry)) {
    throw new Error('Refusing to extract archive with Windows absolute entry: ' + entry);
  }
  const parts = name.split('/').filter(function(p) { return p.length > 0; });
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === '..') {
      throw new Error('Refusing to extract archive with parent-traversal entry: ' + entry);
    }
  }
}

/**
 * List the entries inside a tar.gz buffer by running `tar -tz` over stdin.
 * Returns the raw list; caller is responsible for validating each entry.
 * @param {Buffer} buf
 * @returns {Promise<string[]>}
 */
function listTarGzEntries(buf) {
  return new Promise(function(resolve, reject) {
    const tar = cp.spawn('tar', ['-tz'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    tar.stdout.on('data', function(d) { stdout += d; });
    tar.stderr.on('data', function(d) { stderr += d; });
    tar.on('error', reject);
    tar.on('close', function(code) {
      if (code !== 0) {
        reject(new Error('tar -tz listing failed (code ' + code + '): ' + stderr));
        return;
      }
      const entries = stdout.split(/\r?\n/).filter(function(l) { return l.length > 0; });
      resolve(entries);
    });
    tar.stdin.write(buf);
    tar.stdin.end();
  });
}

/**
 * Verify that a path resolved from extraction lies inside a known root.
 * Guards against symlinks and any surprise introduced by the OS extractor.
 * @param {string} root
 * @param {string} candidate
 */
function assertInsideRoot(root, candidate) {
  const rootResolved = path.resolve(root) + path.sep;
  const candResolved = path.resolve(candidate);
  if (candResolved !== path.resolve(root) && !candResolved.startsWith(rootResolved)) {
    throw new Error('Extracted path escapes extract root: ' + candidate);
  }
}

/**
 * Recursively walk a directory and return all file paths (not dirs).
 * Throws if any symlink is encountered (defense in depth: no surprise escapes).
 * @param {string} dir
 * @returns {string[]}
 */
function walkFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length > 0) {
    const cur = stack.pop();
    const st = fs.lstatSync(cur);
    if (st.isSymbolicLink()) {
      throw new Error('Refusing to follow symlink produced by extractor: ' + cur);
    }
    if (st.isDirectory()) {
      const names = fs.readdirSync(cur);
      for (let i = 0; i < names.length; i++) {
        stack.push(path.join(cur, names[i]));
      }
    } else if (st.isFile()) {
      out.push(cur);
    }
  }
  return out;
}

/**
 * Remove a directory tree, tolerating already-missing paths.
 * @param {string} dir
 */
function rmrf(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (e) {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

/**
 * Extract a tar.gz buffer into a scratch directory, validating entries first.
 * Returns the scratch directory; caller is responsible for moving files out
 * and calling rmrf() on it.
 * @param {Buffer} buf
 * @returns {Promise<string>} scratch dir
 */
async function extractTarGzToScratch(buf) {
  const entries = await listTarGzEntries(buf);
  for (let i = 0; i < entries.length; i++) {
    assertSafeArchiveEntry(entries[i]);
  }

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-analyzer-tar-'));

  try {
    await new Promise(function(resolve, reject) {
      const tar = cp.spawn('tar', ['xz', '-C', scratch], { stdio: ['pipe', 'pipe', 'pipe'] });
      let stderr = '';
      tar.stderr.on('data', function(d) { stderr += d; });
      tar.on('error', reject);
      tar.on('close', function(code) {
        if (code !== 0) {
          reject(new Error('tar extraction failed (code ' + code + '): ' + stderr));
        } else {
          resolve();
        }
      });
      tar.stdin.write(buf);
      tar.stdin.end();
    });

    // Defense in depth: reject any symlink or non-regular entry the OS
    // extractor may have created, and confirm every file resolves inside
    // scratch.
    const files = walkFiles(scratch);
    for (let i = 0; i < files.length; i++) {
      assertInsideRoot(scratch, files[i]);
    }
  } catch (err) {
    rmrf(scratch);
    throw err;
  }

  return scratch;
}

/**
 * PowerShell script body that validates and extracts a zip entry-by-entry
 * using .NET's System.IO.Compression.ZipFile. Paths and output dir are read
 * from environment variables (`SRC_ZIP`, `DEST_DIR`) so no argument parsing
 * can split on spaces, wildcards, or quotes.
 *
 * Rejects:
 *   - Absolute entry names (POSIX `/`, Windows `C:\`)
 *   - UNC entry names (`\\server\share`)
 *   - Any `..` path component
 *   - Resolved paths that escape the destination directory
 *
 * On any validation failure the script writes to stderr and exits with a
 * non-zero status; nothing is extracted.
 */
const EXTRACT_ZIP_PS1 = [
  '$ErrorActionPreference = "Stop"',
  '$src  = $env:SRC_ZIP',
  '$dest = $env:DEST_DIR',
  'if ([string]::IsNullOrEmpty($src) -or [string]::IsNullOrEmpty($dest)) {',
  '  [Console]::Error.WriteLine("SRC_ZIP and DEST_DIR must both be set"); exit 2',
  '}',
  'Add-Type -AssemblyName System.IO.Compression.FileSystem',
  '$destFull = [System.IO.Path]::GetFullPath($dest)',
  'if (-not $destFull.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {',
  '  $destFull = $destFull + [System.IO.Path]::DirectorySeparatorChar',
  '}',
  '$zip = [System.IO.Compression.ZipFile]::OpenRead($src)',
  'try {',
  '  foreach ($entry in $zip.Entries) {',
  '    $name = $entry.FullName',
  '    if ([string]::IsNullOrEmpty($name)) { continue }',
  '    $norm = $name -replace "\\\\","/"',
  '    if ($norm.StartsWith("/") -or $norm.StartsWith("//")) {',
  '      [Console]::Error.WriteLine("Refusing absolute/UNC entry: " + $name); exit 3',
  '    }',
  '    if ($name -match "^[A-Za-z]:[\\\\/]") {',
  '      [Console]::Error.WriteLine("Refusing Windows-absolute entry: " + $name); exit 3',
  '    }',
  '    foreach ($part in ($norm -split "/")) {',
  '      if ($part -eq "..") {',
  '        [Console]::Error.WriteLine("Refusing parent-traversal entry: " + $name); exit 3',
  '      }',
  '    }',
  '    $target = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($destFull, $norm))',
  '    if (-not $target.StartsWith($destFull, [System.StringComparison]::OrdinalIgnoreCase)) {',
  '      [Console]::Error.WriteLine("Entry escapes destination: " + $name); exit 3',
  '    }',
  '    if ($entry.FullName.EndsWith("/")) {',
  '      [System.IO.Directory]::CreateDirectory($target) | Out-Null',
  '    } else {',
  '      $parent = [System.IO.Path]::GetDirectoryName($target)',
  '      if ($parent) { [System.IO.Directory]::CreateDirectory($parent) | Out-Null }',
  '      [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $true)',
  '    }',
  '  }',
  '} finally {',
  '  $zip.Dispose()',
  '}'
].join('\r\n');

/**
 * Extract a zip buffer into a scratch directory.
 *
 * The extraction runs a PowerShell helper script via `-File` so PowerShell
 * never re-parses a command string (which would break on paths containing
 * spaces or brackets). The script reads the zip and destination paths from
 * environment variables, validates every entry's path before extracting, and
 * writes files individually using .NET's ZipFile APIs.
 *
 * After extraction, `walkFiles` re-checks the tree and rejects any symlink
 * or junction that might have been created.
 *
 * @param {Buffer} buf
 * @returns {Promise<string>} scratch dir
 */
async function extractZipToScratch(buf) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-analyzer-zip-'));
  const tmpZip = path.join(scratch, '__archive.zip');
  const scriptDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-analyzer-ps-'));
  const scriptPath = path.join(scriptDir, 'extract.ps1');

  try {
    fs.writeFileSync(tmpZip, buf);
    fs.writeFileSync(scriptPath, EXTRACT_ZIP_PS1, 'utf8');

    await new Promise(function(resolve, reject) {
      const child = cp.execFile(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy', 'Bypass',
          '-File', scriptPath
        ],
        {
          windowsHide: true,
          env: Object.assign({}, process.env, {
            SRC_ZIP: tmpZip,
            DEST_DIR: scratch
          })
        },
        function(err, _stdout, stderr) {
          if (err) {
            reject(new Error('zip extraction failed: ' + (stderr || err.message)));
          } else {
            resolve();
          }
        }
      );
      // Do not write to stdin; the script reads from env.
      if (child.stdin) child.stdin.end();
    });

    try { fs.unlinkSync(tmpZip); } catch (e) { /* ignore */ }

    // Defense in depth: walkFiles() throws on any symlink/junction. Also
    // confirm every file resolves inside scratch.
    const files = walkFiles(scratch);
    for (let i = 0; i < files.length; i++) {
      assertInsideRoot(scratch, files[i]);
    }
  } catch (err) {
    rmrf(scratch);
    throw err;
  } finally {
    rmrf(scriptDir);
  }

  return scratch;
}

/**
 * Find the expected binary inside a scratch directory (recursive search).
 * @param {string} scratch
 * @param {string} binaryBaseName e.g. `agent-analyzer` or `agent-analyzer.exe`
 * @returns {string|null} absolute path, or null if not found
 */
function findBinaryInScratch(scratch, binaryBaseName) {
  const files = walkFiles(scratch);
  for (let i = 0; i < files.length; i++) {
    if (path.basename(files[i]) === binaryBaseName) {
      assertInsideRoot(scratch, files[i]);
      return files[i];
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// SLSA build provenance verification
// ---------------------------------------------------------------------------

/**
 * Result of an attempted SLSA attestation verification.
 * @typedef {Object} SlsaResult
 * @property {'verified'|'skipped'|'failed'} status
 * @property {string} [reason]   human-readable detail (for skipped/failed)
 * @property {string} [stderr]   captured stderr from `gh` (failed only)
 */

/**
 * Default runner: spawn `gh attestation verify` and return the captured
 * exit code, stdout, and stderr. Injectable for tests.
 * @param {string} filePath
 * @param {string} repo e.g. `agent-sh/agent-analyzer`
 * @returns {{ status: number|null, stdout: string, stderr: string }}
 */
function defaultGhRunner(filePath, repo) {
  try {
    const stdout = cp.execFileSync(
      'gh',
      ['attestation', 'verify', filePath, '--repo', repo, '--format', 'json'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 60000,
        windowsHide: true
      }
    );
    return { status: 0, stdout: stdout || '', stderr: '' };
  } catch (err) {
    return {
      status: typeof err.status === 'number' ? err.status : null,
      stdout: err.stdout ? String(err.stdout) : '',
      stderr: err.stderr ? String(err.stderr) : (err.message || '')
    };
  }
}

/**
 * Returns true if the `gh` CLI is on PATH. Uses a short, non-privileged probe.
 * @param {function} [runner] optional probe; defaults to real `gh --version`
 * @returns {boolean}
 */
function isGhAvailable(runner) {
  if (typeof runner === 'function') {
    try { return !!runner(); } catch (e) { return false; }
  }
  try {
    cp.execFileSync('gh', ['--version'], {
      stdio: 'ignore',
      timeout: 5000,
      windowsHide: true
    });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Verify a downloaded asset's SLSA build provenance attestation via the
 * GitHub CLI. The check is SOFT by default: if `gh` is not installed the
 * function returns { status: 'skipped' } and the caller logs a warning. Set
 * `requireAttestation` (or the env var) to make a missing `gh` a failure.
 *
 * A present `gh` that reports verification failure ALWAYS returns
 * { status: 'failed' } regardless of `requireAttestation`; the caller is
 * expected to abort in that case.
 *
 * @param {string} filePath absolute path to the downloaded archive
 * @param {Object} [options]
 * @param {string} [options.repo] e.g. `agent-sh/agent-analyzer`
 * @param {boolean} [options.requireAttestation] defaults to env
 *   `AGENT_ANALYZER_REQUIRE_ATTESTATION === '1'`
 * @param {function} [options.ghRunner] injectable runner for tests. Receives
 *   (filePath, repo), returns { status, stdout, stderr }.
 * @param {function} [options.ghProbe] injectable gh-on-PATH probe for tests.
 * @returns {SlsaResult}
 */
function verifySlsaAttestation(filePath, options) {
  const opts = options || {};
  const repo = opts.repo || GITHUB_REPO;
  const runner = typeof opts.ghRunner === 'function' ? opts.ghRunner : defaultGhRunner;
  const require_ = typeof opts.requireAttestation === 'boolean'
    ? opts.requireAttestation
    : process.env.AGENT_ANALYZER_REQUIRE_ATTESTATION === '1';

  const ghPresent = isGhAvailable(opts.ghProbe);
  if (!ghPresent) {
    const reason = '`gh` CLI not found on PATH';
    if (require_) {
      return { status: 'failed', reason: reason + ' (AGENT_ANALYZER_REQUIRE_ATTESTATION=1)' };
    }
    return { status: 'skipped', reason: reason };
  }

  const result = runner(filePath, repo);
  if (result && result.status === 0) {
    return { status: 'verified' };
  }
  return {
    status: 'failed',
    reason: 'gh attestation verify exited with status ' +
      (result && result.status !== null ? result.status : 'unknown'),
    stderr: (result && result.stderr) || ''
  };
}

// ---------------------------------------------------------------------------
// Download + install
// ---------------------------------------------------------------------------

/**
 * Download and install the binary for the current platform into ~/.agent-sh/bin/.
 * @param {string} ver
 * @param {Object} [options]
 * @param {boolean} [options.skipChecksum=false] LOCAL DEV ONLY. Skips the
 *   `.sha256` sidecar fetch and verification. NEVER set this in production.
 * @param {boolean} [options.skipAttestation=false] LOCAL DEV ONLY. Skips the
 *   SLSA attestation check entirely.
 * @param {boolean} [options.requireAttestation] when true, a missing `gh`
 *   CLI becomes a hard failure. Defaults to
 *   `process.env.AGENT_ANALYZER_REQUIRE_ATTESTATION === '1'`.
 * @param {function} [options.ghRunner] injectable runner for tests.
 * @param {function} [options.ghProbe] injectable gh-on-PATH probe for tests.
 * @returns {Promise<string>} path to the installed binary
 */
async function downloadBinary(ver, options) {
  const opts = options || {};
  const skipChecksum = opts.skipChecksum === true;
  const skipAttestation = opts.skipAttestation === true;

  const platformKey = getPlatformKey();
  if (!platformKey) {
    throw new Error(
      'Unsupported platform: ' + process.platform + '-' + process.arch + '. ' +
      'Supported platforms: ' + Object.keys(PLATFORM_MAP).join(', ')
    );
  }

  const url = buildDownloadUrl(ver, platformKey);
  const filename = url.substring(url.lastIndexOf('/') + 1);
  process.stderr.write('Downloading ' + BINARY_NAME + ' v' + ver + ' for ' + platformKey + '...\n');

  const binPath = getBinaryPath();
  const binDir = path.dirname(binPath);
  fs.mkdirSync(binDir, { recursive: true });

  // --- 1. Fetch archive bytes --------------------------------------------
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

  // --- 2. Verify SHA-256 sidecar -----------------------------------------
  if (skipChecksum) {
    process.stderr.write(
      '[WARN] skipChecksum=true - SHA-256 verification disabled. ' +
      'This is LOCAL DEV ONLY and MUST NOT be used in production.\n'
    );
  } else {
    let expected;
    try {
      expected = await downloadSha256(url);
    } catch (err) {
      throw new Error(
        'Failed to fetch SHA-256 sidecar for ' + filename + ':\n' +
        '  URL: ' + url + '.sha256\n' +
        '  Error: ' + err.message + '\n\n' +
        'The release may be missing its checksum file. Refusing to install ' +
        'an unverified binary. If this is a legacy release without sidecars, ' +
        'pass { skipChecksum: true } to downloadBinary() (LOCAL DEV ONLY).'
      );
    }
    verifySha256(buf, expected, filename);
  }

  // --- 2b. Verify SLSA build provenance (optional / required) ------------
  if (skipAttestation) {
    process.stderr.write(
      '[WARN] skipAttestation=true - SLSA verification disabled. ' +
      'This is LOCAL DEV ONLY and MUST NOT be used in production.\n'
    );
  } else {
    // `gh attestation verify` needs a real file. Persist buf to a tmp path,
    // verify, then drop it. Extraction continues from the in-memory buf so
    // we don't need the tmp file beyond the verify call.
    const attestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-analyzer-slsa-'));
    const attestFile = path.join(attestDir, filename);
    try {
      fs.writeFileSync(attestFile, buf);
      const result = verifySlsaAttestation(attestFile, {
        repo: GITHUB_REPO,
        requireAttestation: opts.requireAttestation,
        ghRunner: opts.ghRunner,
        ghProbe: opts.ghProbe
      });
      if (result.status === 'verified') {
        process.stderr.write('[OK] SLSA attestation verified for ' + filename + '\n');
      } else if (result.status === 'skipped') {
        process.stderr.write(
          '[WARN] SLSA attestation check skipped: ' + result.reason + '. ' +
          'Install the GitHub CLI (`gh`) to enable provenance verification. ' +
          'Set AGENT_ANALYZER_REQUIRE_ATTESTATION=1 to require it.\n'
        );
      } else {
        // 'failed'
        throw new Error(
          'SLSA attestation verification failed for ' + filename + ': ' +
          result.reason + '. Refusing to execute binary.' +
          (result.stderr ? '\n--- gh stderr ---\n' + result.stderr : '')
        );
      }
    } finally {
      rmrf(attestDir);
    }
  }

  // --- 3. Extract to isolated scratch dir + validate entries -------------
  const binaryBaseName = path.basename(binPath);
  let scratch;
  try {
    if (process.platform === 'win32') {
      scratch = await extractZipToScratch(buf);
    } else {
      scratch = await extractTarGzToScratch(buf);
    }

    // --- 4. Locate the expected binary inside scratch --------------------
    const extractedBin = findBinaryInScratch(scratch, binaryBaseName);
    if (!extractedBin) {
      throw new Error(
        'Expected binary "' + binaryBaseName + '" not found inside archive ' +
        filename + '. Archive layout may have changed.'
      );
    }

    // --- 5. Move ONLY the expected binary to its final location ----------
    // copyFileSync so cross-device moves work. scratch is rmrf'd in finally.
    fs.copyFileSync(extractedBin, binPath);
  } finally {
    if (scratch) rmrf(scratch);
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
 * @param {boolean} [options.skipChecksum=false] LOCAL DEV ONLY.
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

  return downloadBinary(targetVer, {
    skipChecksum: opts.skipChecksum === true,
    skipAttestation: opts.skipAttestation === true,
    requireAttestation: opts.requireAttestation,
    ghRunner: opts.ghRunner,
    ghProbe: opts.ghProbe
  });
}

/**
 * Sync version of ensureBinary. Downloads if needed via a child node process.
 * Prefer ensureBinary() unless a sync API is strictly required.
 * @param {Object} [options]
 * @param {string} [options.version]
 * @param {boolean} [options.skipChecksum=false] LOCAL DEV ONLY.
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
  const skipChecksum = !!(options && options.skipChecksum);
  const skipAttestation = !!(options && options.skipAttestation);
  // Forward requireAttestation when explicitly set (tri-state: undefined
  // lets the child fall back to the AGENT_ANALYZER_REQUIRE_ATTESTATION
  // env var, matching ensureBinary()). Without this forwarding, a sync
  // caller with requireAttestation:true would silently lose the hard-fail
  // intent when gh is missing.
  const requireAttestation = options && typeof options.requireAttestation === 'boolean'
    ? options.requireAttestation
    : undefined;
  const selfPath = __filename;
  const ensureOpts = {
    version: targetVer,
    skipChecksum: skipChecksum,
    skipAttestation: skipAttestation
  };
  if (requireAttestation !== undefined) {
    ensureOpts.requireAttestation = requireAttestation;
  }
  const helperLines = [
    'var b = require(' + JSON.stringify(selfPath) + ');',
    'b.ensureBinary(' + JSON.stringify(ensureOpts) + ')',
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
  PLATFORM_MAP,
  // Exported for tests + advanced consumers
  parseSha256Sidecar,
  verifySha256,
  sha256Hex,
  assertSafeArchiveEntry,
  assertInsideRoot,
  downloadBinary,
  verifySlsaAttestation,
  isGhAvailable,
  // Exported for tests only
  extractTarGzToScratch,
  extractZipToScratch,
  _EXTRACT_ZIP_PS1: EXTRACT_ZIP_PS1
};
