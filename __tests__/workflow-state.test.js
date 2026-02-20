/**
 * Tests for simplified workflow state management
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  PHASES,
  readTasks,
  writeTasks,
  setActiveTask,
  clearActiveTask,
  hasActiveTask,
  readFlow,
  writeFlow,
  updateFlow,
  createFlow,
  deleteFlow,
  isValidPhase,
  setPhase,
  completePhase,
  failWorkflow,
  completeWorkflow,
  abortWorkflow,
  getFlowSummary,
  canResume
} = require('../lib/state/workflow-state');

describe('workflow-state', () => {
  let testDir;

  beforeEach(() => {
    // Create a temp directory for each test
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-test-'));
  });

  afterEach(() => {
    // Clean up
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('PHASES constant', () => {
    test('contains expected phases in order', () => {
      expect(PHASES).toContain('policy-selection');
      expect(PHASES).toContain('task-discovery');
      expect(PHASES).toContain('implementation');
      expect(PHASES).toContain('review-loop');
      expect(PHASES).toContain('complete');
      expect(PHASES.indexOf('policy-selection')).toBeLessThan(PHASES.indexOf('complete'));
    });

    test('new phases are in correct order relative to neighbors', () => {
      expect(PHASES.indexOf('implementation')).toBeLessThan(PHASES.indexOf('pre-review-gates'));
      expect(PHASES.indexOf('pre-review-gates')).toBeLessThan(PHASES.indexOf('review-loop'));
      expect(PHASES.indexOf('review-loop')).toBeLessThan(PHASES.indexOf('delivery-validation'));
      expect(PHASES.indexOf('delivery-validation')).toBeLessThan(PHASES.indexOf('docs-update'));
      expect(PHASES.indexOf('docs-update')).toBeLessThan(PHASES.indexOf('shipping'));
    });
  });

  describe('tasks.json operations', () => {
    test('readTasks returns null active when file does not exist', () => {
      const tasks = readTasks(testDir);
      expect(tasks).toEqual({ active: null });
    });

    test('writeTasks creates .claude directory and file', () => {
      const tasks = { active: { taskId: '123' } };
      writeTasks(tasks, testDir);

      const claudeDir = path.join(testDir, '.claude');
      expect(fs.existsSync(claudeDir)).toBe(true);
      expect(fs.existsSync(path.join(claudeDir, 'tasks.json'))).toBe(true);
    });

    test('setActiveTask sets active task with timestamp', () => {
      setActiveTask({ taskId: '123', title: 'Test task' }, testDir);

      const tasks = readTasks(testDir);
      expect(tasks.active.taskId).toBe('123');
      expect(tasks.active.title).toBe('Test task');
      expect(tasks.active.startedAt).toBeDefined();
    });

    test('clearActiveTask clears active task', () => {
      setActiveTask({ taskId: '123' }, testDir);
      expect(hasActiveTask(testDir)).toBe(true);

      clearActiveTask(testDir);
      expect(hasActiveTask(testDir)).toBe(false);
    });

    test('hasActiveTask returns correct boolean', () => {
      expect(hasActiveTask(testDir)).toBe(false);
      setActiveTask({ taskId: '123' }, testDir);
      expect(hasActiveTask(testDir)).toBe(true);
    });
  });

  describe('flow.json operations', () => {
    test('readFlow returns null when file does not exist', () => {
      expect(readFlow(testDir)).toBeNull();
    });

    test('writeFlow creates file and adds lastUpdate', () => {
      const flow = { phase: 'implementation', status: 'in_progress' };
      writeFlow(flow, testDir);

      const saved = readFlow(testDir);
      expect(saved.phase).toBe('implementation');
      expect(saved.lastUpdate).toBeDefined();
    });

    test('updateFlow merges updates correctly', () => {
      writeFlow({ phase: 'planning', status: 'in_progress', task: { id: '1' } }, testDir);

      updateFlow({ status: 'completed', task: { title: 'Added title' } }, testDir);

      const flow = readFlow(testDir);
      expect(flow.status).toBe('completed');
      expect(flow.phase).toBe('planning');
      expect(flow.task.id).toBe('1');
      expect(flow.task.title).toBe('Added title');
    });

    test('createFlow creates flow with defaults', () => {
      const task = { id: '123', title: 'Test', source: 'gh-issues' };
      const policy = { stoppingPoint: 'pr-created' };

      const flow = createFlow(task, policy, testDir);

      expect(flow.task.id).toBe('123');
      expect(flow.policy.stoppingPoint).toBe('pr-created');
      expect(flow.phase).toBe('policy-selection');
      expect(flow.status).toBe('in_progress');
    });

    test('deleteFlow removes flow file', () => {
      writeFlow({ phase: 'test' }, testDir);
      expect(readFlow(testDir)).not.toBeNull();

      deleteFlow(testDir);
      expect(readFlow(testDir)).toBeNull();
    });
  });

  describe('phase management', () => {
    beforeEach(() => {
      createFlow(
        { id: '1', title: 'Test', source: 'manual' },
        { stoppingPoint: 'merged' },
        testDir
      );
    });

    test('isValidPhase validates phases correctly', () => {
      expect(isValidPhase('implementation')).toBe(true);
      expect(isValidPhase('invalid-phase')).toBe(false);
    });

    test('setPhase updates phase', () => {
      setPhase('implementation', testDir);
      const flow = readFlow(testDir);
      expect(flow.phase).toBe('implementation');
      expect(flow.status).toBe('in_progress');
    });

    test('setPhase throws on invalid phase', () => {
      expect(() => setPhase('invalid', testDir)).toThrow('Invalid phase');
    });

    test('completePhase advances to next phase', () => {
      setPhase('exploration', testDir);
      completePhase({ keyFiles: ['test.js'] }, testDir);

      const flow = readFlow(testDir);
      expect(flow.phase).toBe('planning');
      expect(flow.exploration).toEqual({ keyFiles: ['test.js'] });
    });

    test('completePhase stores result in correct field', () => {
      setPhase('planning', testDir);
      completePhase({ steps: ['step1', 'step2'], approved: true }, testDir);

      const flow = readFlow(testDir);
      expect(flow.plan.steps).toEqual(['step1', 'step2']);
    });

    test('failWorkflow sets failed status', () => {
      failWorkflow(new Error('Something went wrong'), testDir);

      const flow = readFlow(testDir);
      expect(flow.status).toBe('failed');
      expect(flow.error).toBe('Something went wrong');
    });

    test('completeWorkflow sets complete status', () => {
      completeWorkflow(testDir);

      const flow = readFlow(testDir);
      expect(flow.phase).toBe('complete');
      expect(flow.status).toBe('completed');
    });

    test('abortWorkflow sets aborted status with reason', () => {
      abortWorkflow('User cancelled', testDir);

      const flow = readFlow(testDir);
      expect(flow.status).toBe('aborted');
      expect(flow.abortReason).toBe('User cancelled');
    });
  });

  describe('new phases: pre-review-gates and docs-update', () => {
    beforeEach(() => {
      createFlow(
        { id: '1', title: 'Test', source: 'manual' },
        { stoppingPoint: 'merged' },
        testDir
      );
    });

    test('PHASES contains pre-review-gates and docs-update', () => {
      expect(PHASES).toContain('pre-review-gates');
      expect(PHASES).toContain('docs-update');
    });

    test('isValidPhase accepts pre-review-gates and docs-update', () => {
      expect(isValidPhase('pre-review-gates')).toBe(true);
      expect(isValidPhase('docs-update')).toBe(true);
    });

    test('completePhase from implementation advances to pre-review-gates', () => {
      setPhase('implementation', testDir);
      completePhase(null, testDir);

      const flow = readFlow(testDir);
      expect(flow.phase).toBe('pre-review-gates');
      expect(flow.status).toBe('in_progress');
    });

    test('completePhase from pre-review-gates advances to review-loop', () => {
      setPhase('pre-review-gates', testDir);
      completePhase({ passed: true }, testDir);

      const flow = readFlow(testDir);
      expect(flow.phase).toBe('review-loop');
      expect(flow.status).toBe('in_progress');
      expect(flow.preReviewResult).toEqual({ passed: true });
    });

    test('completePhase from review-loop stores reviewResult and advances to delivery-validation', () => {
      setPhase('review-loop', testDir);
      completePhase({ approved: true, iterations: 2 }, testDir);

      const flow = readFlow(testDir);
      expect(flow.phase).toBe('delivery-validation');
      expect(flow.status).toBe('in_progress');
      expect(flow.reviewResult).toEqual({ approved: true, iterations: 2 });
    });

    test('completePhase from review-loop stores blocked result (stall-detected)', () => {
      setPhase('review-loop', testDir);
      completePhase({ approved: false, blocked: true, reason: 'stall-detected', remaining: { critical: 1 } }, testDir);

      const flow = readFlow(testDir);
      expect(flow.phase).toBe('delivery-validation');
      expect(flow.reviewResult.approved).toBe(false);
      expect(flow.reviewResult.reason).toBe('stall-detected');
    });

    test('completePhase from review-loop stores blocked result (iteration-limit)', () => {
      setPhase('review-loop', testDir);
      completePhase({ approved: false, blocked: true, reason: 'iteration-limit', remaining: { critical: 0, high: 2 } }, testDir);

      const flow = readFlow(testDir);
      expect(flow.phase).toBe('delivery-validation');
      expect(flow.reviewResult.reason).toBe('iteration-limit');
      expect(flow.reviewResult.remaining.high).toBe(2);
    });

    test('completePhase stores falsy result (result !== null fix)', () => {
      setPhase('pre-review-gates', testDir);
      completePhase({ passed: false, reason: 'lint-failure' }, testDir);

      const flow = readFlow(testDir);
      expect(flow.preReviewResult).toBeDefined();
      expect(flow.preReviewResult.passed).toBe(false);
    });

    test('completePhase from shipping advances to complete', () => {
      setPhase('shipping', testDir);
      completePhase(null, testDir);

      const flow = readFlow(testDir);
      expect(flow.phase).toBe('complete');
      expect(flow.status).toBe('completed');
    });

    test('completePhase returns null for unknown current phase', () => {
      setPhase('review-loop', testDir);
      // Manually corrupt the phase to an unknown value
      const currentFlow = readFlow(testDir);
      currentFlow.phase = 'nonexistent-phase';
      writeFlow(currentFlow, testDir);

      const result = completePhase(null, testDir);
      expect(result).toBeNull();
    });

    test('completePhase from delivery-validation advances to docs-update', () => {
      setPhase('delivery-validation', testDir);
      completePhase({ passed: true }, testDir);

      const flow = readFlow(testDir);
      expect(flow.phase).toBe('docs-update');
      expect(flow.status).toBe('in_progress');
      expect(flow.deliveryResult).toEqual({ passed: true });
    });

    test('completePhase from docs-update advances to shipping', () => {
      setPhase('docs-update', testDir);
      completePhase({ docsUpdated: true }, testDir);

      const flow = readFlow(testDir);
      expect(flow.phase).toBe('shipping');
      expect(flow.status).toBe('in_progress');
      expect(flow.docsResult).toEqual({ docsUpdated: true });
    });
  });

  describe('convenience functions', () => {
    test('getFlowSummary returns summary object', () => {
      createFlow(
        { id: '123', title: 'Test Task', source: 'gh-issues' },
        { stoppingPoint: 'merged' },
        testDir
      );
      updateFlow({ pr: { number: 456, url: 'http://...' } }, testDir);

      const summary = getFlowSummary(testDir);
      expect(summary.task).toBe('Test Task');
      expect(summary.taskId).toBe('123');
      expect(summary.phase).toBe('policy-selection');
      expect(summary.pr).toBe('#456');
    });

    test('getFlowSummary returns null when no flow', () => {
      expect(getFlowSummary(testDir)).toBeNull();
    });

    test('canResume returns true when in progress', () => {
      createFlow({ id: '1', title: 'Test', source: 'manual' }, {}, testDir);
      setPhase('implementation', testDir);

      expect(canResume(testDir)).toBe(true);
    });

    test('canResume returns false when completed', () => {
      createFlow({ id: '1', title: 'Test', source: 'manual' }, {}, testDir);
      completeWorkflow(testDir);

      expect(canResume(testDir)).toBe(false);
    });

    test('canResume returns false when no flow', () => {
      expect(canResume(testDir)).toBe(false);
    });
  });

  describe('backwards compatibility', () => {
    const {
      readState,
      writeState,
      updateState,
      deleteState,
      hasActiveWorkflow,
      getWorkflowSummary
    } = require('../lib/state/workflow-state');

    test('readState is alias for readFlow', () => {
      writeFlow({ phase: 'test' }, testDir);
      expect(readState(testDir)).toEqual(readFlow(testDir));
    });

    test('writeState is alias for writeFlow', () => {
      writeState({ phase: 'test' }, testDir);
      expect(readFlow(testDir).phase).toBe('test');
    });

    test('updateState is alias for updateFlow', () => {
      writeFlow({ phase: 'a' }, testDir);
      updateState({ phase: 'b' }, testDir);
      expect(readFlow(testDir).phase).toBe('b');
    });

    test('deleteState is alias for deleteFlow', () => {
      writeFlow({ phase: 'test' }, testDir);
      deleteState(testDir);
      expect(readFlow(testDir)).toBeNull();
    });

    test('hasActiveWorkflow is alias for hasActiveTask', () => {
      expect(hasActiveWorkflow(testDir)).toBe(false);
      setActiveTask({ id: '1' }, testDir);
      expect(hasActiveWorkflow(testDir)).toBe(true);
    });

    test('getWorkflowSummary is alias for getFlowSummary', () => {
      createFlow({ id: '1', title: 'Test', source: 'manual' }, {}, testDir);
      expect(getWorkflowSummary(testDir)).toEqual(getFlowSummary(testDir));
    });
  });

  describe('error handling', () => {
    test('readTasks handles corrupted JSON gracefully', () => {
      fs.mkdirSync(path.join(testDir, '.claude'), { recursive: true });
      fs.writeFileSync(path.join(testDir, '.claude', 'tasks.json'), 'invalid json');

      const tasks = readTasks(testDir);
      expect(tasks).toEqual({ active: null });
    });

    test('readFlow handles corrupted JSON gracefully', () => {
      fs.mkdirSync(path.join(testDir, '.claude'), { recursive: true });
      fs.writeFileSync(path.join(testDir, '.claude', 'flow.json'), 'invalid json');

      const flow = readFlow(testDir);
      expect(flow).toBeNull();
    });
  });
});
