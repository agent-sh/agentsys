/**
 * Simplified workflow state management
 *
 * Two files:
 * - Main project: .claude/tasks.json (tracks active worktree/task)
 * - Worktree: .claude/flow.json (tracks workflow progress)
 */

const fs = require('fs');
const path = require('path');

// File paths
const CLAUDE_DIR = '.claude';
const TASKS_FILE = 'tasks.json';
const FLOW_FILE = 'flow.json';

// Valid phases for the workflow
const PHASES = [
  'policy-selection',
  'task-discovery',
  'worktree-setup',
  'exploration',
  'planning',
  'user-approval',
  'implementation',
  'review-loop',
  'delivery-validation',
  'shipping',
  'complete'
];

/**
 * Ensure .claude directory exists
 */
function ensureClaudeDir(basePath) {
  const claudeDir = path.join(basePath, CLAUDE_DIR);
  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }
  return claudeDir;
}

// =============================================================================
// TASKS.JSON - Main project directory
// =============================================================================

/**
 * Get path to tasks.json
 */
function getTasksPath(projectPath = process.cwd()) {
  return path.join(projectPath, CLAUDE_DIR, TASKS_FILE);
}

/**
 * Read tasks.json from main project
 */
function readTasks(projectPath = process.cwd()) {
  const tasksPath = getTasksPath(projectPath);
  if (!fs.existsSync(tasksPath)) {
    return { active: null };
  }
  try {
    return JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
  } catch {
    return { active: null };
  }
}

/**
 * Write tasks.json to main project
 */
function writeTasks(tasks, projectPath = process.cwd()) {
  ensureClaudeDir(projectPath);
  const tasksPath = getTasksPath(projectPath);
  fs.writeFileSync(tasksPath, JSON.stringify(tasks, null, 2), 'utf8');
  return true;
}

/**
 * Set active task in main project
 */
function setActiveTask(task, projectPath = process.cwd()) {
  const tasks = readTasks(projectPath);
  tasks.active = {
    ...task,
    startedAt: new Date().toISOString()
  };
  return writeTasks(tasks, projectPath);
}

/**
 * Clear active task
 */
function clearActiveTask(projectPath = process.cwd()) {
  const tasks = readTasks(projectPath);
  tasks.active = null;
  return writeTasks(tasks, projectPath);
}

/**
 * Check if there's an active task
 */
function hasActiveTask(projectPath = process.cwd()) {
  const tasks = readTasks(projectPath);
  return tasks.active !== null;
}

// =============================================================================
// FLOW.JSON - Worktree directory
// =============================================================================

/**
 * Get path to flow.json
 */
function getFlowPath(worktreePath = process.cwd()) {
  return path.join(worktreePath, CLAUDE_DIR, FLOW_FILE);
}

/**
 * Read flow.json from worktree
 */
