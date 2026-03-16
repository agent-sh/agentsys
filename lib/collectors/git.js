/**
 * Git History Collector
 *
 * Collects git history analysis data using the agent-analyzer binary.
 * Runs a full repo-intel init and extracts key metrics for downstream consumers.
 *
 * @module lib/collectors/git
 */

'use strict';

const binary = require('../binary');

const DEFAULT_OPTIONS = {
  top: 20,
  adjustForAi: false,
  cwd: process.cwd()
};

/**
 * Collect git history data for the given repository.
 *
 * Runs agent-analyzer repo-intel init to produce a full map, then extracts
 * key metrics (hotspots, bus factor, AI ratio, etc.) from the result.
 *
 * @param {Object} [options={}] - Collection options
 * @param {string} [options.cwd] - Repository path (default: process.cwd())
 * @param {number} [options.top=20] - Number of hotspots to return
 * @param {boolean} [options.adjustForAi=false] - Adjust bus factor for AI commits
 * @returns {Object} Git history metrics
 */
function collectGitData(options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const cwd = opts.cwd || process.cwd();

  try {
    binary.ensureBinarySync();
  } catch (err) {
    return {
      available: false,
      error: `Binary not available: ${err.message}`
    };
  }

  let map;
  try {
    const json = binary.runAnalyzer(['repo-intel', 'init', cwd]);
    map = JSON.parse(json);
  } catch (err) {
    return {
      available: false,
      error: `Git analysis failed: ${err.message}`
    };
  }

  // Extract metrics from the map
  const fileActivity = map.fileActivity || {};
  const contributors = map.contributors || {};
  const aiAttribution = map.aiAttribution || {};
  const conventions = map.conventions || {};
  const releases = map.releases || {};

  // Hotspots: sort files by change count
  const hotspots = Object.entries(fileActivity)
    .map(([path, activity]) => ({
      path,
      changes: activity.totalChanges || 0,
      recentChanges: activity.recentChanges || 0,
      authors: activity.authors ? Object.keys(activity.authors).length : 0,
      lastChanged: activity.lastChanged || null
    }))
    .sort((a, b) => b.changes - a.changes)
    .slice(0, opts.top);

  // Contributors summary
  const humans = contributors.humans || {};
  const humanList = Object.entries(humans)
    .map(([name, data]) => ({
      name,
      commits: data.commitCount || 0,
      firstSeen: data.firstSeen || null,
      lastSeen: data.lastSeen || null
    }))
    .sort((a, b) => b.commits - a.commits);

  // Bus factor: people covering 80% of commits
  const totalCommits = humanList.reduce((sum, c) => sum + c.commits, 0);
  let cumulative = 0;
  let busFactor = 0;
  for (const contributor of humanList) {
    cumulative += contributor.commits;
    busFactor++;
    if (cumulative >= totalCommits * 0.8) break;
  }

  // AI ratio
  const aiTotal = (aiAttribution.attributed || 0) + (aiAttribution.heuristic || 0);
  const allCommits = map.git?.totalCommitsAnalyzed || totalCommits;
  const aiRatio = allCommits > 0 ? aiTotal / allCommits : 0;

  return {
    available: true,
    health: {
      active: humanList.length > 0,
      busFactor,
      aiRatio: Math.round(aiRatio * 100) / 100,
      totalCommits: allCommits,
      totalContributors: humanList.length
    },
    hotspots,
    contributors: humanList.slice(0, 10),
    aiAttribution: {
      ratio: Math.round(aiRatio * 100) / 100,
      attributed: aiAttribution.attributed || 0,
      heuristic: aiAttribution.heuristic || 0,
      none: aiAttribution.none || 0,
      confidence: aiAttribution.confidence || 'low',
      tools: aiAttribution.tools || {}
    },
    busFactor,
    conventions: {
      style: conventions.style || null,
      prefixes: conventions.prefixes || {},
      usesScopes: conventions.usesScopes || false
    },
    releaseInfo: {
      tagCount: releases.tags ? releases.tags.length : 0,
      lastRelease: releases.tags && releases.tags.length > 0
        ? releases.tags[releases.tags.length - 1]
        : null,
      cadence: releases.cadence || null
    }
  };
}

module.exports = {
  collectGitData,
  DEFAULT_OPTIONS
};
