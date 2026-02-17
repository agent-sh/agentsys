/**
 * GitHub Data Collector
 *
 * Collects GitHub state: issues, PRs, milestones.
 * Extracted from drift-detect/collectors.js for shared use.
 *
 * @module lib/collectors/github
 */

'use strict';

const { execFileSync } = require('child_process');

const DEFAULT_OPTIONS = {
  issueLimit: 100,
  prLimit: 50,
  milestoneLimit: 100,
  timeout: 10000,
  cwd: process.cwd()
};

/**
 * Execute gh CLI command safely
 * @param {string[]} args - Command arguments
 * @param {Object} options - Execution options
 * @returns {Object|null} Parsed JSON result or null
 */
function execGh(args, options = {}) {
  const result = execGhWithResult(args, options);
  return result.ok ? result.data : null;
}

function execGhWithResult(args, options = {}) {
  try {
    const output = execFileSync('gh', args, {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: options.timeout || DEFAULT_OPTIONS.timeout,
      cwd: options.cwd || DEFAULT_OPTIONS.cwd
    });

    try {
      return { ok: true, data: JSON.parse(output) };
    } catch (error) {
      return {
        ok: false,
        error: {
          type: 'parse',
          message: `Failed to parse gh output as JSON: ${error.message}`,
          raw: output.slice(0, 500)
        }
      };
    }
  } catch (error) {
    return {
      ok: false,
      error: {
        type: error.killed ? 'timeout' : 'process',
        message: error.message,
        exitCode: error.status ?? null,
        stderr: error.stderr ? String(error.stderr).trim() : ''
      }
    };
  }
}

/**
 * Check if gh CLI is available and authenticated
 * @returns {boolean} True if gh is ready
 */
