'use strict';

/**
 * Shared HTTP + archive helpers used by both binary resolvers
 * (`lib/binary/index.js` for `agent-analyzer`, `lib/embed/binary.js`
 * for `agent-analyzer-embed`).
 *
 * Extracted to keep the two resolvers from drifting on HTTP redirect
 * handling, GitHub auth, and archive extraction details — a single
 * fix to e.g. the timeout policy or the redirect cap lands once and
 * applies to both binaries.
 *
 * @module lib/binary/shared-helpers
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const cp = require('child_process');

const DEFAULT_DOWNLOAD_TIMEOUT_MS = 30000;
const MAX_REDIRECTS = 5;

/**
 * Fetch a URL into an in-memory Buffer following up to 5 redirects.
 *
 * Honors `GITHUB_TOKEN` / `GH_TOKEN` for authenticated requests
 * (raises rate limit, lets private-repo asset URLs work). Stalled
 * connections are killed by the per-request timeout — without this
 * a stuck socket would hang the process indefinitely.
 *
 * @param {string} url
 * @param {Object} [options]
 * @param {string} [options.userAgent='agent-sh/binary-resolver']
 * @param {number} [options.timeoutMs=30000] - per-request timeout
 * @returns {Promise<Buffer>}
 */
function downloadToBuffer(url, options) {
  const opts = options || {};
  const userAgent = opts.userAgent || 'agent-sh/binary-resolver';
  const timeoutMs = opts.timeoutMs || DEFAULT_DOWNLOAD_TIMEOUT_MS;

  return new Promise(function (resolve, reject) {
    const ghToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

    function request(reqUrl, redirectCount) {
      if (redirectCount > MAX_REDIRECTS) {
        reject(new Error('Too many redirects fetching from ' + url));
        return;
      }
      const headers = {
        'User-Agent': userAgent,
        'Accept': 'application/octet-stream'
      };
      if (ghToken) headers['Authorization'] = 'Bearer ' + ghToken;

      const req = https.get(reqUrl, { headers: headers, timeout: timeoutMs }, function (res) {
        const sc = res.statusCode;
        if (sc === 301 || sc === 302 || sc === 307 || sc === 308) {
          res.resume();
          var loc = res.headers.location;
          if (loc && !loc.startsWith('https://')) {
            reject(new Error('Refusing non-HTTPS redirect to ' + loc));
            return;
          }
          request(loc, redirectCount + 1);
          return;
        }
        if (sc !== 200) {
          res.resume();
          const hint = sc === 403 ? ' (rate limited - set GITHUB_TOKEN env var)' : '';
          reject(new Error('HTTP ' + sc + hint + ' fetching ' + reqUrl));
          return;
        }
        const chunks = [];
        res.on('data', function (chunk) { chunks.push(chunk); });
        res.on('end', function () { resolve(Buffer.concat(chunks)); });
        res.on('error', reject);
      });
      req.on('error', reject);
      req.on('timeout', function () {
        req.destroy();
        reject(new Error('Timeout (' + timeoutMs + 'ms) fetching ' + reqUrl));
      });
    }

    request(url, 0);
  });
}

/**
 * Extract a `.tar.gz` Buffer into `destDir` using the system `tar`.
 * Available on Linux, macOS, and Windows (built into recent Win10/11).
 *
 * @param {Buffer} buf
 * @param {string} destDir
 * @returns {Promise<void>}
 */
function extractTarGz(buf, destDir) {
  return new Promise(function (resolve, reject) {
    const tarDest = process.platform === 'win32' ? destDir.replace(/\\/g, '/') : destDir;
    const tar = cp.spawn('tar', ['xz', '-C', tarDest], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let stderr = '';
    tar.stderr.on('data', function (d) { stderr += d; });
    tar.stdin.write(buf);
    tar.stdin.end();
    tar.on('close', function (code) {
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
 * Extract a `.zip` Buffer into `destDir` using PowerShell's
 * `Expand-Archive` (Windows-only).
 *
 * @param {Buffer} buf
 * @param {string} destDir
 * @param {string} binaryName - used as the temp-dir prefix
 * @returns {Promise<void>}
 */
function extractZip(buf, destDir, binaryName) {
  return new Promise(function (resolve, reject) {
    var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), binaryName + '-'));
    var tmpZip = path.join(tmpDir, 'archive.zip');
    fs.writeFileSync(tmpZip, buf);
    var ps = cp.spawn(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command',
       'Expand-Archive', '-Path', tmpZip, '-DestinationPath', destDir, '-Force'],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    var stderr = '';
    ps.stderr.on('data', function (d) { stderr += d; });
    ps.on('close', function (code) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
      if (code !== 0) {
        reject(new Error('zip extraction failed (code ' + code + '): ' + stderr));
      } else {
        resolve();
      }
    });
    ps.on('error', reject);
  });
}

module.exports = {
  downloadToBuffer,
  extractTarGz,
  extractZip,
  DEFAULT_DOWNLOAD_TIMEOUT_MS
};
