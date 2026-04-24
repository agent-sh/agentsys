/**
 * Cross-File Semantic Analyzer
 * Analyzes relationships between agents, skills, and workflows
 *
 * Cross-platform compatible: Works with Claude Code, OpenCode, and Codex
 *
 * @author Avi Fenesh
 * @license MIT
 */

const fs = require('fs');
const path = require('path');
const { parseMarkdownFrontmatter } = require('./agent-analyzer');
const { crossFilePatterns, loadKnownTools } = require('./cross-file-patterns');

// ============================================
// CONSTANTS
// ============================================

/** Minimum instruction length to consider for duplicate/contradiction detection */
const MIN_INSTRUCTION_LENGTH = 20;

/** Minimum number of files for duplicate instruction flagging */
const MIN_DUPLICATE_COUNT = 3;

/** Similarity threshold for contradiction detection (0-1) */
const CONTRADICTION_SIMILARITY_THRESHOLD = 0.6;

/** Length of action text to compare for contradictions */
const ACTION_COMPARISON_LENGTH = 30;

/** Minimum word length for similarity calculation (filters noise) */
const MIN_WORD_LENGTH = 3;

/** Default analysis categories */
const DEFAULT_ANALYSIS_CATEGORIES = ['tool-consistency', 'workflow', 'consistency', 'skill-alignment'];

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Escape regex special characters in a string
 * @param {string} str - String to escape
 * @returns {string} Escaped string safe for RegExp
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validate that a path is within the expected root directory
 * Prevents path traversal attacks
 * @param {string} targetPath - Path to validate
 * @param {string} rootDir - Expected root directory
 * @returns {boolean} True if path is safe
 */
function isPathWithinRoot(targetPath, rootDir) {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedRoot = path.resolve(rootDir);
  return resolvedTarget.startsWith(resolvedRoot + path.sep) || resolvedTarget === resolvedRoot;
}

/**
 * Calculate simple string similarity (Jaccard index on words)
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Similarity score 0-1
 */
function calculateSimilarity(a, b) {
  if (!a || !b) return 0;

  const wordsA = new Set(a.split(/\s+/).filter(w => w.length >= MIN_WORD_LENGTH));
  const wordsB = new Set(b.split(/\s+/).filter(w => w.length >= MIN_WORD_LENGTH));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection++;
  }

  const union = wordsA.size + wordsB.size - intersection;
  return intersection / union;
}

// ============================================
// PRE-COMPILED PATTERNS
// ============================================

/** Pre-compiled shell command patterns for Bash detection */
const SHELL_PATTERNS = [
  /\bgit\s+(?:add|commit|push|pull|branch|checkout|merge|rebase|status|diff|log)\b/i,
  /\bnpm\s+(?:install|test|run|build|publish)\b/i,
  /\bpnpm\s+/i,
  /\byarn\s+/i,
  /\bcargo\s+/i,
  /\bgo\s+(?:build|test|run|mod)\b/i
];

/** Pre-compiled critical instruction patterns */
const CRITICAL_PATTERNS = [
  /\bMUST\b/,
  /\bNEVER\b/,
  /\bALWAYS\b/i,
  /\bREQUIRED\b/i,
  /\bFORBIDDEN\b/i,
  /\bCRITICAL\b/i,
  /\bDO NOT\b/i,
  /\bdon't\b/i
];

/** Pre-compiled pattern for extracting agent references */
const SUBAGENT_PATTERN = /subagent_type\s*[=:]\s*["']([^"']+)["']/g;

/** Pre-compiled patterns for cleaning content */
const BAD_EXAMPLE_TAG_PATTERN = /<bad[_\- ]?example>[\s\S]*?<\/bad[_\- ]?example>/gi;
const BAD_EXAMPLE_CODE_PATTERN = /```[^\n]*bad[^\n]*\n[\s\S]*?```/gi;

// ============================================
// TOOL PATTERN CACHE
// ============================================

/** Cache for compiled tool patterns */
const toolPatternCache = new Map();

/**
 * Get or create compiled patterns for a tool name
 * @param {string} tool - Tool name
 * @returns {Object} Compiled patterns for the tool
 */
