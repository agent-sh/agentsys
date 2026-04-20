/**
 * Simplified workflow state management
 *
 * Two files:
 * - Main project: {stateDir}/tasks.json (tracks active worktree/task)
 * - Worktree: {stateDir}/flow.json (tracks workflow progress)
 *
 * State directory is platform-aware:
 * - Claude Code: .claude/
 * - OpenCode: .opencode/
 * - Codex CLI: .codex/
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getStateDir } = require('../platform/state-dir');
const { writeJsonAtomic } = require('../utils/atomic-write');
const { isPlainObject, updatesApplied, sleepForRetry } = require('../utils/state-helpers');

// File paths
const TASKS_FILE = 'tasks.json';
const FLOW_FILE = 'flow.json';
/**
 * Validate and resolve path to prevent path traversal attacks
 * @param {string} basePath - Base directory path
 * @returns {string} Validated absolute path
 * @throws {Error} If path is invalid
 */
function validatePath(basePath) {
  if (typeof basePath !== 'string' || basePath.length === 0) {
    throw new Error('Path must be a non-empty string');
  }
  const resolved = path.resolve(basePath);
  if (resolved.includes('\0')) {
    throw new Error('Path contains invalid null byte');
  }
  return resolved;
}

/**
 * Validate that target path is within base directory
 * @param {string} targetPath - Target file path
 * @param {string} basePath - Base directory
 * @throws {Error} If path traversal detected
 */
function validatePathWithinBase(targetPath, basePath) {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedBase = path.resolve(basePath);
  if (!resolvedTarget.startsWith(resolvedBase + path.sep) && resolvedTarget !== resolvedBase) {
    throw new Error('Path traversal detected');
  }
}

/**
 * Generate a unique workflow ID
 * @returns {string} Workflow ID
 */
function generateWorkflowId() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = now.toISOString().slice(11, 19).replace(/:/g, '');
  const random = crypto.randomBytes(4).toString('hex');
  return `workflow-${date}-${time}-${random}`;
}

// Map phase name to the result field stored on flow.json
const RESULT_FIELD_MAP = {
  'exploration': 'exploration',
  'planning': 'plan',
  'pre-review-gates': 'preReviewResult',
  'review-loop': 'reviewResult',
  'delivery-validation': 'deliveryResult',
  'docs-update': 'docsResult'
};

// Valid phases for the workflow
const PHASES = [
  'policy-selection',
  'task-discovery',
  'worktree-setup',
  'exploration',
  'planning',
  'user-approval',
  'implementation',
  'pre-review-gates',
  'review-loop',
  'delivery-validation',
  'docs-update',
  'shipping',
  'complete'
];

/**
 * Ensure state directory exists (platform-aware)
 */
function ensureStateDir(basePath) {
  const stateDir = path.join(basePath, getStateDir(basePath));
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }
  return stateDir;
}

// =============================================================================
// TASKS.JSON - Main project directory
// =============================================================================

/**
 * Get path to tasks.json with validation
 */
function getTasksPath(projectPath = process.cwd()) {
  const validatedBase = validatePath(projectPath);
  const tasksPath = path.join(validatedBase, getStateDir(projectPath), TASKS_FILE);
  validatePathWithinBase(tasksPath, validatedBase);
  return tasksPath;
}

/**
 * Read tasks.json from main project.
 *
 * Unified schema (v2):
 *   { active: null|Object, tasks: [], _version: number }
 *
 * - active: single active workflow entry (set by createFlow / cleared by completeWorkflow)
 * - tasks:  worktree claim registry (set by worktree-manager / cleared by ship or --abort)
 * - _version: monotonic counter for optimistic locking (managed by writeTasks)
 * - _writerId: per-write unique token used by updateTasks to detect concurrent wins
 *
 * Legacy formats are normalized on read — no migration script needed.
 * Throws on corruption so callers can decide whether to abort or recover,
 * rather than silently overwriting potentially recoverable data.
 *
 * @param {string} projectPath
 * @returns {{ active: null|Object, tasks: Array, _version: number, _writerId?: string }}
 * @throws {Error} If tasks.json exists but cannot be parsed
 */