function readFlow(worktreePath = process.cwd()) {
  const flowPath = getFlowPath(worktreePath);
  if (!fs.existsSync(flowPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(flowPath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Write flow.json to worktree
 */
function writeFlow(flow, worktreePath = process.cwd()) {
  ensureClaudeDir(worktreePath);
  flow.lastUpdate = new Date().toISOString();
  const flowPath = getFlowPath(worktreePath);
  fs.writeFileSync(flowPath, JSON.stringify(flow, null, 2), 'utf8');
  return true;
}

/**
 * Update flow.json with partial updates
 */
function updateFlow(updates, worktreePath = process.cwd()) {
  const flow = readFlow(worktreePath) || {};

  // Shallow merge for top-level, deep merge for nested objects
  for (const [key, value] of Object.entries(updates)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && flow[key]) {
      flow[key] = { ...flow[key], ...value };
    } else {
      flow[key] = value;
    }
  }

  return writeFlow(flow, worktreePath);
}

/**
 * Create initial flow for a new task
 */
function createFlow(task, policy, worktreePath = process.cwd()) {
  const flow = {
    task: {
      id: task.id,
      title: task.title,
      source: task.source,
      url: task.url || null
    },
    policy: {
      stoppingPoint: policy.stoppingPoint || 'merged'
    },
    phase: 'policy-selection',
    status: 'in_progress',
    lastUpdate: new Date().toISOString(),
    userNotes: '',
    git: {
      branch: null,
      baseBranch: 'main'
    },
    pr: null,
    exploration: null,
    plan: null
  };

  writeFlow(flow, worktreePath);
  return flow;
}

/**
 * Delete flow.json
 */
function deleteFlow(worktreePath = process.cwd()) {
  const flowPath = getFlowPath(worktreePath);
  if (fs.existsSync(flowPath)) {
    fs.unlinkSync(flowPath);
    return true;
  }
  return false;
}

// =============================================================================
// PHASE MANAGEMENT
// =============================================================================

/**
 * Check if phase is valid
 */
function isValidPhase(phase) {
  return PHASES.includes(phase);
}

/**
 * Set current phase
 */
function setPhase(phase, worktreePath = process.cwd()) {
  if (!isValidPhase(phase)) {
    throw new Error(`Invalid phase: ${phase}`);
  }
  return updateFlow({ phase, status: 'in_progress' }, worktreePath);
}

/**
 * Complete current phase and move to next
 */
function completePhase(result = null, worktreePath = process.cwd()) {
  const flow = readFlow(worktreePath);
  if (!flow) return null;

  const currentIndex = PHASES.indexOf(flow.phase);
  const nextPhase = PHASES[currentIndex + 1] || 'complete';

  // Store result in appropriate field
  if (result) {
    const resultField = getResultField(flow.phase);
    if (resultField) {
      flow[resultField] = result;
    }
  }

  flow.phase = nextPhase;
  flow.status = nextPhase === 'complete' ? 'completed' : 'in_progress';

  writeFlow(flow, worktreePath);
  return flow;
}

/**
 * Map phase to result field
 */
function getResultField(phase) {
  const mapping = {
    'exploration': 'exploration',
    'planning': 'plan',
    'review-loop': 'reviewResult'
  };
  return mapping[phase] || null;
}

/**
 * Mark workflow as failed
 */
function failWorkflow(error, worktreePath = process.cwd()) {
  return updateFlow({
    status: 'failed',
    error: error?.message || String(error)
  }, worktreePath);
}

/**
 * Mark workflow as complete
 */
function completeWorkflow(worktreePath = process.cwd()) {
  return updateFlow({
    phase: 'complete',
    status: 'completed'
  }, worktreePath);
}

/**
 * Abort workflow
 */
function abortWorkflow(reason, worktreePath = process.cwd()) {
  return updateFlow({
    status: 'aborted',
    abortReason: reason
  }, worktreePath);
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Get workflow summary for display
 */
function getFlowSummary(worktreePath = process.cwd()) {
  const flow = readFlow(worktreePath);
  if (!flow) return null;

  return {
    task: flow.task?.title || 'Unknown',
    taskId: flow.task?.id,
    phase: flow.phase,
    status: flow.status,
    lastUpdate: flow.lastUpdate,
    pr: flow.pr?.number ? `#${flow.pr.number}` : null
  };
}

/**
 * Check if workflow can be resumed
 */
function canResume(worktreePath = process.cwd()) {
  const flow = readFlow(worktreePath);
  if (!flow) return false;
  return flow.status === 'in_progress' && flow.phase !== 'complete';
}

// =============================================================================
// BACKWARDS COMPATIBILITY ALIASES
// =============================================================================

// These maintain compatibility with existing agent code
const readState = readFlow;
const writeState = writeFlow;
const updateState = updateFlow;
const createState = (type, policy) => createFlow({ id: 'manual', title: 'Manual task', source: 'manual' }, policy);
const deleteState = deleteFlow;
const hasActiveWorkflow = hasActiveTask;
const getWorkflowSummary = getFlowSummary;

module.exports = {
  // Constants
  PHASES,

  // Tasks (main project)
  getTasksPath,
  readTasks,
  writeTasks,
  setActiveTask,
  clearActiveTask,
  hasActiveTask,

  // Flow (worktree)
  getFlowPath,
  readFlow,
  writeFlow,
  updateFlow,
  createFlow,
  deleteFlow,

  // Phase management
  isValidPhase,
  setPhase,
  completePhase,
  failWorkflow,
  completeWorkflow,
  abortWorkflow,

  // Convenience
  getFlowSummary,
  canResume,

  // Backwards compatibility
  readState,
  writeState,
  updateState,
  createState,
  deleteState,
  hasActiveWorkflow,
  getWorkflowSummary
};