function getToolPatterns(tool) {
  if (toolPatternCache.has(tool)) {
    return toolPatternCache.get(tool);
  }

  const escapedTool = escapeRegex(tool);
  const patterns = {
    call: new RegExp(`\\b${escapedTool}\\s*\\(`),
    mention: new RegExp(`\\b(?:use|invoke|call|with)\\s+(?:the\\s+)?${escapedTool}\\b`, 'i'),
    noun: new RegExp(`\\b${escapedTool}\\s+tool\\b`, 'i')
  };

  toolPatternCache.set(tool, patterns);
  return patterns;
}

// ============================================
// EXTRACTION FUNCTIONS
// ============================================

/**
 * Extract tool mentions from prompt content
 * Detects tool usage patterns in prompt body
 * @param {string} content - Prompt content
 * @param {string[]} knownTools - List of known tool names
 * @returns {string[]} Array of tool names found
 */
function extractToolMentions(content, knownTools) {
  if (!content || typeof content !== 'string') return [];
  if (!Array.isArray(knownTools)) return [];

  const found = new Set();

  // Skip content inside bad-example tags and code blocks with "bad" in info string
  const cleanContent = content
    .replace(BAD_EXAMPLE_TAG_PATTERN, '')
    .replace(BAD_EXAMPLE_CODE_PATTERN, '');

  for (const tool of knownTools) {
    const patterns = getToolPatterns(tool);

    // Pattern 1: Tool({ or Tool(
    if (patterns.call.test(cleanContent)) {
      found.add(tool);
      continue;
    }

    // Pattern 2: "use the Tool tool" or "invoke Tool"
    if (patterns.mention.test(cleanContent)) {
      found.add(tool);
      continue;
    }

    // Pattern 3: Tool tool (e.g., "Read tool", "Bash tool")
    if (patterns.noun.test(cleanContent)) {
      found.add(tool);
    }
  }

  // Special case: Bash detection via shell commands
  if (!found.has('Bash') && !found.has('Shell')) {
    for (const pattern of SHELL_PATTERNS) {
      if (pattern.test(cleanContent)) {
        found.add('Bash');
        break;
      }
    }
  }

  return Array.from(found);
}

/**
 * Extract agent references from content
 * Finds subagent_type references in Task() calls
 * @param {string} content - Content to scan
 * @returns {string[]} Array of referenced agent names (plugin:agent format)
 */
function extractAgentReferences(content) {
  if (!content || typeof content !== 'string') return [];

  const references = new Set();

  // Use matchAll for safer iteration (no lastIndex issues)
  const matches = content.matchAll(new RegExp(SUBAGENT_PATTERN.source, 'g'));
  for (const match of matches) {
    references.add(match[1]);
  }

  return Array.from(references);
}

/**
 * Extract critical instructions (lines with MUST, NEVER, always, etc.)
 * @param {string} content - Content to scan
 * @returns {Array<{line: string, lineNumber: number}>} Critical instructions
 */
function extractCriticalInstructions(content) {
  if (!content || typeof content !== 'string') return [];

  const instructions = [];
  const lines = content.split('\n');
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Track code block state
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    // Skip empty lines, headers, and content inside code blocks
    if (!line || line.startsWith('#') || inCodeBlock) continue;

    for (const pattern of CRITICAL_PATTERNS) {
      if (pattern.test(line)) {
        instructions.push({ line, lineNumber: i + 1 });
        break;
      }
    }
  }

  return instructions;
}

// ============================================
// FILE LOADING FUNCTIONS
// ============================================

/**
 * Generic function to load prompt files from plugins directory
 * @param {string} rootDir - Root directory
 * @param {string} subDir - Subdirectory name ('agents' or 'skills')
 * @param {Function} fileFilter - Function to filter files
 * @param {Function} pathBuilder - Function to build file path
 * @param {Object} options - Options including verbose flag
 * @returns {Array<Object>} Array of parsed prompt objects
 */
