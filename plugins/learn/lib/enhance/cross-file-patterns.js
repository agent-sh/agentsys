/**
 * Cross-File Semantic Analysis Patterns
 * Detection patterns for multi-file consistency and alignment
 *
 * Cross-platform compatible: Works with Claude Code, OpenCode, and Codex
 *
 * @author Avi Fenesh
 * @license MIT
 */

const fs = require('fs');
const path = require('path');
const { getStateDir, getPlatformName } = require('../platform/state-dir');

/**
 * Platform-specific default tools
 * These are used when no tools.json config is found
 */
const PLATFORM_TOOLS = {
  claude: [
    'Task', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash',
    'WebFetch', 'WebSearch', 'AskUserQuestion', 'NotebookEdit',
    'LSP', 'Skill', 'EnterPlanMode', 'ExitPlanMode',
    'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet', 'TaskOutput', 'TaskStop'
  ],
  opencode: [
    'Task', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash',
    'WebFetch', 'WebSearch', 'AskUser', 'Notebook',
    'LSP', 'Skill', 'Plan'
  ],
  codex: [
    'Task', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash',
    'WebFetch', 'Ask', 'Shell'
  ],
  // Superset for unknown platforms
  unknown: [
    'Task', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash',
    'WebFetch', 'WebSearch', 'AskUserQuestion', 'AskUser', 'Ask',
    'NotebookEdit', 'Notebook', 'LSP', 'Skill', 'Plan',
    'EnterPlanMode', 'ExitPlanMode', 'Shell',
    'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet', 'TaskOutput', 'TaskStop'
  ]
};

/** Maximum size for tools.json config file (prevents DoS via large files) */
const MAX_CONFIG_SIZE = 64 * 1024; // 64KB

/**
 * Load tools configuration from state directory or use platform defaults
 * @param {string} [basePath=process.cwd()] - Base path to check
 * @returns {string[]} Array of known tool names
 */
function loadKnownTools(basePath = process.cwd()) {
  const stateDir = getStateDir(basePath);
  const toolsConfigPath = path.join(basePath, stateDir, 'tools.json');

  // Try to load from config file (without race condition)
  try {
    const content = fs.readFileSync(toolsConfigPath, 'utf8');

    // Size limit check
    if (content.length > MAX_CONFIG_SIZE) {
      if (process.env.DEBUG) {
        console.error('[cross-file-patterns] tools.json exceeds size limit, using defaults');
      }
      throw new Error('Config file too large');
    }

    const config = JSON.parse(content);

    // Validate config structure
    if (Array.isArray(config.tools)) {
      return config.tools;
    }
    if (config.knownTools && Array.isArray(config.knownTools)) {
      return config.knownTools;
    }

    if (process.env.DEBUG) {
      console.error('[cross-file-patterns] tools.json missing tools array, using defaults');
    }
  } catch (err) {
    // ENOENT (file not found) is expected, don't log
    // Other errors should be logged for debugging
    if (err.code !== 'ENOENT' && process.env.DEBUG) {
      console.error('[cross-file-patterns] Failed to load tools.json:', err.message);
    }
  }

  // Fall back to platform-specific defaults
  const platform = getPlatformName(basePath);
  return PLATFORM_TOOLS[platform] || PLATFORM_TOOLS.unknown;
}

/**
 * Cross-file semantic analysis patterns
 * All patterns use MEDIUM certainty since cross-file analysis requires human review
 */
