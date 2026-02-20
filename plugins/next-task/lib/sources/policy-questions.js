/**
 * Policy Questions Builder
 * Builds AskUserQuestion-ready structure with cache awareness
 *
 * @module lib/sources/policy-questions
 */

const sourceCache = require('./source-cache');
const customHandler = require('./custom-handler');

/**
 * Source label mapping for proper casing
 */
const SOURCE_LABELS = {
  github: 'GitHub',
  'gh-projects': 'GitHub Projects',
  gitlab: 'GitLab',
  local: 'Local',
  custom: 'Custom',
  other: 'Other'
};

/**
 * Get policy questions with cache-aware options
 * Call this once - returns full question structure ready for AskUserQuestion
 *
 * @returns {Object} { questions: [...], cachedPreference: {...}|null }
 */
function getPolicyQuestions() {
  const cached = sourceCache.getPreference();

  // Build source options
  const sourceOptions = [];

  // If cached, add as first option
  // NOTE: OpenCode enforces 30-char max on labels
  if (cached) {
    const cachedLabel = cached.source === 'custom'
      ? `${cached.tool} (${cached.type})`
      : SOURCE_LABELS[cached.source] || (cached.source.charAt(0).toUpperCase() + cached.source.slice(1));

    // Truncate to fit within 30 chars: "X (last used)" where X can be max 17 chars
    const maxBaseLen = 30 - ' (last used)'.length; // 18 chars for base
    const truncatedLabel = cachedLabel.length > maxBaseLen
      ? cachedLabel.substring(0, maxBaseLen - 1) + '…'
      : cachedLabel;

    sourceOptions.push({
      label: `${truncatedLabel} (last used)`,
      description: `Use your previous choice: ${cachedLabel}`
    });
  }

  // Standard options
  sourceOptions.push(
    { label: 'GitHub Issues', description: 'Use gh CLI to list issues' },
    { label: 'GitHub Projects', description: 'Issues from a GitHub Project board' },
    { label: 'GitLab Issues', description: 'Use glab CLI to list issues' },
    { label: 'Local tasks.md', description: 'Read from PLAN.md, tasks.md, or TODO.md' },
    { label: 'Custom', description: 'Specify your tool: CLI, MCP, Skill, or file path' },
    { label: 'Other', description: 'Describe your source - agent figures it out' }
  );

  return {
    questions: [
      {
        header: 'Source',
        question: 'Where should I look for tasks?',
        options: sourceOptions,
        multiSelect: false
      },
      {
        header: 'Priority',
        question: 'What type of tasks to prioritize?',
        options: [
          { label: 'All', description: 'Consider all tasks, pick by score' },
          { label: 'Bugs', description: 'Focus on bug fixes' },
          { label: 'Security', description: 'Security issues first' },
          { label: 'Features', description: 'New feature development' }
        ],
        multiSelect: false
      },
      {
        header: 'Stop Point',
        question: 'How far should I take this task?',
        options: [
          { label: 'Merged', description: 'Until PR is merged to main' },
          { label: 'PR Created', description: 'Stop after creating PR' },
          { label: 'Implemented', description: 'Stop after local implementation' },
          { label: 'Deployed', description: 'Deploy to staging' },
          { label: 'Production', description: 'Full production deployment' }
        ],
        multiSelect: false
      }
    ],
    cachedPreference: cached
  };
}

/**
 * Get custom source follow-up questions
 * Call after user selects "Custom"
 *
 * @returns {Object} Question structure for custom type selection
 */
function getCustomTypeQuestions() {
  return {
    questions: [customHandler.getCustomTypeQuestion()]
  };
}

/**
 * Get custom name question based on type
 * @param {string} type - cli, mcp, skill, or file
 * @returns {Object} Question structure for tool/path name
 */
function getCustomNameQuestion(type) {
  const q = customHandler.getCustomNameQuestion(type);
  return {
    questions: [{
      header: q.header,
      question: q.question,
      options: [], // Free text input via "Other"
      multiSelect: false
    }]
  };
}

/**
 * Parse policy responses and build policy object
 * Also handles caching
 *
 * @param {Object} responses - User's answers
 * @param {string} responses.source - Source selection
 * @param {string} responses.priority - Priority selection
 * @param {string} responses.stopPoint - Stop point selection
 * @param {Object} [responses.custom] - Custom source details (if applicable)
 * @returns {Object} Policy object ready for workflow state
 */