function loadPromptFiles(rootDir, subDir, fileFilter, pathBuilder, options = {}) {
  const results = [];
  const errors = [];

  const pluginsDir = path.join(rootDir, 'plugins');

  // Validate path is within root
  if (!isPathWithinRoot(pluginsDir, rootDir)) {
    if (options.verbose) {
      console.error('[cross-file] Invalid plugins directory path');
    }
    return results;
  }

  // Check if plugins directory exists
  try {
    fs.accessSync(pluginsDir);
  } catch {
    return results;
  }

  let plugins;
  try {
    plugins = fs.readdirSync(pluginsDir).filter(f => {
      const fullPath = path.join(pluginsDir, f);
      if (!isPathWithinRoot(fullPath, rootDir)) return false;
      try {
        return fs.statSync(fullPath).isDirectory();
      } catch {
        return false;
      }
    });
  } catch (err) {
    if (options.verbose) {
      console.error('[cross-file] Failed to read plugins directory:', err.message);
    }
    return results;
  }

  for (const plugin of plugins) {
    const targetDir = path.join(pluginsDir, plugin, subDir);

    // Validate path
    if (!isPathWithinRoot(targetDir, rootDir)) continue;

    // Check if directory exists
    try {
      fs.accessSync(targetDir);
    } catch {
      continue;
    }

    let files;
    try {
      files = fs.readdirSync(targetDir).filter(fileFilter);
    } catch (err) {
      if (options.verbose) {
        errors.push({ path: targetDir, error: err.message });
      }
      continue;
    }

    for (const file of files) {
      const filePath = pathBuilder(targetDir, file);

      // Validate path
      if (!isPathWithinRoot(filePath, rootDir)) continue;

      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const { frontmatter, body } = parseMarkdownFrontmatter(content);

        results.push({
          plugin,
          name: file.replace('.md', '').replace(/^SKILL$/, path.basename(path.dirname(filePath))),
          path: filePath,
          frontmatter: frontmatter || {},
          body,
          content
        });
      } catch (err) {
        if (options.verbose) {
          errors.push({ path: filePath, error: err.message });
        }
        // Skip files that can't be read - intentional for robustness
      }
    }
  }

  if (options.verbose && errors.length > 0) {
    console.error('[cross-file] File read errors:', errors);
  }

  return results;
}

/**
 * Load all agent files from a directory structure
 * @param {string} rootDir - Root directory to scan
 * @param {Object} options - Options including verbose flag
 * @returns {Array<Object>} Array of parsed agent objects
 */
function loadAllAgents(rootDir, options = {}) {
  return loadPromptFiles(
    rootDir,
    'agents',
    f => f.endsWith('.md') && f.toLowerCase() !== 'readme.md',
    (dir, file) => path.join(dir, file),
    options
  );
}

/**
 * Load all command files from a directory structure
 * @param {string} rootDir - Root directory to scan
 * @param {Object} options - Options including verbose flag
 * @returns {Array<Object>} Array of parsed command objects
 */
function loadAllCommands(rootDir, options = {}) {
  return loadPromptFiles(
    rootDir,
    'commands',
    f => f.endsWith('.md') && f.toLowerCase() !== 'readme.md',
    (dir, file) => path.join(dir, file),
    options
  );
}

/**
 * Load all skill files from a directory structure
 * @param {string} rootDir - Root directory to scan
 * @param {Object} options - Options including verbose flag
 * @returns {Array<Object>} Array of parsed skill objects
 */
function loadAllSkills(rootDir, options = {}) {
  const skills = [];
  const pluginsDir = path.join(rootDir, 'plugins');

  // Validate path
  if (!isPathWithinRoot(pluginsDir, rootDir)) {
    return skills;
  }

  try {
    fs.accessSync(pluginsDir);
  } catch {
    return skills;
  }

  let plugins;
  try {
    plugins = fs.readdirSync(pluginsDir).filter(f => {
      const fullPath = path.join(pluginsDir, f);
      if (!isPathWithinRoot(fullPath, rootDir)) return false;
      try {
        return fs.statSync(fullPath).isDirectory();
      } catch {
        return false;
      }
    });
  } catch (err) {
    if (options.verbose) {
      console.error('[cross-file] Failed to read plugins directory:', err.message);
    }
    return skills;
  }

  for (const plugin of plugins) {
    const skillsDir = path.join(pluginsDir, plugin, 'skills');

    if (!isPathWithinRoot(skillsDir, rootDir)) continue;

    try {
      fs.accessSync(skillsDir);
    } catch {
      continue;
    }

    let skillDirs;
    try {
      skillDirs = fs.readdirSync(skillsDir).filter(f => {
        const fullPath = path.join(skillsDir, f);
        if (!isPathWithinRoot(fullPath, rootDir)) return false;
        try {
          return fs.statSync(fullPath).isDirectory();
        } catch {
          return false;
        }
      });
    } catch (err) {
      if (options.verbose) {
        console.error('[cross-file] Failed to read skills directory:', skillsDir, err.message);
      }
      continue;
    }

    for (const skillDir of skillDirs) {
      const skillPath = path.join(skillsDir, skillDir, 'SKILL.md');

      if (!isPathWithinRoot(skillPath, rootDir)) continue;

      try {
        fs.accessSync(skillPath);
        const content = fs.readFileSync(skillPath, 'utf8');
        const { frontmatter, body } = parseMarkdownFrontmatter(content);

        skills.push({
          plugin,
          name: skillDir,
          path: skillPath,
          frontmatter: frontmatter || {},
          body,
          content
        });
      } catch (err) {
        if (options.verbose) {
          console.error('[cross-file] Failed to read skill:', skillPath, err.message);
        }
        // Skip files that can't be read - intentional for robustness
      }
    }
  }

  return skills;
}

