const fs = require('fs');
const os = require('os');
const path = require('path');

const { findFilesForLanguage } = require('../lib/repo-map/runner');

function writeFile(root, relPath) {
  const fullPath = path.join(root, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, 'export const test = 1;\n', 'utf8');
}

describe('repo-map runner', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-map-runner-'));
    writeFile(tempDir, 'src/a.js');
    writeFile(tempDir, 'src/b.js');
    writeFile(tempDir, 'src/c.js');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('respects maxFiles limit', () => {
    const limited = findFilesForLanguage(tempDir, 'javascript', { maxFiles: 2 });
    const all = findFilesForLanguage(tempDir, 'javascript');

    expect(limited.length).toBe(2);
    expect(all.length).toBeGreaterThanOrEqual(3);
  });
});
