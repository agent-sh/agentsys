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
 * Usage: node scripts/validate-counts.js
 * Exit code: 0 if all aligned, 1 if mismatches found
 *
 * @author Avi Fenesh
 * @license MIT
 */

const fs = require('fs');
const path = require('path');

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

// Actual counts from filesystem
function getActualCounts() {
  const pluginsDir = path.join(REPO_ROOT, 'plugins');
  const plugins = fs.readdirSync(pluginsDir).filter(f => {
    const stat = fs.statSync(path.join(pluginsDir, f));
    return stat.isDirectory();
  });

  let fileBasedAgentCount = 0;
  let skillCount = 0;

  plugins.forEach(plugin => {
    const agentsDir = path.join(pluginsDir, plugin, 'agents');
    const skillsDir = path.join(pluginsDir, plugin, 'skills');

    if (fs.existsSync(agentsDir)) {
      const agents = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
      fileBasedAgentCount += agents.length;
    }

    if (fs.existsSync(skillsDir)) {
      const skills = fs.readdirSync(skillsDir);
      skills.forEach(skill => {
        const skillFile = path.join(skillsDir, skill, 'SKILL.md');
        if (fs.existsSync(skillFile)) {
          skillCount++;
        }
      });
    }
  });

  // Role-based agents are defined inline (audit-project has 10)
  const roleBasedAgentCount = 10;
  const totalAgentCount = fileBasedAgentCount + roleBasedAgentCount;

  return {
    plugins: plugins.length,
    fileBasedAgents: fileBasedAgentCount,
    roleBasedAgents: roleBasedAgentCount,
    totalAgents: totalAgentCount,
    skills: skillCount
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
      counts.plugins = parseInt(pluginMatches[1]);
    }

    // Extract agent count - handle both total and file-based counts
    // Pattern: "39 agents (29 file-based + 10 role-based)" or "39 total"
    const totalAgentMatch = content.match(/(\d+)\s+(?:total|agents)\s*[:\(]?\s*(\d+)?\s*file-based\s*\+\s*(\d+)\s*role-based/i);
    if (totalAgentMatch) {
      counts.agents = parseInt(totalAgentMatch[1]); // Total count
      counts.fileBasedAgents = totalAgentMatch[2] ? parseInt(totalAgentMatch[2]) : null;
      counts.roleBasedAgents = parseInt(totalAgentMatch[3]);
    } else {
      // Look for top-level agent count (not plugin-specific)
      // Match patterns like "9 plugins · 39 agents" or "39 agents across"
      const topLevelMatch = content.match(/(?:·|,)\s*(\d+)\s+agents|(\d+)\s+agents\s+across/i);
      if (topLevelMatch) {
        counts.agents = parseInt(topLevelMatch[1] || topLevelMatch[2]);
      }
    }

    // Extract skill count
    const skillMatches = content.match(/(\d+)\s+skills/i);
    if (skillMatches) {
      counts.skills = parseInt(skillMatches[1]);
    }

    // Special handling for package.json
    if (docFile === 'package.json') {
      try {
        const pkg = JSON.parse(content);
        const descMatch = pkg.description.match(/(\d+)\s+specialized plugins/);
        if (descMatch) {
          counts.plugins = parseInt(descMatch[1]);
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
  const plugins = fs.readdirSync(pluginsDir).filter(f => {
    const stat = fs.statSync(path.join(pluginsDir, f));
    return stat.isDirectory();
  });

  plugins.forEach(plugin => {
    const pluginJsonPath = path.join(pluginsDir, plugin, 'plugin.json');
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

// Main execution
if (require.main === module) {
  console.log('[OK] Validating counts and versions...\n');

  const actualCounts = getActualCounts();
  const docCounts = extractCountsFromDocs();
  const versionCheck = checkVersionAlignment();
  const memoryAlignment = checkProjectMemoryAlignment();

  let hasErrors = false;

  // Check count alignment
  console.log('## Actual Counts (from filesystem)\n');
  console.log(`  Plugins: ${actualCounts.plugins}`);
  console.log(`  Agents:  ${actualCounts.totalAgents} (${actualCounts.fileBasedAgents} file-based + ${actualCounts.roleBasedAgents} role-based)`);
  console.log(`  Skills:  ${actualCounts.skills}`);
  console.log('');

  console.log('## Documentation Counts\n');
  Object.entries(docCounts).forEach(([file, counts]) => {
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

  // Check for mismatches
  console.log('## Count Validation\n');
  let countMismatches = [];

  Object.entries(docCounts).forEach(([file, counts]) => {
    if (counts.error) return;

    if (counts.plugins !== undefined && counts.plugins !== actualCounts.plugins) {
      countMismatches.push(formatCountMismatch(file, 'plugins', actualCounts.plugins, counts.plugins));
    }
    if (counts.agents !== undefined) {
      // Allow either total agent count or file-based count (for docs that only reference file-based)
      const isValid = counts.agents === actualCounts.totalAgents ||
                      counts.agents === actualCounts.fileBasedAgents ||
                      (counts.fileBasedAgents === actualCounts.fileBasedAgents &&
                       counts.roleBasedAgents === actualCounts.roleBasedAgents);

      if (!isValid) {
        countMismatches.push(formatCountMismatch(
          file,
          'agents',
          `${actualCounts.totalAgents} (${actualCounts.fileBasedAgents} file-based + ${actualCounts.roleBasedAgents} role-based)`,
          counts.agents
        ));
      }
    }
    if (counts.skills !== undefined && counts.skills !== actualCounts.skills) {
      countMismatches.push(formatCountMismatch(file, 'skills', actualCounts.skills, counts.skills));
    }
  });

  if (countMismatches.length > 0) {
    console.error('[ERROR] Count mismatches found:\n');
    countMismatches.forEach(msg => console.error(msg));
    console.error('');
    hasErrors = true;
  } else {
    console.log('[OK] All counts aligned across documentation\n');
  }

  // Check version alignment
  console.log('## Version Alignment\n');
  console.log(`  Main version (package.json): ${versionCheck.mainVersion}`);
  console.log('');

  if (versionCheck.issues.length > 0) {
    console.error('[ERROR] Version mismatches found:\n');
    versionCheck.issues.forEach(issue => {
      console.error(`  ${issue.file}:`);
      console.error(`    Expected: ${issue.expected}`);
      console.error(`    Actual:   ${issue.actual}`);
      console.error('');
    });
    hasErrors = true;
  } else {
    console.log('[OK] All plugin versions aligned with main version\n');
  }

  // Check project memory alignment
  console.log('## Project Memory Alignment (CLAUDE.md vs AGENTS.md)\n');
  if (memoryAlignment.error) {
    console.log(`  [SKIP] ${memoryAlignment.error}`);
  } else if (memoryAlignment.warning) {
    console.log(`  [SKIP] ${memoryAlignment.warning}`);
  } else {
    console.log(`  Similarity: ${memoryAlignment.similarity}`);
    console.log(`  CLAUDE.md critical rules: ${memoryAlignment.claudeLength} chars`);
    console.log(`  AGENTS.md critical rules: ${memoryAlignment.agentsLength} chars`);

    if (memoryAlignment.aligned) {
      console.log('\n[OK] CLAUDE.md and AGENTS.md are aligned\n');
    } else {
      console.warn('\n[WARN] CLAUDE.md and AGENTS.md divergence detected (similarity < 90%)\n');
      console.warn('This may be intentional (platform-specific differences) or may need sync.\n');
    }
  }

  if (hasErrors) {
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
  checkProjectMemoryAlignment
};