// ============================================
// ANALYSIS FUNCTIONS
// ============================================

/**
 * Analyze tool consistency between frontmatter and body
 * @param {Array<Object>} agents - Parsed agents
 * @param {string[]} knownTools - Known tool names
 * @returns {Array<Object>} Findings
 */
function analyzeToolConsistency(agents, knownTools) {
  const findings = [];
  const pattern = crossFilePatterns.tool_not_in_allowed_list;

  for (const agent of agents) {
    const { frontmatter, body, name, path: agentPath } = agent;

    // Get declared tools from frontmatter
    let declaredTools = [];
    if (frontmatter && frontmatter.tools) {
      declaredTools = Array.isArray(frontmatter.tools)
        ? frontmatter.tools
        : frontmatter.tools.split(',').map(t => t.trim());
    }

    // Skip if no tools restriction (all tools allowed)
    if (declaredTools.length === 0) continue;

    // Extract used tools from body
    const usedTools = extractToolMentions(body, knownTools);

    const result = pattern.check({
      declaredTools,
      usedTools,
      agentName: name
    });

    if (result) {
      findings.push({
        ...result,
        file: agentPath,
        certainty: pattern.certainty,
        patternId: pattern.id,
        source: 'cross-file'
      });
    }
  }

  return findings;
}

/**
 * Analyze workflow completeness (referenced agents exist)
 * @param {Array<Object>} agents - Parsed agents
 * @returns {Array<Object>} Findings
 */
function analyzeWorkflowCompleteness(agents) {
  const findings = [];
  const pattern = crossFilePatterns.missing_workflow_agent;

  // Build list of existing agents
  const existingAgents = agents.map(a => ({
    plugin: a.plugin,
    name: a.name
  }));

  // Check each agent for references to other agents
  for (const agent of agents) {
    const { body, path: agentPath } = agent;
    const references = extractAgentReferences(body);

    for (const ref of references) {
      const result = pattern.check({
        referencedAgent: ref,
        existingAgents,
        sourceFile: path.basename(agentPath)
      });

      if (result) {
        findings.push({
          ...result,
          file: agentPath,
          certainty: pattern.certainty,
          patternId: pattern.id,
          source: 'cross-file'
        });
      }
    }
  }

  return findings;
}

/**
 * Analyze prompt consistency (duplicates, contradictions)
 * Uses optimized O(n) contradiction detection via keyword indexing
 * @param {Array<Object>} agents - Parsed agents
 * @returns {Array<Object>} Findings
 */
