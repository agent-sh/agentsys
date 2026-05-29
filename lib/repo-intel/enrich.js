/**
 * Post-init enrichment helpers.
 *
 * The repo-intel skill spawns two Haiku-backed Task subagents after
 * the deterministic init/update pass:
 *
 * 1. `repo-intel-summarizer` reads README + manifests + hotspot
 *    headers and writes a 3-depth narrative summary.
 * 2. `repo-intel-weighter` writes 1-2 sentence descriptors for the
 *    top-N most-active files, used by `find` to add semantic recall.
 *
 * The orchestration calls into this module to gather the agents'
 * inputs, parse their JSON outputs (which arrive between marker
 * blocks because subagent stdout is otherwise free-form), and pipe
 * the result back through `repoIntel.applyDescriptors` /
 * `applySummary`. The Rust binary stores the data; this module
 * never touches the LLM directly.
 *
 * @module lib/repo-intel/enrich
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Read the README, returning empty string when absent so the
 * downstream JSON.stringify doesn't break.
 */
function readReadme(repoPath) {
  for (const name of ['README.md', 'README.MD', 'readme.md', 'README.rst', 'README.txt', 'README']) {
    const candidate = path.join(repoPath, name);
    if (fs.existsSync(candidate)) {
      try { return fs.readFileSync(candidate, 'utf8'); } catch { /* fall through */ }
    }
  }
  return '';
}

/**
 * Read whichever manifests are present and return them as a parsed
 * object keyed by manifest filename. Used by the summarizer to
 * understand what kind of project it's looking at.
 */
function readManifests(repoPath) {
  const manifests = {};
  for (const name of ['package.json', 'Cargo.toml', 'pyproject.toml', 'go.mod', 'pom.xml', 'build.gradle']) {
    const p = path.join(repoPath, name);
    if (fs.existsSync(p)) {
      try {
        const text = fs.readFileSync(p, 'utf8');
        // Don't attempt to parse non-JSON manifests - the summarizer
        // can read them as plain strings.
        if (name.endsWith('.json')) {
          try { manifests[name] = JSON.parse(text); }
          catch { manifests[name] = text.slice(0, 4000); }
        } else {
          manifests[name] = text.slice(0, 4000);
        }
      } catch { /* skip on read error */ }
    }
  }
  return manifests;
}

/**
 * Pick the top-N files by activity (changes + 2*recent_changes), and
 * return `{path, head}` for each where `head` is the first 500 chars
 * of file content. Used as `hotspots` input to the summarizer.
 *
 * For the weighter we just want the path list - call `topPaths()`.
 */
function topHotspots(repoPath, repoIntelData, n = 10) {
  const paths = topPaths(repoIntelData, n);
  return paths.map((p) => {
    const abs = path.join(repoPath, p);
    let head = '';
    try {
      const buf = fs.readFileSync(abs);
      head = buf.subarray(0, Math.min(buf.length, 500)).toString('utf8');
    } catch { /* file missing on disk, skip */ }
    return { path: p, head };
  });
}

/**
 * Rank file_activity entries by activity score and return the top N
 * paths. Recent changes are weighted 2x because the agent should
 * prioritize files that are still being actively touched.
 */
function topPaths(repoIntelData, n) {
  const fa = repoIntelData.fileActivity || {};
  const scored = Object.entries(fa)
    .map(([p, a]) => ({
      path: p,
      score: (a.changes || 0) + 2 * (a.recentChanges || 0)
    }))
    .filter((e) => e.score > 0);
  scored.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  return scored.slice(0, n).map((e) => e.path);
}

/**
 * Stable hash of the inputs that fed into a summary, so the skill
 * can decide whether to regenerate. Mirrors what the Rust set-summary
 * subcommand stores under summary.inputHash.
 */
function summaryInputHash(readme, manifests, hotspots) {
  const h = crypto.createHash('sha256');
  h.update(readme);
  h.update(JSON.stringify(manifests));
  h.update(JSON.stringify(hotspots));
  return 'sha256:' + h.digest('hex').slice(0, 16);
}

/**
 * Extract the JSON object between `=== <name>_START ===` and
 * `=== <name>_END ===` markers in the agent's output.
 *
 * Returns the parsed object, or null if either marker is missing or
 * the inner text doesn't parse as JSON. Tolerates extra whitespace
 * and surrounding agent commentary.
 */
function parseMarkers(agentOutput, name) {
  if (typeof agentOutput !== 'string') return null;
  const startMarker = `=== ${name}_START ===`;
  const endMarker = `=== ${name}_END ===`;
  const startIdx = agentOutput.indexOf(startMarker);
  const endIdx = agentOutput.indexOf(endMarker);
  if (startIdx < 0 || endIdx < 0 || endIdx <= startIdx) return null;
  const inner = agentOutput.slice(startIdx + startMarker.length, endIdx).trim();
  // Inner is usually fenced inside ```json ... ``` or just raw JSON.
  // Strip code fences if present, then parse.
  const stripped = inner
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  try { return JSON.parse(stripped); }
  catch { return null; }
}

/**
 * Build the summarizer prompt - the literal string sent as the Task
 * `prompt` argument. Kept here so the command markdown stays compact.
 */
function buildSummarizerPrompt(repoPath, readme, manifests, hotspots) {
  return [
    `Generate a 3-depth summary for the repo at ${repoPath}.`,
    '',
    'Inputs:',
    '```json',
    JSON.stringify({ repoPath, readme, manifests, hotspots }, null, 2),
    '```',
    '',
    'Return JSON between `=== SUMMARY_START ===` and `=== SUMMARY_END ===` markers as instructed in your system prompt.'
  ].join('\n');
}

/**
 * Build the weighter prompt for one batch of paths.
 */
function buildWeighterPrompt(repoPath, paths) {
  return [
    `Generate descriptors for the following files in ${repoPath}.`,
    '',
    'Inputs:',
    '```json',
    JSON.stringify({ repoPath, paths }, null, 2),
    '```',
    '',
    'Return JSON between `=== DESCRIPTORS_START ===` and `=== DESCRIPTORS_END ===` markers as instructed in your system prompt.'
  ].join('\n');
}

/**
 * Split a list into chunks of `size`. Used to keep weighter Task
 * calls bounded - one big Task with 500 paths would burn context;
 * 30/batch keeps each call cheap and lets the orchestrator parallelize.
 */
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

module.exports = {
  readReadme,
  readManifests,
  topHotspots,
  topPaths,
  summaryInputHash,
  parseMarkers,
  buildSummarizerPrompt,
  buildWeighterPrompt,
  chunk
};
