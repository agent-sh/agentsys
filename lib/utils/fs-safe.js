'use strict';

const fs = require('fs');

/**
 * Read a file with an optional size cap, free of check-then-use (TOCTOU)
 * races.
 *
 * The path is opened once and every subsequent operation (the regular-file
 * check, the size check, the read) acts on that file descriptor. Because the
 * descriptor is bound to a single inode, swapping the path for another file or
 * a symlink between calls cannot redirect the read - which a separate
 * `fs.statSync(path)` / `fs.existsSync(path)` followed by `fs.readFileSync(path)`
 * cannot guarantee.
 *
 * @param {string} filePath
 * @param {number} [maxSize] - byte ceiling; larger files throw `EFBIG`
 * @param {BufferEncoding} [encoding='utf8']
 * @returns {string|Buffer} file contents (string when an encoding is given)
 * @throws if the path is missing, not a regular file, too large, or unreadable
 */
function readFileWithLimit(filePath, maxSize, encoding = 'utf8') {
  const fd = fs.openSync(filePath, 'r');
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile()) {
      const err = new Error(`Not a regular file: ${filePath}`);
      err.code = 'ENOTFILE';
      throw err;
    }
    if (typeof maxSize === 'number' && stat.size > maxSize) {
      const err = new Error(`File too large: ${stat.size} > ${maxSize} bytes`);
      err.code = 'EFBIG';
      throw err;
    }
    return fs.readFileSync(fd, encoding);
  } finally {
    fs.closeSync(fd);
  }
}

module.exports = { readFileWithLimit };