function analyzePromptConsistency(agents) {
  const findings = [];

  // Collect all critical instructions with their sources
  const instructionMap = new Map(); // normalized instruction -> [files]

  for (const agent of agents) {
    const instructions = extractCriticalInstructions(agent.body);

    for (const { line } of instructions) {
      const normalized = line.toLowerCase().trim();
      if (normalized.length < MIN_INSTRUCTION_LENGTH) continue;

      if (!instructionMap.has(normalized)) {
        instructionMap.set(normalized, []);
      }
      instructionMap.get(normalized).push(agent.path);
    }
  }

  // Find duplicates
  const duplicatePattern = crossFilePatterns.duplicate_instructions;
  for (const [instruction, files] of instructionMap.entries()) {
    if (files.length >= MIN_DUPLICATE_COUNT) {
      const result = duplicatePattern.check({ instruction, files });
      if (result) {
        findings.push({
          ...result,
          file: files[0],
          certainty: duplicatePattern.certainty,
          patternId: duplicatePattern.id,
          source: 'cross-file'
        });
      }
    }
  }

  // Find contradictions using keyword indexing (O(n) instead of O(n^2))
  const contradictionPattern = crossFilePatterns.contradictory_rules;

  // Index rules by keywords for efficient lookup
  const alwaysRulesByKeyword = new Map(); // keyword -> [{rule, file}]
  const neverRulesByKeyword = new Map();

  for (const agent of agents) {
    const instructions = extractCriticalInstructions(agent.body);

    for (const { line } of instructions) {
      const isAlways = /\bALWAYS\b/i.test(line);
      const isNever = /\bNEVER\b/i.test(line) || /\bDO NOT\b/i.test(line);

      if (!isAlways && !isNever) continue;

      // Extract action keywords
      let action;
      if (isAlways) {
        action = line.replace(/.*\bALWAYS\b\s*/i, '').substring(0, ACTION_COMPARISON_LENGTH);
      } else {
        action = line.replace(/.*\b(?:NEVER|DO NOT)\b\s*/i, '').substring(0, ACTION_COMPARISON_LENGTH);
      }

      // Extract significant keywords from action
      const keywords = action.toLowerCase().split(/\s+/).filter(w => w.length >= MIN_WORD_LENGTH);

      const ruleData = { line, file: agent.path, action: action.toLowerCase() };
      const targetMap = isAlways ? alwaysRulesByKeyword : neverRulesByKeyword;

      for (const keyword of keywords) {
        if (!targetMap.has(keyword)) {
          targetMap.set(keyword, []);
        }
        targetMap.get(keyword).push(ruleData);
      }
    }
  }

  // Find contradictions by checking overlapping keywords
  const checkedPairs = new Set();

  for (const [keyword, alwaysRules] of alwaysRulesByKeyword.entries()) {
    const neverRules = neverRulesByKeyword.get(keyword);
    if (!neverRules) continue;

    for (const always of alwaysRules) {
      for (const never of neverRules) {
        // Skip same file
        if (always.file === never.file) continue;

        // Skip already checked pairs
        const pairKey = `${always.line}|${never.line}`;
        if (checkedPairs.has(pairKey)) continue;
        checkedPairs.add(pairKey);

        // Check similarity
        const similarity = calculateSimilarity(always.action, never.action);
        if (similarity > CONTRADICTION_SIMILARITY_THRESHOLD) {
          const result = contradictionPattern.check({
            rule1: always.line,
            rule2: never.line,
            file1: path.basename(always.file),
            file2: path.basename(never.file)
          });

          if (result) {
            findings.push({
              ...result,
              file: always.file,
              certainty: contradictionPattern.certainty,
              patternId: contradictionPattern.id,
              source: 'cross-file'
            });
          }
        }
      }
    }
  }

  return findings;
}

/**
 * Analyze skill-agent alignment
 * @param {Array<Object>} skills - Parsed skills
 * @param {string[]} knownTools - Known tool names
 * @returns {Array<Object>} Findings
 */
function analyzeSkillAlignment(skills, knownTools) {
  const findings = [];
  const pattern = crossFilePatterns.skill_tool_mismatch;

  for (const skill of skills) {
    const { frontmatter, body, name, path: skillPath } = skill;

    // Get allowed-tools from frontmatter (supports multiple field names)
    let allowedTools = [];
    const toolsField = frontmatter['allowed-tools'] || frontmatter.allowedTools || frontmatter.tools;
    if (toolsField) {
      allowedTools = Array.isArray(toolsField)
        ? toolsField
        : toolsField.split(',').map(t => t.trim());
    }

    // Skip if no tools restriction
    if (allowedTools.length === 0) continue;

    // Extract used tools from body
    const usedTools = extractToolMentions(body, knownTools);

    const result = pattern.check({
      skillName: name,
      skillAllowedTools: allowedTools,
      promptUsedTools: usedTools
    });

    if (result) {
      findings.push({
        ...result,
        file: skillPath,
        certainty: pattern.certainty,
        patternId: pattern.id,
        source: 'cross-file'
      });
    }
  }

  return findings;
}

/**
 * Find orphaned agents (not referenced anywhere)
 * @param {Array<Object>} agents - Parsed agents
 * @param {Array<Object>} skills - Parsed skills
 * @param {Array<Object>} commands - Parsed commands
 * @returns {Array<Object>} Findings
 */
