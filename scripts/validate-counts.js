#!/usr/bin/env node
/**
 * Validate Counts and Versions Across Documentation
 * Ensures documentation accurately reflects actual implementation
 *
 * Checks:
 * 1. Plugin count matches across all docs
 * 2. Agent count matches across all docs
 * 3. Skill count matches across all docs
 * 4. Version alignment (package.json, plugin.json files)
 * 5. CLAUDE.md and AGENTS.md alignment
 *
 * CRITICAL: Per CLAUDE.md rule - accurate documentation is mandatory
 *
 * Usage: node scripts/validate-counts.js [--json]
 * Exit code: 0 if all aligned, 1 if mismatches found
 *
 * Options:
 *   --json    Output structured JSON (for skill consumption)
 *
 * @author Avi Fenesh
 * @license MIT
 */

const fs = require('fs');
const path = require('path');
const discovery = require(path.join(__dirname, '..', 'lib', 'discovery'));

const REPO_ROOT = path.resolve(__dirname, '..');

// Files to check for counts
const DOC_FILES = [
  'README.md',
  'CLAUDE.md',
  'docs/CROSS_PLATFORM.md',
  'docs/ARCHITECTURE.md',
  'docs/reference/AGENTS.md',
  'package.json'
];

// Actual counts from filesystem via discovery module
function getActualCounts() {
  const result = discovery.discoverAll(REPO_ROOT);

  // Role-based agents are defined inline (audit-project has 10)
  const roleBasedAgentCount = 10;

  return {
    plugins: result.plugins.length,
    fileBasedAgents: result.agents.length,
    roleBasedAgents: roleBasedAgentCount,
    totalAgents: result.agents.length + roleBasedAgentCount,
    skills: result.skills.length
  };
}