function readTasks(projectPath = process.cwd()) {
  const tasksPath = getTasksPath(projectPath);
  if (!fs.existsSync(tasksPath)) {
    return { active: null, tasks: [], _version: 0 };
  }
  const raw = fs.readFileSync(tasksPath, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(`[CRITICAL] Corrupted tasks.json at ${tasksPath}: ${e.message}. File must be repaired or deleted manually before writes are allowed.`);
  }
  // Normalize: ensure every field exists (handles legacy { active } and legacy { version, tasks[] })
  return {
    active: Object.prototype.hasOwnProperty.call(data, 'active') ? data.active : null,
    tasks: Array.isArray(data.tasks) ? data.tasks : [],
    _version: typeof data._version === 'number' ? data._version : 0,
    _writerId: typeof data._writerId === 'string' ? data._writerId : undefined
  };
}

/**
 * Write tasks.json atomically.
 * Increments _version and stamps a unique _writerId per write.
 *
 * Both fields are used by updateTasks to verify it was the winning writer:
 * if two processes both read _version N, both write _version N+1 (last
 * renameSync wins), the loser re-reads and finds a _writerId that does not
 * match its own — it knows it lost and retries.
 *
 * @returns {string} The _writerId stamped into this write
 */
function writeTasks(tasks, projectPath = process.cwd()) {
  ensureStateDir(projectPath);
  const copy = structuredClone(tasks);
  copy._version = (copy._version || 0) + 1;
  copy._writerId = crypto.randomBytes(8).toString('hex');
  const tasksPath = getTasksPath(projectPath);
  writeJsonAtomic(tasksPath, copy);
  return copy._writerId;
}

/**
 * Apply a mutation to tasks.json with optimistic locking.
 *
 * Uses _version + _writerId to detect wins in concurrent-writer races:
 *   1. Read current state, snapshot _version
 *   2. Apply mutatorFn(clone) → new state; skip write if state unchanged
 *   3. Stamp a unique writerId, write atomically (increments _version)
 *   4. Re-read: if _version === initialVersion + 1 AND _writerId matches → we won
 *   5. Otherwise another writer raced us → back off with jitter, retry
 *
 * @param {function(Object): Object} mutatorFn - Pure function that receives a
 *   deep clone of current tasks state and returns the desired new state.
 *   Must not have side effects; may be called multiple times on retry.
 * @param {string} projectPath
 * @returns {boolean} true on success, false after MAX_RETRIES exhausted or on corruption
 */