function analyzeOrphanedPrompts(agents, skills, commands = []) {
  const findings = [];
  const pattern = crossFilePatterns.orphaned_prompt;

  // Collect all agent references
  const allReferences = new Set();

  // From agents
  for (const agent of agents) {
    const refs = extractAgentReferences(agent.body);
    refs.forEach(r => allReferences.add(r));
  }

  // From skills
  for (const skill of skills) {
    const refs = extractAgentReferences(skill.body);
    refs.forEach(r => allReferences.add(r));
  }

  // From commands (addresses false positives for command-invoked agents)
  for (const command of commands) {
    const refs = extractAgentReferences(command.body);
    refs.forEach(r => allReferences.add(r));
  }

  // Check each agent
  for (const agent of agents) {
    const fullName = `${agent.plugin}:${agent.name}`;
    const shortName = agent.name;

    // Check if referenced
    const isReferenced = allReferences.has(fullName) || allReferences.has(shortName);

    // Entry point agents are typically called by commands, not other agents
    const isEntryPoint = /orchestrator|discoverer|validator|monitor|fixer|checker|reporter|manager/i.test(agent.name);

    if (!isReferenced && !isEntryPoint) {
      const result = pattern.check({
        promptFile: path.basename(agent.path),
        referencedBy: []
      });

      if (result) {
        findings.push({
          ...result,
          file: agent.path,
          certainty: pattern.certainty,
          patternId: pattern.id,
          source: 'cross-file'
        });
      }
    }
  }

  return findings;
}

// ============================================
// MAIN ANALYSIS FUNCTION
// ============================================

/**
 * Main cross-file analysis function
 * @param {string} rootDir - Root directory to analyze
 * @param {Object} options - Analysis options
 * @param {boolean} options.verbose - Include all findings and log errors
 * @param {string[]} options.categories - Specific categories to check
 * @returns {Object} Analysis results
 */
function analyze(rootDir, options = {}) {
  const {
    verbose = false,
    categories = DEFAULT_ANALYSIS_CATEGORIES
  } = options;

  const results = {
    rootDir,
    findings: [],
    summary: {
      agentsAnalyzed: 0,
      skillsAnalyzed: 0,
      totalFindings: 0,
      byCategory: {}
    }
  };

  // Load known tools (config file or platform defaults)
  const knownTools = loadKnownTools(rootDir);

  // Load all agents, skills, and commands
  const agents = loadAllAgents(rootDir, { verbose });
  const skills = loadAllSkills(rootDir, { verbose });
  const commands = loadAllCommands(rootDir, { verbose });

  results.summary.agentsAnalyzed = agents.length;
  results.summary.skillsAnalyzed = skills.length;
  results.summary.commandsAnalyzed = commands.length;

  // Run analysis for each category
  if (categories.includes('tool-consistency')) {
    const toolFindings = analyzeToolConsistency(agents, knownTools);
    results.findings.push(...toolFindings);
    results.summary.byCategory['tool-consistency'] = toolFindings.length;
  }

  if (categories.includes('workflow')) {
    const workflowFindings = analyzeWorkflowCompleteness(agents);
    results.findings.push(...workflowFindings);
    results.summary.byCategory['workflow'] = workflowFindings.length;
  }

  if (categories.includes('consistency')) {
    const consistencyFindings = analyzePromptConsistency(agents);
    const orphanFindings = analyzeOrphanedPrompts(agents, skills, commands);
    results.findings.push(...consistencyFindings, ...orphanFindings);
    results.summary.byCategory['consistency'] = consistencyFindings.length + orphanFindings.length;
  }

  if (categories.includes('skill-alignment')) {
    const skillFindings = analyzeSkillAlignment(skills, knownTools);
    results.findings.push(...skillFindings);
    results.summary.byCategory['skill-alignment'] = skillFindings.length;
  }

  results.summary.totalFindings = results.findings.length;

  return results;
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Extraction functions
  extractToolMentions,
  extractAgentReferences,
  extractCriticalInstructions,

  // Loading functions
  loadAllAgents,
  loadAllSkills,
  loadAllCommands,

  // Analysis functions
  analyzeToolConsistency,
  analyzeWorkflowCompleteness,
  analyzePromptConsistency,
  analyzeSkillAlignment,
  analyzeOrphanedPrompts,

  // Main entry point
  analyze,

  // Utilities (exported for testing)
  calculateSimilarity,
  escapeRegex,
  isPathWithinRoot
};