function isGhAvailable() {
  try {
    execFileSync('gh', ['auth', 'status'], {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 5000
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Summarize an issue for analysis
 * @param {Object} item - Issue object
 * @returns {Object} Summarized item
 */
function summarizeIssue(item) {
  return {
    number: item.number,
    title: item.title,
    labels: (item.labels || []).map(l => l.name || l),
    milestone: item.milestone?.title || item.milestone || null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    snippet: item.body ? item.body.slice(0, 200).replace(/\n/g, ' ').trim() + (item.body.length > 200 ? '...' : '') : ''
  };
}

/**
 * Summarize a PR for analysis
 * @param {Object} item - PR object
 * @returns {Object} Summarized item
 */
function summarizePR(item) {
  return {
    number: item.number,
    title: item.title,
    labels: (item.labels || []).map(l => l.name || l),
    isDraft: item.isDraft,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    files: item.files || [],
    snippet: item.body ? item.body.slice(0, 150).replace(/\n/g, ' ').trim() + (item.body.length > 150 ? '...' : '') : ''
  };
}

/**
 * Categorize issues by labels
 */
function categorizeIssues(result, issues) {
  const labelMap = {
    bug: 'bugs',
    'type: bug': 'bugs',
    feature: 'features',
    'type: feature': 'features',
    enhancement: 'enhancements',
    security: 'security',
    'type: security': 'security'
  };

  const labelPatterns = Object.entries(labelMap).map(([pattern, category]) => ({
    regex: new RegExp(`(^|[^a-z])${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i'),
    category
  }));

  for (const issue of issues) {
    const labels = (issue.labels || []).map(l => (l.name || l).toLowerCase());
    let categorized = false;
    const ref = { number: issue.number, title: issue.title };

    for (const { regex, category } of labelPatterns) {
      if (labels.some(l => regex.test(l))) {
        result.categorized[category].push(ref);
        categorized = true;
        break;
      }
    }

    if (!categorized) {
      result.categorized.other.push(ref);
    }
  }
}

/**
 * Find stale items
 */
function findStaleItems(result, items, staleDays) {
  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - staleDays);

  for (const item of items) {
    const updated = new Date(item.updatedAt);
    if (updated < staleDate) {
      result.stale.push({
        number: item.number,
        title: item.title,
        lastUpdated: item.updatedAt,
        daysStale: Math.floor((Date.now() - updated) / (1000 * 60 * 60 * 24))
      });
    }
  }
}

/**
 * Extract common themes from issue titles
 */
function extractThemes(result, issues) {
  const words = {};
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'to', 'for', 'in', 'on', 'at', 'with', 'and', 'or', 'of']);

  for (const issue of issues) {
    const titleWords = (issue.title || '').toLowerCase().split(/\s+/);
    for (const word of titleWords) {
      if (word.length > 3 && !stopWords.has(word)) {
        words[word] = (words[word] || 0) + 1;
      }
    }
  }

  result.themes = Object.entries(words)
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));
}

/**
 * Find overdue milestones
 */
function findOverdueMilestones(result) {
  const now = new Date();
  result.overdueMilestones = result.milestones.filter(m => {
    if (!m.due_on || m.state === 'closed') return false;
    return new Date(m.due_on) < now;
  });
}

/**
 * Scan GitHub state: issues, PRs, milestones
 * @param {Object} options - Collection options
 * @returns {Object} GitHub state data
 */
function scanGitHubState(options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const result = {
    available: false,
    partial: false,
    errors: [],
    summary: { issueCount: 0, prCount: 0, milestoneCount: 0 },
    issues: [],
    prs: [],
    milestones: [],
    overdueMilestones: [],
    pagination: {
      issues: { requestedLimit: opts.issueLimit, fetchedCount: 0, hasMore: false },
      prs: { requestedLimit: opts.prLimit, fetchedCount: 0, hasMore: false },
      milestones: { requestedLimit: opts.milestoneLimit, fetchedCount: 0, hasMore: false }
    },
    categorized: { bugs: [], features: [], security: [], enhancements: [], other: [] },
    stale: [],
    themes: []
  };

  if (!isGhAvailable()) {
    result.error = 'gh CLI not available or not authenticated';
    return result;
  }

  result.available = true;

  // Fetch open issues
  const issuesResult = execGhWithResult([
    'issue', 'list',
    '--state', 'open',
    '--json', 'number,title,labels,milestone,createdAt,updatedAt,body',
    '--limit', String(opts.issueLimit)
  ], opts);

  if (issuesResult.ok && Array.isArray(issuesResult.data)) {
    const issues = issuesResult.data;
    result.issues = issues.map(summarizeIssue);
    result.summary.issueCount = issues.length;
    result.pagination.issues.fetchedCount = issues.length;
    result.pagination.issues.hasMore = opts.issueLimit > 0 && issues.length >= opts.issueLimit;
    categorizeIssues(result, issues);
    findStaleItems(result, issues, 90);
    extractThemes(result, issues);
  } else if (!issuesResult.ok) {
    result.errors.push({ source: 'issues', ...issuesResult.error });
  }

  // Fetch open PRs with files changed
  const prsResult = execGhWithResult([
    'pr', 'list',
    '--state', 'open',
    '--json', 'number,title,labels,isDraft,createdAt,updatedAt,body,files',
    '--limit', String(opts.prLimit)
  ], opts);

  if (prsResult.ok && Array.isArray(prsResult.data)) {
    const prs = prsResult.data;
    result.prs = prs.map(summarizePR);
    result.summary.prCount = prs.length;
    result.pagination.prs.fetchedCount = prs.length;
    result.pagination.prs.hasMore = opts.prLimit > 0 && prs.length >= opts.prLimit;
  } else if (!prsResult.ok) {
    result.errors.push({ source: 'prs', ...prsResult.error });
  }

  // Fetch milestones
  const milestonesResult = execGhWithResult([
    'api', 'repos/{owner}/{repo}/milestones',
    '--paginate',
    '--slurp'
  ], opts);

  if (milestonesResult.ok && Array.isArray(milestonesResult.data)) {
    const pages = milestonesResult.data;
    const allMilestones = pages.flatMap(page => Array.isArray(page) ? page : []);
    const mappedMilestones = allMilestones.map((milestone) => ({
      title: milestone.title,
      state: milestone.state,
      due_on: milestone.due_on,
      open_issues: milestone.open_issues,
      closed_issues: milestone.closed_issues
    }));

    result.pagination.milestones.fetchedCount = mappedMilestones.length;
    result.pagination.milestones.hasMore = opts.milestoneLimit > 0 && mappedMilestones.length > opts.milestoneLimit;
    result.milestones = mappedMilestones.slice(0, opts.milestoneLimit);
    result.summary.milestoneCount = result.milestones.length;
    findOverdueMilestones(result);
  } else if (!milestonesResult.ok) {
    result.errors.push({ source: 'milestones', ...milestonesResult.error });
  }

  result.partial = result.errors.length > 0;
  if (result.partial && !result.error) {
    result.error = 'Partial GitHub data collected';
  }

  return result;
}

module.exports = {
  DEFAULT_OPTIONS,
  scanGitHubState,
  isGhAvailable,
  execGh,
  summarizeIssue,
  summarizePR,
  categorizeIssues,
  findStaleItems,
  extractThemes,
  findOverdueMilestones
};