const crossFilePatterns = {
  /**
   * Tool mentioned in prompt body not in frontmatter tools list
   */
  tool_not_in_allowed_list: {
    id: 'tool_not_in_allowed_list',
    category: 'tool-consistency',
    certainty: 'MEDIUM',
    autoFix: false,
    description: 'Prompt mentions tools not declared in frontmatter',
    check: (data) => {
      const { declaredTools, usedTools, agentName } = data;
      if (!declaredTools || declaredTools.length === 0) return null;
      if (!usedTools || usedTools.length === 0) return null;

      // Normalize declared tools (handle Bash(git:*) -> Bash)
      const normalizedDeclared = declaredTools.map(t => t.split('(')[0].trim());

      const undeclared = usedTools.filter(tool =>
        !normalizedDeclared.includes(tool) &&
        !normalizedDeclared.includes('*')
      );

      if (undeclared.length > 0) {
        return {
          issue: `Agent "${agentName}" uses ${undeclared.join(', ')} but not declared in tools frontmatter`,
          fix: `Add ${undeclared.join(', ')} to tools field or remove usage from prompt`
        };
      }
      return null;
    }
  },

  /**
   * Workflow references an agent that does not exist
   */
  missing_workflow_agent: {
    id: 'missing_workflow_agent',
    category: 'workflow',
    certainty: 'MEDIUM',
    autoFix: false,
    description: 'Workflow references non-existent agent',
    check: (data) => {
      const { referencedAgent, existingAgents, sourceFile } = data;
      if (!referencedAgent || !existingAgents) return null;

      // Extract plugin:agent format
      const [plugin, agentName] = referencedAgent.includes(':')
        ? referencedAgent.split(':')
        : [null, referencedAgent];

      // Check if agent exists
      const exists = existingAgents.some(a => {
        if (plugin) {
          return a.plugin === plugin && a.name === agentName;
        }
        return a.name === agentName;
      });

      if (!exists) {
        return {
          issue: `Referenced agent "${referencedAgent}" does not exist`,
          fix: `Create agent "${referencedAgent}" or fix the reference in ${sourceFile}`
        };
      }
      return null;
    }
  },

  /**
   * Workflow phases not fully connected
   */
  incomplete_phase_transition: {
    id: 'incomplete_phase_transition',
    category: 'workflow',
    certainty: 'MEDIUM',
    autoFix: false,
    description: 'Workflow phase transitions are incomplete',
    check: (data) => {
      const { phases, transitions, workflowFile } = data;
      if (!phases || !transitions || phases.length === 0) return null;

      // Check each phase has a transition (except last)
      const missingTransitions = [];
      for (let i = 0; i < phases.length - 1; i++) {
        const currentPhase = phases[i];
        const hasTransition = transitions.some(t =>
          t.from === currentPhase || t.to === phases[i + 1]
        );
        if (!hasTransition) {
          missingTransitions.push(`${currentPhase} -> ${phases[i + 1]}`);
        }
      }

      if (missingTransitions.length > 0) {
        return {
          issue: `Missing phase transitions: ${missingTransitions.join(', ')}`,
          fix: `Add transition logic for ${missingTransitions[0]} in ${workflowFile}`
        };
      }
      return null;
    }
  },

  /**
   * Duplicate instructions across multiple agents
   */
  duplicate_instructions: {
    id: 'duplicate_instructions',
    category: 'consistency',
    certainty: 'MEDIUM',
    autoFix: false,
    description: 'Identical critical instructions across agents',
    check: (data) => {
      const { instruction, files } = data;
      if (!instruction || !files || files.length < 2) return null;

      return {
        issue: `Duplicate instruction found in ${files.length} files: "${instruction.substring(0, 50)}..."`,
        fix: `Extract shared instruction to a common include or ensure intentional duplication`
      };
    }
  },

  /**
   * Contradictory rules across agents
   */
  contradictory_rules: {
    id: 'contradictory_rules',
    category: 'consistency',
    certainty: 'MEDIUM',
    autoFix: false,
    description: 'Conflicting rules across agents (always vs never)',
    check: (data) => {
      const { rule1, rule2, file1, file2 } = data;
      if (!rule1 || !rule2) return null;

      return {
        issue: `Contradictory rules: "${rule1.substring(0, 40)}..." vs "${rule2.substring(0, 40)}..."`,
        fix: `Resolve conflict between ${file1} and ${file2}`
      };
    }
  },

  /**
   * Prompt not referenced by any workflow or skill
   */
  orphaned_prompt: {
    id: 'orphaned_prompt',
    category: 'consistency',
    certainty: 'MEDIUM',
    autoFix: false,
    description: 'Agent/prompt not referenced anywhere',
    check: (data) => {
      const { promptFile, referencedBy } = data;
      if (!promptFile) return null;

      if (!referencedBy || referencedBy.length === 0) {
        return {
          issue: `Orphaned prompt: ${promptFile} is not referenced by any workflow or skill`,
          fix: `Add reference to ${promptFile} or remove if unused`
        };
      }
      return null;
    }
  },

  /**
   * Skill allowed-tools differs from what prompt uses
   */
  skill_tool_mismatch: {
    id: 'skill_tool_mismatch',
    category: 'skill-alignment',
    certainty: 'MEDIUM',
    autoFix: false,
    description: 'Skill allowed-tools differs from prompt tool usage',
    check: (data) => {
      const { skillName, skillAllowedTools, promptUsedTools } = data;
      if (!skillAllowedTools || !promptUsedTools) return null;

      // Normalize skill tools
      const normalizedSkill = skillAllowedTools.map(t => t.split('(')[0].trim());

      const mismatches = promptUsedTools.filter(tool =>
        !normalizedSkill.includes(tool) &&
        !normalizedSkill.includes('*')
      );

      if (mismatches.length > 0) {
        return {
          issue: `Skill "${skillName}" prompt uses ${mismatches.join(', ')} not in allowed-tools`,
          fix: `Add ${mismatches.join(', ')} to skill allowed-tools or update prompt`
        };
      }
      return null;
    }
  },

  /**
   * Skill description does not match actual behavior
   */
  skill_description_mismatch: {
    id: 'skill_description_mismatch',
    category: 'skill-alignment',
    certainty: 'MEDIUM',
    autoFix: false,
    description: 'Skill description mentions capabilities not found in body',
    check: (data) => {
      const { skillName, description, bodyCapabilities, descriptionCapabilities } = data;
      if (!description || !bodyCapabilities) return null;

      const missingInBody = descriptionCapabilities.filter(cap =>
        !bodyCapabilities.some(bc => bc.toLowerCase().includes(cap.toLowerCase()))
      );

      if (missingInBody.length > 0) {
        return {
          issue: `Skill "${skillName}" description mentions "${missingInBody[0]}" not found in body`,
          fix: `Update description to match actual capabilities or add missing functionality`
        };
      }
      return null;
    }
  }
};

/**
 * Get all cross-file patterns
 * @returns {Object} All patterns
 */
function getAllPatterns() {
  return crossFilePatterns;
}

/**
 * Get patterns by category
 * @param {string} category - tool-consistency, workflow, consistency, skill-alignment
 * @returns {Object} Filtered patterns
 */
function getPatternsByCategory(category) {
  const result = {};
  for (const [name, pattern] of Object.entries(crossFilePatterns)) {
    if (pattern.category === category) {
      result[name] = pattern;
    }
  }
  return result;
}

/**
 * Get patterns by certainty
 * @param {string} certainty - HIGH, MEDIUM, LOW
 * @returns {Object} Filtered patterns
 */
function getPatternsByCertainty(certainty) {
  const result = {};
  for (const [name, pattern] of Object.entries(crossFilePatterns)) {
    if (pattern.certainty === certainty) {
      result[name] = pattern;
    }
  }
  return result;
}

module.exports = {
  PLATFORM_TOOLS,
  loadKnownTools,
  crossFilePatterns,
  getAllPatterns,
  getPatternsByCategory,
  getPatternsByCertainty
};