function parseAndCachePolicy(responses) {
  const policy = {
    taskSource: mapSource(responses.source, responses.custom),
    priorityFilter: mapPriority(responses.priority),
    stoppingPoint: mapStopPoint(responses.stopPoint)
  };

  // Merge gh-projects follow-up data (projectNumber + owner)
  if (policy.taskSource.source === 'gh-projects' && responses.project) {
    const num = Number(responses.project.number);
    if (!Number.isInteger(num) || num < 1) {
      throw new Error(`Invalid project number: "${responses.project.number}" (must be a positive integer)`);
    }
    const owner = String(responses.project.owner || '').trim();
    if (!owner || !/^[@a-zA-Z0-9_-]+$/.test(owner)) {
      throw new Error(`Invalid project owner: "${responses.project.owner}" (use @me or an org/user name)`);
    }
    policy.taskSource.projectNumber = num;
    policy.taskSource.owner = owner;
  }

  // Cache source preference (unless "other" which is ad-hoc)
  if (policy.taskSource.source !== 'other') {
    sourceCache.savePreference(policy.taskSource);
  }

  return policy;
}

/**
 * Map source selection to policy value
 */
function mapSource(selection, customDetails) {
  // Check if user selected cached option
  if (selection.includes('(last used)')) {
    return sourceCache.getPreference();
  }

  const sourceMap = {
    'GitHub Issues': { source: 'github' },
    'GitHub Projects': { source: 'gh-projects' },
    'GitLab Issues': { source: 'gitlab' },
    'Local tasks.md': { source: 'local' },
    'Custom': null, // Handled separately
    'Other': null   // Handled separately
  };

  if (selection === 'Custom' && customDetails) {
    // Normalize type label to internal value (e.g., "CLI Tool" -> "cli")
    const normalizedType = customHandler.mapTypeSelection(customDetails.type);
    const config = customHandler.buildCustomConfig(normalizedType, customDetails.name);
    return config;
  }

  if (selection === 'Other') {
    return { source: 'other', description: customDetails?.description || '' };
  }

  return sourceMap[selection] || { source: 'github' };
}

/**
 * Map priority selection to policy value
 */
function mapPriority(selection) {
  const map = {
    'All': 'all',
    'Bugs': 'bugs',
    'Security': 'security',
    'Features': 'features'
  };
  return map[selection] || 'all';
}

/**
 * Map stop point selection to policy value
 */
function mapStopPoint(selection) {
  const map = {
    'Merged': 'merged',
    'PR Created': 'pr-created',
    'Implemented': 'implemented',
    'Deployed': 'deployed',
    'Production': 'production'
  };
  return map[selection] || 'merged';
}

/**
 * Check if user selected cached preference
 * @param {string} selection - User's source selection
 * @returns {boolean}
 */
function isUsingCached(selection) {
  return selection.includes('(last used)');
}

/**
 * Check if custom follow-up is needed
 * @param {string} selection - User's source selection
 * @returns {boolean}
 */
function needsCustomFollowUp(selection) {
  return selection === 'Custom';
}

/**
 * Check if "other" description is needed
 * @param {string} selection - User's source selection
 * @returns {boolean}
 */
function needsOtherDescription(selection) {
  return selection === 'Other';
}

/**
 * Check if GitHub Projects follow-up is needed
 * @param {string} selection - User's source selection
 * @returns {boolean}
 */
function needsProjectFollowUp(selection) {
  return selection === 'GitHub Projects';
}

/**
 * Get GitHub Projects follow-up questions
 * Returns 2 questions: project number and owner
 *
 * @returns {Object} Question structure for project details
 */
function getProjectQuestions() {
  return {
    questions: [
      {
        header: 'Project Number',
        question: 'What is the GitHub Project number?',
        options: [],
        multiSelect: false,
        hint: 'e.g. 1, 5, 42 (from the project URL)'
      },
      {
        header: 'Project Owner',
        question: 'Who owns this project?',
        options: [],
        multiSelect: false,
        hint: '@me, my-org, or a GitHub username'
      }
    ]
  };
}

module.exports = {
  getPolicyQuestions,
  getCustomTypeQuestions,
  getCustomNameQuestion,
  parseAndCachePolicy,
  isUsingCached,
  needsCustomFollowUp,
  needsOtherDescription,
  needsProjectFollowUp,
  getProjectQuestions
};
