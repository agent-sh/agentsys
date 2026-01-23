/**
 * Plugin Analysis Reporter
 * Generates markdown reports for plugin analysis results
 *
 * @author Avi Fenesh
 * @license MIT
 */

/**
 * Generate a markdown report from analysis results
 * @param {Object} results - Analysis results
 * @param {string} results.pluginName - Name of analyzed plugin
 * @param {Array} results.toolIssues - Tool definition issues
 * @param {Array} results.structureIssues - Plugin structure issues
 * @param {Array} results.securityIssues - Security issues
 * @param {Object} options - Report options
 * @param {boolean} options.verbose - Include LOW certainty issues
 * @param {boolean} options.compact - Use compact format
 * @returns {string} Markdown report
 */
function generateReport(results, options = {}) {
  const { verbose = false, compact = false } = options;

  // Filter issues by certainty
  const filterIssues = (issues) => {
    if (verbose) return issues;
    return issues.filter(i => i.certainty !== 'LOW');
  };

  const toolIssues = filterIssues(results.toolIssues || []);
  const structureIssues = filterIssues(results.structureIssues || []);
  const securityIssues = filterIssues(results.securityIssues || []);

  const totalIssues = toolIssues.length + structureIssues.length + securityIssues.length;

  if (compact) {
    return generateCompactReport(results.pluginName, toolIssues, structureIssues, securityIssues);
  }

  const lines = [];

  // Header
  lines.push(`## Plugin Analysis: ${results.pluginName}`);
  lines.push('');
  lines.push(`**Analyzed**: ${new Date().toISOString()}`);
  lines.push(`**Files scanned**: ${results.filesScanned || 0}`);
  lines.push('');

  // Summary
  lines.push('### Summary');
  lines.push('');

  const highCount = countByCertainty([...toolIssues, ...structureIssues, ...securityIssues], 'HIGH');
  const mediumCount = countByCertainty([...toolIssues, ...structureIssues, ...securityIssues], 'MEDIUM');
  const lowCount = verbose ? countByCertainty([...toolIssues, ...structureIssues, ...securityIssues], 'LOW') : 0;

  lines.push(`| Certainty | Count |`);
  lines.push(`|-----------|-------|`);
  lines.push(`| HIGH | ${highCount} |`);
  lines.push(`| MEDIUM | ${mediumCount} |`);
  if (verbose) {
    lines.push(`| LOW | ${lowCount} |`);
  }
  lines.push(`| **Total** | **${totalIssues}** |`);
  lines.push('');

  // Tool Issues
  if (toolIssues.length > 0) {
    lines.push(`### Tool Definitions (${toolIssues.length} issues)`);
    lines.push('');
    lines.push('| Tool | Issue | Fix | Certainty |');
    lines.push('|------|-------|-----|-----------|');
    for (const issue of toolIssues) {
      lines.push(`| ${issue.tool || '-'} | ${issue.issue} | ${issue.fix || '-'} | ${issue.certainty} |`);
    }
    lines.push('');
  }

  // Structure Issues
  if (structureIssues.length > 0) {
    lines.push(`### Structure (${structureIssues.length} issues)`);
    lines.push('');
    lines.push('| File | Issue | Certainty |');
    lines.push('|------|-------|-----------|');
    for (const issue of structureIssues) {
      lines.push(`| ${issue.file || '-'} | ${issue.issue} | ${issue.certainty} |`);
    }
    lines.push('');
  }

  // Security Issues
  if (securityIssues.length > 0) {
    lines.push(`### Security (${securityIssues.length} issues)`);
    lines.push('');
    lines.push('| File | Line | Issue | Certainty |');
    lines.push('|------|------|-------|-----------|');
    for (const issue of securityIssues) {
      lines.push(`| ${issue.file || '-'} | ${issue.line || '-'} | ${issue.issue} | ${issue.certainty} |`);
    }
    lines.push('');
  }

  // No issues
  if (totalIssues === 0) {
    lines.push('No issues found.');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate a compact report format
 * @private
 */
function generateCompactReport(pluginName, toolIssues, structureIssues, securityIssues) {
  const lines = [];

  lines.push(`## ${pluginName}: ${toolIssues.length + structureIssues.length + securityIssues.length} issues`);
  lines.push('');

  const allIssues = [
    ...toolIssues.map(i => ({ ...i, category: 'Tool' })),
    ...structureIssues.map(i => ({ ...i, category: 'Structure' })),
    ...securityIssues.map(i => ({ ...i, category: 'Security' }))
  ];

  // Sort by certainty (HIGH first)
  const certOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  allIssues.sort((a, b) => certOrder[a.certainty] - certOrder[b.certainty]);

  if (allIssues.length > 0) {
    lines.push('| Category | Issue | Certainty |');
    lines.push('|----------|-------|-----------|');
    for (const issue of allIssues) {
      lines.push(`| ${issue.category} | ${issue.issue} | ${issue.certainty} |`);
    }
  } else {
    lines.push('No issues found.');
  }

  return lines.join('\n');
}

/**
 * Count issues by certainty level
 * @private
 */
function countByCertainty(issues, certainty) {
  return issues.filter(i => i.certainty === certainty).length;
}

/**
 * Generate a diff display for a fix
 * @param {string} original - Original content
 * @param {string} modified - Modified content
 * @param {string} filePath - File path
 * @returns {string} Diff display
 */
function generateDiff(original, modified, filePath) {
  const lines = [];

  lines.push(`\`\`\`diff`);
  lines.push(`--- a/${filePath}`);
  lines.push(`+++ b/${filePath}`);

  const origLines = original.split('\n');
  const modLines = modified.split('\n');

  // Simple line-by-line diff (for demo - real implementation would use proper diff algorithm)
  const maxLines = Math.max(origLines.length, modLines.length);
  for (let i = 0; i < maxLines; i++) {
    const origLine = origLines[i];
    const modLine = modLines[i];

    if (origLine === modLine) {
      if (origLine !== undefined) {
        lines.push(` ${origLine}`);
      }
    } else {
      if (origLine !== undefined) {
        lines.push(`-${origLine}`);
      }
      if (modLine !== undefined) {
        lines.push(`+${modLine}`);
      }
    }
  }

  lines.push(`\`\`\``);

  return lines.join('\n');
}

/**
 * Generate a summary report for multiple plugins
 * @param {Array} allResults - Array of plugin analysis results
 * @param {Object} options - Report options
 * @returns {string} Summary markdown report
 */
function generateSummaryReport(allResults, options = {}) {
  const lines = [];

  lines.push('# Plugin Analysis Summary');
  lines.push('');
  lines.push(`**Analyzed**: ${allResults.length} plugins`);
  lines.push(`**Date**: ${new Date().toISOString()}`);
  lines.push('');

  // Overall stats
  let totalHigh = 0;
  let totalMedium = 0;
  let totalLow = 0;

  for (const result of allResults) {
    const allIssues = [
      ...(result.toolIssues || []),
      ...(result.structureIssues || []),
      ...(result.securityIssues || [])
    ];
    totalHigh += countByCertainty(allIssues, 'HIGH');
    totalMedium += countByCertainty(allIssues, 'MEDIUM');
    totalLow += countByCertainty(allIssues, 'LOW');
  }

  lines.push('## Overall');
  lines.push('');
  lines.push('| Certainty | Count |');
  lines.push('|-----------|-------|');
  lines.push(`| HIGH | ${totalHigh} |`);
  lines.push(`| MEDIUM | ${totalMedium} |`);
  if (options.verbose) {
    lines.push(`| LOW | ${totalLow} |`);
  }
  lines.push('');

  // Per-plugin summary
  lines.push('## By Plugin');
  lines.push('');
  lines.push('| Plugin | HIGH | MEDIUM | LOW | Total |');
  lines.push('|--------|------|--------|-----|-------|');

  for (const result of allResults) {
    const allIssues = [
      ...(result.toolIssues || []),
      ...(result.structureIssues || []),
      ...(result.securityIssues || [])
    ];
    const h = countByCertainty(allIssues, 'HIGH');
    const m = countByCertainty(allIssues, 'MEDIUM');
    const l = countByCertainty(allIssues, 'LOW');
    lines.push(`| ${result.pluginName} | ${h} | ${m} | ${l} | ${h + m + l} |`);
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Generate report for a single agent analysis
 * @param {Object} results - Agent analysis results
 * @param {Object} options - Report options
 * @returns {string} Markdown report
 */
function generateAgentReport(results, options = {}) {
  const lines = [];

  lines.push(`# Agent Analysis: ${results.agentName}`);
  lines.push('');
  lines.push(`**File**: ${results.agentPath}`);
  lines.push(`**Analyzed**: ${new Date().toISOString()}`);
  lines.push('');

  // Collect all issues
  const allIssues = [
    ...(results.structureIssues || []),
    ...(results.toolIssues || []),
    ...(results.xmlIssues || []),
    ...(results.cotIssues || []),
    ...(results.exampleIssues || []),
    ...(results.antiPatternIssues || []),
    ...(results.crossPlatformIssues || [])
  ];

  // Count by certainty
  const highCount = countByCertainty(allIssues, 'HIGH');
  const mediumCount = countByCertainty(allIssues, 'MEDIUM');
  const lowCount = countByCertainty(allIssues, 'LOW');

  lines.push('## Summary');
  lines.push('');
  lines.push('| Certainty | Count |');
  lines.push('|-----------|-------|');
  lines.push(`| HIGH | ${highCount} |`);
  lines.push(`| MEDIUM | ${mediumCount} |`);
  if (options.verbose) {
    lines.push(`| LOW | ${lowCount} |`);
  }
  lines.push('');

  // Structure Issues
  if (results.structureIssues && results.structureIssues.length > 0) {
    lines.push(`### Structure Issues (${results.structureIssues.length})`);
    lines.push('');
    lines.push('| Issue | Fix | Certainty |');
    lines.push('|-------|-----|-----------|');
    for (const issue of results.structureIssues) {
      lines.push(`| ${issue.issue} | ${issue.fix || 'N/A'} | ${issue.certainty} |`);
    }
    lines.push('');
  }

  // Tool Issues
  if (results.toolIssues && results.toolIssues.length > 0) {
    lines.push(`### Tool Issues (${results.toolIssues.length})`);
    lines.push('');
    lines.push('| Issue | Fix | Certainty |');
    lines.push('|-------|-----|-----------|');
    for (const issue of results.toolIssues) {
      lines.push(`| ${issue.issue} | ${issue.fix || 'N/A'} | ${issue.certainty} |`);
    }
    lines.push('');
  }

  // XML Issues
  if (results.xmlIssues && results.xmlIssues.length > 0) {
    lines.push(`### XML Structure Issues (${results.xmlIssues.length})`);
    lines.push('');
    lines.push('| Issue | Fix | Certainty |');
    lines.push('|-------|-----|-----------|');
    for (const issue of results.xmlIssues) {
      lines.push(`| ${issue.issue} | ${issue.fix || 'N/A'} | ${issue.certainty} |`);
    }
    lines.push('');
  }

  // CoT Issues
  if (results.cotIssues && results.cotIssues.length > 0) {
    lines.push(`### Chain-of-Thought Issues (${results.cotIssues.length})`);
    lines.push('');
    lines.push('| Issue | Fix | Certainty |');
    lines.push('|-------|-----|-----------|');
    for (const issue of results.cotIssues) {
      lines.push(`| ${issue.issue} | ${issue.fix || 'N/A'} | ${issue.certainty} |`);
    }
    lines.push('');
  }

  // Example Issues
  if (results.exampleIssues && results.exampleIssues.length > 0) {
    lines.push(`### Example Issues (${results.exampleIssues.length})`);
    lines.push('');
    lines.push('| Issue | Fix | Certainty |');
    lines.push('|-------|-----|-----------|');
    for (const issue of results.exampleIssues) {
      lines.push(`| ${issue.issue} | ${issue.fix || 'N/A'} | ${issue.certainty} |`);
    }
    lines.push('');
  }

  // Anti-Pattern Issues
  if (results.antiPatternIssues && results.antiPatternIssues.length > 0) {
    lines.push(`### Anti-Pattern Issues (${results.antiPatternIssues.length})`);
    lines.push('');
    lines.push('| Issue | Fix | Certainty |');
    lines.push('|-------|-----|-----------|');
    for (const issue of results.antiPatternIssues) {
      lines.push(`| ${issue.issue} | ${issue.fix || 'N/A'} | ${issue.certainty} |`);
    }
    lines.push('');
  }

  // Cross-Platform Issues
  if (results.crossPlatformIssues && results.crossPlatformIssues.length > 0) {
    lines.push(`### Cross-Platform Issues (${results.crossPlatformIssues.length})`);
    lines.push('');
    lines.push('| Issue | Fix | Certainty |');
    lines.push('|-------|-----|-----------|');
    for (const issue of results.crossPlatformIssues) {
      lines.push(`| ${issue.issue} | ${issue.fix || 'N/A'} | ${issue.certainty} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate summary report for multiple agent analyses
 * @param {Array} allResults - Array of agent analysis results
 * @param {Object} options - Report options
 * @returns {string} Markdown report
 */
function generateAgentSummaryReport(allResults, options = {}) {
  const lines = [];

  lines.push('# Agent Analysis Summary');
  lines.push('');
  lines.push(`**Analyzed**: ${allResults.length} agents`);
  lines.push(`**Date**: ${new Date().toISOString()}`);
  lines.push('');

  // Overall stats
  let totalHigh = 0;
  let totalMedium = 0;
  let totalLow = 0;

  for (const result of allResults) {
    const allIssues = [
      ...(result.structureIssues || []),
      ...(result.toolIssues || []),
      ...(result.xmlIssues || []),
      ...(result.cotIssues || []),
      ...(result.exampleIssues || []),
      ...(result.antiPatternIssues || []),
      ...(result.crossPlatformIssues || [])
    ];
    totalHigh += countByCertainty(allIssues, 'HIGH');
    totalMedium += countByCertainty(allIssues, 'MEDIUM');
    totalLow += countByCertainty(allIssues, 'LOW');
  }

  lines.push('## Overall');
  lines.push('');
  lines.push('| Certainty | Count |');
  lines.push('|-----------|-------|');
  lines.push(`| HIGH | ${totalHigh} |`);
  lines.push(`| MEDIUM | ${totalMedium} |`);
  if (options.verbose) {
    lines.push(`| LOW | ${totalLow} |`);
  }
  lines.push('');

  // Per-agent summary
  lines.push('## By Agent');
  lines.push('');
  lines.push('| Agent | HIGH | MEDIUM | LOW | Total |');
  lines.push('|-------|------|--------|-----|-------|');

  for (const result of allResults) {
    const allIssues = [
      ...(result.structureIssues || []),
      ...(result.toolIssues || []),
      ...(result.xmlIssues || []),
      ...(result.cotIssues || []),
      ...(result.exampleIssues || []),
      ...(result.antiPatternIssues || [])
    ];
    const h = countByCertainty(allIssues, 'HIGH');
    const m = countByCertainty(allIssues, 'MEDIUM');
    const l = countByCertainty(allIssues, 'LOW');
    lines.push(`| ${result.agentName} | ${h} | ${m} | ${l} | ${h + m + l} |`);
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Generate report for a single documentation analysis
 * @param {Object} results - Docs analysis results
 * @param {Object} options - Report options
 * @returns {string} Markdown report
 */
function generateDocsReport(results, options = {}) {
  const lines = [];

  lines.push(`# Documentation Analysis: ${results.docName}`);
  lines.push('');
  lines.push(`**File**: ${results.docPath}`);
  lines.push(`**Mode**: ${results.mode === 'ai' ? 'AI-only (RAG optimized)' : 'Both audiences'}`);
  lines.push(`**Token Count**: ~${results.tokenCount}`);
  lines.push(`**Analyzed**: ${new Date().toISOString()}`);
  lines.push('');

  // Collect all issues
  const allIssues = [
    ...(results.linkIssues || []),
    ...(results.structureIssues || []),
    ...(results.codeIssues || []),
    ...(results.efficiencyIssues || []),
    ...(results.ragIssues || []),
    ...(results.balanceIssues || [])
  ];

  // Count by certainty
  const highCount = countByCertainty(allIssues, 'HIGH');
  const mediumCount = countByCertainty(allIssues, 'MEDIUM');
  const lowCount = countByCertainty(allIssues, 'LOW');

  lines.push('## Summary');
  lines.push('');
  lines.push('| Certainty | Count |');
  lines.push('|-----------|-------|');
  lines.push(`| HIGH | ${highCount} |`);
  lines.push(`| MEDIUM | ${mediumCount} |`);
  if (options.verbose) {
    lines.push(`| LOW | ${lowCount} |`);
  }
  lines.push('');

  // Link Issues
  if (results.linkIssues && results.linkIssues.length > 0) {
    lines.push(`### Link Issues (${results.linkIssues.length})`);
    lines.push('');
    lines.push('| Issue | Fix | Certainty |');
    lines.push('|-------|-----|-----------|');
    for (const issue of results.linkIssues) {
      lines.push(`| ${issue.issue} | ${issue.fix || 'N/A'} | ${issue.certainty} |`);
    }
    lines.push('');
  }

  // Structure Issues
  if (results.structureIssues && results.structureIssues.length > 0) {
    lines.push(`### Structure Issues (${results.structureIssues.length})`);
    lines.push('');
    lines.push('| Issue | Fix | Certainty |');
    lines.push('|-------|-----|-----------|');
    for (const issue of results.structureIssues) {
      lines.push(`| ${issue.issue} | ${issue.fix || 'N/A'} | ${issue.certainty} |`);
    }
    lines.push('');
  }

  // Code Issues
  if (results.codeIssues && results.codeIssues.length > 0) {
    lines.push(`### Code Block Issues (${results.codeIssues.length})`);
    lines.push('');
    lines.push('| Issue | Fix | Certainty |');
    lines.push('|-------|-----|-----------|');
    for (const issue of results.codeIssues) {
      lines.push(`| ${issue.issue} | ${issue.fix || 'N/A'} | ${issue.certainty} |`);
    }
    lines.push('');
  }

  // Efficiency Issues (AI mode)
  if (results.efficiencyIssues && results.efficiencyIssues.length > 0) {
    lines.push(`### Efficiency Issues (${results.efficiencyIssues.length})`);
    lines.push('');
    lines.push('| Issue | Fix | Certainty |');
    lines.push('|-------|-----|-----------|');
    for (const issue of results.efficiencyIssues) {
      lines.push(`| ${issue.issue} | ${issue.fix || 'N/A'} | ${issue.certainty} |`);
    }
    lines.push('');
  }

  // RAG Issues (AI mode)
  if (results.ragIssues && results.ragIssues.length > 0) {
    lines.push(`### RAG Optimization Issues (${results.ragIssues.length})`);
    lines.push('');
    lines.push('| Issue | Fix | Certainty |');
    lines.push('|-------|-----|-----------|');
    for (const issue of results.ragIssues) {
      lines.push(`| ${issue.issue} | ${issue.fix || 'N/A'} | ${issue.certainty} |`);
    }
    lines.push('');
  }

  // Balance Issues (both mode)
  if (results.balanceIssues && results.balanceIssues.length > 0) {
    lines.push(`### Balance Suggestions (${results.balanceIssues.length})`);
    lines.push('');
    lines.push('| Issue | Fix | Certainty |');
    lines.push('|-------|-----|-----------|');
    for (const issue of results.balanceIssues) {
      lines.push(`| ${issue.issue} | ${issue.fix || 'N/A'} | ${issue.certainty} |`);
    }
    lines.push('');
  }

  // No issues
  if (allIssues.length === 0) {
    lines.push('No issues found.');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate summary report for multiple documentation analyses
 * @param {Array} allResults - Array of docs analysis results
 * @param {Object} options - Report options
 * @returns {string} Markdown report
 */
function generateDocsSummaryReport(allResults, options = {}) {
  const lines = [];

  // Determine mode from first result
  const mode = allResults[0]?.mode || 'both';

  lines.push('# Documentation Analysis Summary');
  lines.push('');
  lines.push(`**Analyzed**: ${allResults.length} documents`);
  lines.push(`**Mode**: ${mode === 'ai' ? 'AI-only (RAG optimized)' : 'Both audiences'}`);
  lines.push(`**Date**: ${new Date().toISOString()}`);
  lines.push('');

  // Overall stats
  let totalHigh = 0;
  let totalMedium = 0;
  let totalLow = 0;
  let totalTokens = 0;

  for (const result of allResults) {
    const allIssues = [
      ...(result.linkIssues || []),
      ...(result.structureIssues || []),
      ...(result.codeIssues || []),
      ...(result.efficiencyIssues || []),
      ...(result.ragIssues || []),
      ...(result.balanceIssues || [])
    ];
    totalHigh += countByCertainty(allIssues, 'HIGH');
    totalMedium += countByCertainty(allIssues, 'MEDIUM');
    totalLow += countByCertainty(allIssues, 'LOW');
    totalTokens += result.tokenCount || 0;
  }

  lines.push('## Overall');
  lines.push('');
  lines.push(`**Total Tokens**: ~${totalTokens}`);
  lines.push('');
  lines.push('| Certainty | Count |');
  lines.push('|-----------|-------|');
  lines.push(`| HIGH | ${totalHigh} |`);
  lines.push(`| MEDIUM | ${totalMedium} |`);
  if (options.verbose) {
    lines.push(`| LOW | ${totalLow} |`);
  }
  lines.push('');

  // Per-document summary
  lines.push('## By Document');
  lines.push('');
  lines.push('| Document | Tokens | HIGH | MEDIUM | LOW | Total |');
  lines.push('|----------|--------|------|--------|-----|-------|');

  for (const result of allResults) {
    const allIssues = [
      ...(result.linkIssues || []),
      ...(result.structureIssues || []),
      ...(result.codeIssues || []),
      ...(result.efficiencyIssues || []),
      ...(result.ragIssues || []),
      ...(result.balanceIssues || [])
    ];
    const h = countByCertainty(allIssues, 'HIGH');
    const m = countByCertainty(allIssues, 'MEDIUM');
    const l = countByCertainty(allIssues, 'LOW');
    lines.push(`| ${result.docName} | ${result.tokenCount} | ${h} | ${m} | ${l} | ${h + m + l} |`);
  }

  lines.push('');

  return lines.join('\n');
}

module.exports = {
  generateReport,
  generateDiff,
  generateSummaryReport,
  generateAgentReport,
  generateAgentSummaryReport,
  generateDocsReport,
  generateDocsSummaryReport
};