function updateTasks(mutatorFn, projectPath = process.cwd()) {
  const MAX_RETRIES = 5;

  let current;
  try {
    current = readTasks(projectPath);
  } catch (e) {
    console.error(`[ERROR] updateTasks: cannot read tasks.json — ${e.message}`);
    return false;
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const initialVersion = current._version || 0;

    let updated;
    try {
      updated = mutatorFn(structuredClone(current));
    } catch (e) {
      console.error(`[ERROR] updateTasks: mutatorFn threw on attempt ${attempt + 1}: ${e.message}`);
      return false;
    }

    // Skip write if mutatorFn made no changes — avoids spurious version bumps
    if (JSON.stringify(updated) === JSON.stringify(current)) {
      return true;
    }

    // Carry forward the pre-write version so writeTasks increments it by exactly 1
    updated._version = initialVersion;

    const writerId = writeTasks(updated, projectPath);

    // Verify we won: version must be exactly initialVersion + 1 AND writerId must match ours.
    // If another process also wrote _version: initialVersion + 1, only one writerId survives.
    let afterWrite;
    try {
      afterWrite = readTasks(projectPath);
    } catch (e) {
      console.error(`[ERROR] updateTasks: tasks.json corrupted after write on attempt ${attempt + 1}: ${e.message}`);
      return false;
    }

    if (afterWrite._version === initialVersion + 1 && afterWrite._writerId === writerId) {
      return true;
    }

    // Lost the race — retry from the current on-disk state
    if (attempt < MAX_RETRIES - 1) {
      const delay = Math.floor(Math.random() * 50) + 10;
      sleepForRetry(delay);
      try {
        current = readTasks(projectPath);
      } catch (e) {
        console.error(`[ERROR] updateTasks: tasks.json corrupted during retry ${attempt + 1}: ${e.message}`);
        return false;
      }
    }
  }

  const tasksPath = getTasksPath(projectPath);
  let lastVersion = '(unreadable)';
  try { lastVersion = readTasks(projectPath)._version; } catch {}

  // Final fallback: if a concurrent writer happened to apply the exact same
  // mutation (idempotent operations like releaseTask on an already-absent entry),
  // treat the outcome as a success rather than reporting a spurious failure.
  let latest;
  try { latest = readTasks(projectPath); } catch {}
  if (latest) {
    // Re-run the mutator on what's on disk; if the result is identical to
    // what's already there, our desired state is already achieved.
    try {
      const wouldBe = mutatorFn(structuredClone(latest));
      // Normalize _version/_writerId before comparing content
      wouldBe._version = latest._version;
      wouldBe._writerId = latest._writerId;
      if (JSON.stringify(wouldBe) === JSON.stringify(latest)) {
        return true;
      }
    } catch {}
  }

  console.error(
    `[ERROR] updateTasks: all ${MAX_RETRIES} attempts failed due to concurrent writers on ${tasksPath}. ` +
    `Another agent process is modifying the registry simultaneously. ` +
    `Last known _version: ${lastVersion}. ` +
    `Suggested recovery: wait for the competing process to finish, then retry the operation.`
  );
  return false;
}

/**
 * Set active task in main project (uses optimistic locking)
 */
function setActiveTask(task, projectPath = process.cwd()) {
  return updateTasks(tasks => {
    tasks.active = { ...task, startedAt: new Date().toISOString() };
    return tasks;
  }, projectPath);
}

/**
 * Clear active task (uses optimistic locking)
 */
function clearActiveTask(projectPath = process.cwd()) {
  return updateTasks(tasks => {
    tasks.active = null;
    return tasks;
  }, projectPath);
}

/**
 * Claim a task in the registry (uses optimistic locking).
 * Used by worktree-manager; replaces the raw fs.writeFileSync inline in agent prompts.
 *
 * @param {Object} entry - { id, source, title, branch, worktreePath, claimedBy }
 * @param {string} projectPath
 */
function claimTask(entry, projectPath = process.cwd()) {
  if (!entry || !entry.id) {
    console.error('[ERROR] claimTask: entry.id is required');
    return false;
  }
  return updateTasks(tasks => {
    const idx = tasks.tasks.findIndex(t => t.id === entry.id);
    const record = {
      ...entry,
      status: 'claimed',
      claimedAt: entry.claimedAt || new Date().toISOString(),
      lastActivityAt: new Date().toISOString()
    };
    if (idx >= 0) {
      tasks.tasks[idx] = record;
    } else {
      tasks.tasks.push(record);
    }
    return tasks;
  }, projectPath);
}

/**
 * Release a claimed task from the registry (uses optimistic locking).
 * Used by ship and --abort; replaces the raw fs.writeFileSync inline cleanup.
 *
 * @param {string} taskId
 * @param {string} projectPath
 */
function releaseTask(taskId, projectPath = process.cwd()) {
  if (!taskId) {
    console.error('[ERROR] releaseTask: taskId is required');
    return false;
  }
  return updateTasks(tasks => {
    const before = tasks.tasks.length;
    tasks.tasks = tasks.tasks.filter(t => t.id !== taskId);
    if (tasks.tasks.length === before) {
      // Not found — that's fine, idempotent
      console.error(`[WARN] releaseTask: task ${taskId} was not found in tasks.json registry. It may have already been released or never claimed.`);
    }
    return tasks;
  }, projectPath);
}