// Extract counts from documentation
function extractCountsFromDocs() {
  const results = {};

  DOC_FILES.forEach(docFile => {
    const filePath = path.join(REPO_ROOT, docFile);
    if (!fs.existsSync(filePath)) {
      results[docFile] = { error: 'File not found' };
      return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const counts = {};

    // Extract plugin count
    const pluginMatches = content.match(/(\d+)\s+plugins/i);
    if (pluginMatches) {
      counts.plugins = parseInt(pluginMatches[1], 10);
    }

    // Extract agent count - handle both total and file-based counts
    // Pattern: "39 agents (29 file-based + 10 role-based)" or "39 total"
    const totalAgentMatch = content.match(/(\d+)\s+(?:total|agents)\s*[:\(]?\s*(\d+)?\s*file-based\s*\+\s*(\d+)\s*role-based/i);
    if (totalAgentMatch) {
      counts.agents = parseInt(totalAgentMatch[1], 10); // Total count
      counts.fileBasedAgents = totalAgentMatch[2] ? parseInt(totalAgentMatch[2], 10) : null;
      counts.roleBasedAgents = parseInt(totalAgentMatch[3], 10);
    } else {
      // Look for top-level agent count (not plugin-specific)
      // Match patterns like "9 plugins · 39 agents" or "39 agents across"
      const topLevelMatch = content.match(/(?:·|,)\s*(\d+)\s+agents|(\d+)\s+agents\s+across/i);
      if (topLevelMatch) {
        counts.agents = parseInt(topLevelMatch[1] || topLevelMatch[2], 10);
      }
    }

    // Extract skill count
    const skillMatches = content.match(/(\d+)\s+skills/i);
    if (skillMatches) {
      counts.skills = parseInt(skillMatches[1], 10);
    }

    // Special handling for package.json
    if (docFile === 'package.json') {
      try {
        const pkg = JSON.parse(content);
        const descMatch = pkg.description.match(/(\d+)\s+specialized plugins/);
        if (descMatch) {
          counts.plugins = parseInt(descMatch[1], 10);
        }
        counts.version = pkg.version;
      } catch (err) {
        counts.error = 'Invalid JSON';
      }
    }

    results[docFile] = counts;
  });

  return results;
}

// Check version alignment
function checkVersionAlignment() {
  const issues = [];
  const packageJsonPath = path.join(REPO_ROOT, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const mainVersion = packageJson.version;

  // Check each plugin's plugin.json
  const pluginsDir = path.join(REPO_ROOT, 'plugins');
  if (!fs.existsSync(pluginsDir)) {
    return { mainVersion, issues };
  }
  const plugins = fs.readdirSync(pluginsDir).filter(f => {
    const stat = fs.statSync(path.join(pluginsDir, f));
    return stat.isDirectory();
  });

  plugins.forEach(plugin => {
    const pluginJsonPath = path.join(pluginsDir, plugin, '.claude-plugin', 'plugin.json');
    if (fs.existsSync(pluginJsonPath)) {
      const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
      if (pluginJson.version !== mainVersion) {
        issues.push({
          file: `plugins/${plugin}/plugin.json`,
          expected: mainVersion,
          actual: pluginJson.version
        });
      }
    }
  });

  return { mainVersion, issues };
}

// Check CLAUDE.md and AGENTS.md alignment
function checkProjectMemoryAlignment() {
  const claudePath = path.join(REPO_ROOT, 'CLAUDE.md');
  const agentsPath = path.join(REPO_ROOT, 'AGENTS.md');

  if (!fs.existsSync(claudePath)) {
    return { error: 'CLAUDE.md not found' };
  }

  if (!fs.existsSync(agentsPath)) {
    return { warning: 'AGENTS.md not found (optional)' };
  }

  const claudeContent = fs.readFileSync(claudePath, 'utf8');
  const agentsContent = fs.readFileSync(agentsPath, 'utf8');

  // Extract critical rules section
  const claudeRulesMatch = claudeContent.match(/<critical-rules>([\s\S]*?)<\/critical-rules>/);
  const agentsRulesMatch = agentsContent.match(/<critical-rules>([\s\S]*?)<\/critical-rules>/);

  if (!claudeRulesMatch || !agentsRulesMatch) {
    return { warning: 'Could not find <critical-rules> tags in both files' };
  }

  const claudeRules = claudeRulesMatch[1].trim();
  const agentsRules = agentsRulesMatch[1].trim();

  // Check if critical rules are similar (allowing for minor formatting differences)
  const similarity = calculateSimilarity(claudeRules, agentsRules);

  return {
    aligned: similarity > 0.90,
    similarity: (similarity * 100).toFixed(1) + '%',
    claudeLength: claudeRules.length,
    agentsLength: agentsRules.length
  };
}

// Simple similarity calculation (Levenshtein-based)
function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

// Format count mismatch for display
function formatCountMismatch(file, metric, expected, actual) {
  return `  ${file}:
    Metric: ${metric}
    Expected: ${expected}
    Actual: ${actual}`;
}

/**
 * Run all validations and return structured result
 * @returns {Object} Validation result with status, issues, fixes
 */
function runValidation() {
  // When plugins/ doesn't exist, counts are not meaningful — return ok
  if (!fs.existsSync(path.join(REPO_ROOT, 'plugins'))) {
    return {
      status: 'ok',
      message: 'plugins/ not present (extracted to standalone repos)',
      actualCounts: { plugins: 0, fileBasedAgents: 0, roleBasedAgents: 0, totalAgents: 0, skills: 0 },
      docCounts: {},
      versionCheck: { mainVersion: null, aligned: true },
      memoryAlignment: { aligned: true, similarity: '100.0%' },
      issues: [],
      fixes: [],
      summary: { issueCount: 0, fixableCount: 0, bySeverity: { high: 0, medium: 0, low: 0 } }
    };
  }
  const actualCounts = getActualCounts();
  const docCounts = extractCountsFromDocs();
  const versionCheck = checkVersionAlignment();
  const memoryAlignment = checkProjectMemoryAlignment();

  const issues = [];
  const fixes = [];

  // Check count alignment
  Object.entries(docCounts).forEach(([file, counts]) => {
    if (counts.error) return;

    if (counts.plugins !== undefined && counts.plugins !== actualCounts.plugins) {
      issues.push({
        type: 'count-mismatch',
        severity: 'high',
        file,
        metric: 'plugins',
        expected: actualCounts.plugins,
        actual: counts.plugins,
        autoFix: true
      });
      fixes.push({
        file,
        type: 'update-count',
        search: `${counts.plugins} plugins`,
        replace: `${actualCounts.plugins} plugins`
      });
    }

    if (counts.agents !== undefined) {
      const isValid = counts.agents === actualCounts.totalAgents ||
                      counts.agents === actualCounts.fileBasedAgents ||
                      (counts.fileBasedAgents === actualCounts.fileBasedAgents &&
                       counts.roleBasedAgents === actualCounts.roleBasedAgents);

      if (!isValid) {
        issues.push({
          type: 'count-mismatch',
          severity: 'high',
          file,
          metric: 'agents',
          expected: `${actualCounts.totalAgents} (${actualCounts.fileBasedAgents} file-based + ${actualCounts.roleBasedAgents} role-based)`,
          actual: counts.agents,
          autoFix: false
        });
      }
    }

    if (counts.skills !== undefined && counts.skills !== actualCounts.skills) {
      issues.push({
        type: 'count-mismatch',
        severity: 'high',
        file,
        metric: 'skills',
        expected: actualCounts.skills,
        actual: counts.skills,
        autoFix: true
      });
      fixes.push({
        file,
        type: 'update-count',
        search: `${counts.skills} skills`,
        replace: `${actualCounts.skills} skills`
      });
    }
  });

  // Check version alignment
  versionCheck.issues.forEach(issue => {
    issues.push({
      type: 'version-mismatch',
      severity: 'high',
      file: issue.file,
      expected: issue.expected,
      actual: issue.actual,
      autoFix: true
    });
    fixes.push({
      file: issue.file,
      type: 'update-version',
      search: `"version": "${issue.actual}"`,
      replace: `"version": "${issue.expected}"`
    });
  });

  // Check project memory alignment
  if (memoryAlignment.aligned === false) {
    issues.push({
      type: 'memory-divergence',
      severity: 'medium',
      file: 'CLAUDE.md / AGENTS.md',
      similarity: memoryAlignment.similarity,
      autoFix: false
    });
  }

  return {
    status: issues.length === 0 ? 'ok' : 'issues-found',
    actualCounts,
    docCounts,
    versionCheck: {
      mainVersion: versionCheck.mainVersion,
      aligned: versionCheck.issues.length === 0
    },
    memoryAlignment: {
      aligned: memoryAlignment.aligned,
      similarity: memoryAlignment.similarity
    },
    issues,
    fixes,
    summary: {
      issueCount: issues.length,
      fixableCount: fixes.length,
      bySeverity: {
        high: issues.filter(i => i.severity === 'high').length,
        medium: issues.filter(i => i.severity === 'medium').length,
        low: issues.filter(i => i.severity === 'low').length
      }
    }
  };
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const jsonMode = args.includes('--json');

  // When plugins/ doesn't exist, counts are not meaningful — skip validation
  if (!require('fs').existsSync(require('path').join(REPO_ROOT, 'plugins'))) {
    if (jsonMode) {
      console.log(JSON.stringify({ status: 'ok', message: 'plugins/ not present (extracted to standalone repos)', issues: [] }, null, 2));
    } else {
      console.log('[OK] plugins/ not present (extracted to standalone repos) — skipping count validation');
    }
    process.exit(0);
  }

  const result = runValidation();

  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.status === 'ok' ? 0 : 1);
  }

  // Human-readable output (default)
  console.log('[OK] Validating counts and versions...\n');

  console.log('## Actual Counts (from filesystem)\n');
  console.log(`  Plugins: ${result.actualCounts.plugins}`);
  console.log(`  Agents:  ${result.actualCounts.totalAgents} (${result.actualCounts.fileBasedAgents} file-based + ${result.actualCounts.roleBasedAgents} role-based)`);
  console.log(`  Skills:  ${result.actualCounts.skills}`);
  console.log('');

  console.log('## Documentation Counts\n');
  Object.entries(result.docCounts).forEach(([file, counts]) => {
    if (counts.error) {
      console.log(`  ${file}: ${counts.error}`);
      return;
    }
    console.log(`  ${file}:`);
    if (counts.plugins !== undefined) console.log(`    Plugins: ${counts.plugins}`);
    if (counts.agents !== undefined) console.log(`    Agents:  ${counts.agents}`);
    if (counts.skills !== undefined) console.log(`    Skills:  ${counts.skills}`);
    console.log('');
  });

  console.log('## Count Validation\n');
  const countIssues = result.issues.filter(i => i.type === 'count-mismatch');
  if (countIssues.length > 0) {
    console.error('[ERROR] Count mismatches found:\n');
    countIssues.forEach(issue => {
      console.error(`  ${issue.file}:`);
      console.error(`    Metric: ${issue.metric}`);
      console.error(`    Expected: ${issue.expected}`);
      console.error(`    Actual: ${issue.actual}`);
      console.error('');
    });
  } else {
    console.log('[OK] All counts aligned across documentation\n');
  }

  console.log('## Version Alignment\n');
  console.log(`  Main version (package.json): ${result.versionCheck.mainVersion}`);
  console.log('');

  const versionIssues = result.issues.filter(i => i.type === 'version-mismatch');
  if (versionIssues.length > 0) {
    console.error('[ERROR] Version mismatches found:\n');
    versionIssues.forEach(issue => {
      console.error(`  ${issue.file}:`);
      console.error(`    Expected: ${issue.expected}`);
      console.error(`    Actual:   ${issue.actual}`);
      console.error('');
    });
  } else {
    console.log('[OK] All plugin versions aligned with main version\n');
  }

  console.log('## Project Memory Alignment (CLAUDE.md vs AGENTS.md)\n');
  if (result.memoryAlignment.aligned === undefined) {
    console.log('  [SKIP] Could not check alignment');
  } else if (result.memoryAlignment.aligned) {
    console.log(`  Similarity: ${result.memoryAlignment.similarity}`);
    console.log('\n[OK] CLAUDE.md and AGENTS.md are aligned\n');
  } else {
    console.log(`  Similarity: ${result.memoryAlignment.similarity}`);
    console.warn('\n[WARN] CLAUDE.md and AGENTS.md divergence detected (similarity < 90%)\n');
    console.warn('This may be intentional (platform-specific differences) or may need sync.\n');
  }

  if (result.status !== 'ok') {
    console.error('[ERROR] Validation failed - fix mismatches and run again\n');
    console.error('CLAUDE.md Critical Rule #1: Production project - accurate docs required\n');
    process.exit(1);
  }

  console.log('[OK] All validations passed\n');
  process.exit(0);
}

module.exports = {
  getActualCounts,
  extractCountsFromDocs,
  checkVersionAlignment,
  checkProjectMemoryAlignment,
  runValidation
};