/**
 * Check if there's an active task.
 * Uses != null to catch both null and undefined (legacy format safety).
 */
function hasActiveTask(projectPath = process.cwd()) {
  const tasks = readTasks(projectPath);
  return tasks.active != null;
}

// =============================================================================
// FLOW.JSON - Worktree directory
// =============================================================================

/**
 * Get path to flow.json with validation
 */
function getFlowPath(worktreePath = process.cwd()) {
  const validatedBase = validatePath(worktreePath);
  const flowPath = path.join(validatedBase, getStateDir(worktreePath), FLOW_FILE);
  validatePathWithinBase(flowPath, validatedBase);
  return flowPath;
}

/**
 * Read flow.json from worktree
 * Returns null if file doesn't exist or is corrupted
 * Logs critical error on corruption to prevent silent data loss
 */
function readFlow(worktreePath = process.cwd()) {
  const flowPath = getFlowPath(worktreePath);
  if (!fs.existsSync(flowPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(flowPath, 'utf8'));
  } catch (e) {
    console.error(`[CRITICAL] Corrupted flow.json at ${flowPath}: ${e.message}`);
    return null;
  }
}

/**
 * Write flow.json to worktree
 * Creates a copy to avoid mutating the original object
 * Increments version for optimistic locking
 */
function writeFlow(flow, worktreePath = process.cwd()) {
  ensureStateDir(worktreePath);
  // Clone to avoid mutating the original object
  const flowCopy = structuredClone(flow);
  flowCopy.lastUpdate = new Date().toISOString();
  // Increment version for optimistic locking (initialize if missing)
  flowCopy._version = (flowCopy._version || 0) + 1;
  const flowPath = getFlowPath(worktreePath);
  writeJsonAtomic(flowPath, flowCopy);
  return true;
}

/**
 * Update flow.json with partial updates
 * Handles null values correctly (null overwrites existing values)
 * Deep merges nested objects when both exist
 * Uses optimistic locking with version check and retry
 */
function updateFlow(updates, worktreePath = process.cwd()) {
  const MAX_RETRIES = 5;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const flow = readFlow(worktreePath) || {};
    const initialVersion = flow._version || 0;

    for (const [key, value] of Object.entries(updates)) {
      // Skip internal version field from updates
      if (key === '_version') continue;

      // Null explicitly overwrites
      if (value === null) {
        flow[key] = null;
      }
      // Deep merge if both source and target are non-null objects
      else if (isPlainObject(value) && isPlainObject(flow[key])) {
        flow[key] = { ...flow[key], ...value };
      }
      // Otherwise direct assignment
      else {
        flow[key] = value;
      }
    }

    // Preserve version for write (writeFlow will increment it)
    flow._version = initialVersion;

    // Write and verify version wasn't changed by another process
    writeFlow(flow, worktreePath);

    // Re-read to verify our write succeeded
    const afterWrite = readFlow(worktreePath);
    if (afterWrite && afterWrite._version >= initialVersion + 1 && updatesApplied(afterWrite, updates)) {
      return true; // Success
    }

    // Version conflict or overwrite - retry after brief delay
    if (attempt < MAX_RETRIES - 1) {
      const delay = Math.floor(Math.random() * 50) + 10;
      sleepForRetry(delay);
    }
  }

  // All retries exhausted. One final read can detect if another writer
  // applied the same updates while we were retrying.
  const latest = readFlow(worktreePath);
  if (latest && updatesApplied(latest, updates)) {
    return true;
  }

  console.error('[ERROR] updateFlow: failed to apply updates after max retries');
  return false;
}

/**
 * Create initial flow for a new task
 * Also registers the task as active in the main project's tasks.json
 * @param {Object} task - Task object with id, title, source, url
 * @param {Object} policy - Policy object with stoppingPoint
 * @param {string} worktreePath - Path to worktree
 * @param {string} projectPath - Path to main project (for tasks.json registration)
 */
function createFlow(task, policy, worktreePath = process.cwd(), projectPath = null) {
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
    plan: null,
    // Store projectPath so completeWorkflow knows where to clear the task
    projectPath: projectPath
  };

  writeFlow(flow, worktreePath);

  // Register task as active in main project
  if (projectPath) {
    setActiveTask({
      taskId: task.id,
      title: task.title,
      worktree: worktreePath,
      branch: flow.git.branch
    }, projectPath);
  }

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
 * Start a phase (alias for setPhase, for backwards compatibility)
 */
function startPhase(phase, worktreePath = process.cwd()) {
  return setPhase(phase, worktreePath);
}

/**
 * Fail the current phase
 */
function failPhase(reason, context = {}, worktreePath = process.cwd()) {
  const flow = readFlow(worktreePath);
  if (!flow) return null;

  return updateFlow({
    status: 'failed',
    error: reason,
    failContext: context
  }, worktreePath);
}

/**
 * Skip to a specific phase
 */
function skipToPhase(phase, reason = 'manual skip', worktreePath = process.cwd()) {
  if (!isValidPhase(phase)) {
    throw new Error(`Invalid phase: ${phase}`);
  }
  return updateFlow({
    phase,
    status: 'in_progress',
    skipReason: reason
  }, worktreePath);
}

/**
 * Complete current phase and move to next
 * Uses updateFlow pattern to avoid direct mutation issues
 */
function completePhase(result = null, worktreePath = process.cwd()) {
  const flow = readFlow(worktreePath);
  if (!flow) return null;

  const currentIndex = PHASES.indexOf(flow.phase);
  if (currentIndex === -1) {
    console.warn(`[WARN] completePhase: unknown phase "${flow.phase}" in flow.json, cannot advance`);
    return null;
  }
  const nextPhase = PHASES[currentIndex + 1] || 'complete';

  // Build updates object
  const updates = {
    phase: nextPhase,
    status: nextPhase === 'complete' ? 'completed' : 'in_progress'
  };

  // Store result in appropriate field
  if (result !== null && result !== undefined) {
    const resultField = getResultField(flow.phase);
    if (resultField) {
      updates[resultField] = result;
    }
  }

  const updated = updateFlow(updates, worktreePath);
  return updated ? readFlow(worktreePath) : null;
}

/**
 * Map phase to result field
 */
function getResultField(phase) {
  return RESULT_FIELD_MAP[phase] || null;
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
 * Automatically clears the active task from tasks.json using stored projectPath
 * @param {string} worktreePath - Path to worktree
 */
function completeWorkflow(worktreePath = process.cwd()) {
  const flow = readFlow(worktreePath);

  const updated = updateFlow({
    phase: 'complete',
    status: 'completed',
    completedAt: new Date().toISOString()
  }, worktreePath);

  if (updated && flow && flow.projectPath) {
    clearActiveTask(flow.projectPath);
  }

  return updated;
}

/**
 * Abort workflow
 * Also clears the active task from tasks.json using stored projectPath
 */
function abortWorkflow(reason, worktreePath = process.cwd()) {
  const flow = readFlow(worktreePath);

  const updated = updateFlow({
    status: 'aborted',
    abortReason: reason,
    abortedAt: new Date().toISOString()
  }, worktreePath);

  if (updated && flow && flow.projectPath) {
    clearActiveTask(flow.projectPath);
  }

  return updated;
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
  updateTasks,
  setActiveTask,
  clearActiveTask,
  claimTask,
  releaseTask,
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
  startPhase,
  completePhase,
  failPhase,
  skipToPhase,
  failWorkflow,
  completeWorkflow,
  abortWorkflow,

  // Convenience
  getFlowSummary,
  canResume,
  generateWorkflowId,

  // Backwards compatibility
  readState,
  writeState,
  updateState,
  createState,
  deleteState,
  hasActiveWorkflow,
  getWorkflowSummary
};
