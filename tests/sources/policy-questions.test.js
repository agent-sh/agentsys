/**
 * Policy Questions Tests
 * Tests for policy question building, parsing, and caching
 */

const policyQuestions = require('@agentsys/lib/sources/policy-questions');
const sourceCache = require('@agentsys/lib/sources/source-cache');
const customHandler = require('@agentsys/lib/sources/custom-handler');

// Mock dependencies
jest.mock('@agentsys/lib/sources/source-cache', () => ({
  getPreference: jest.fn(),
  savePreference: jest.fn()
}));

jest.mock('@agentsys/lib/sources/custom-handler', () => ({
  getCustomTypeQuestion: jest.fn(() => ({
    header: 'Source Type',
    question: 'What type of source is this?',
    options: [{ label: 'CLI Tool' }],
    multiSelect: false
  })),
  getCustomNameQuestion: jest.fn((type) => ({
    header: type === 'cli' ? 'CLI Tool' : 'Custom',
    question: `What is the ${type} name?`,
    hint: 'hint'
  })),
  mapTypeSelection: jest.fn((selection) => {
    const map = { 'CLI Tool': 'cli', 'MCP Server': 'mcp' };
    return map[selection] || 'cli';
  }),
  buildCustomConfig: jest.fn((type, name) => ({
    source: 'custom',
    type,
    tool: name,
    capabilities: { available: true }
  }))
}));

describe('Policy Questions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPolicyQuestions', () => {
    it('should return questions array with source, priority, and stop point', () => {
      sourceCache.getPreference.mockReturnValue(null);

      const result = policyQuestions.getPolicyQuestions();

      expect(result).toHaveProperty('questions');
      expect(result).toHaveProperty('cachedPreference');
      expect(result.questions).toHaveLength(3);
    });

    it('should include source question with standard options', () => {
      sourceCache.getPreference.mockReturnValue(null);

      const result = policyQuestions.getPolicyQuestions();
      const sourceQuestion = result.questions[0];

      expect(sourceQuestion.header).toBe('Source');
      expect(sourceQuestion.question).toBe('Where should I look for tasks?');

      const labels = sourceQuestion.options.map(opt => opt.label);
      expect(labels).toContain('GitHub Issues');
      expect(labels).toContain('GitHub Projects');
      expect(labels).toContain('GitLab Issues');
      expect(labels).toContain('Local tasks.md');
      expect(labels).toContain('Custom');
      expect(labels).toContain('Other');
    });

    it('should include priority question with all filter options', () => {
      sourceCache.getPreference.mockReturnValue(null);

      const result = policyQuestions.getPolicyQuestions();
      const priorityQuestion = result.questions[1];

      expect(priorityQuestion.header).toBe('Priority');
      const labels = priorityQuestion.options.map(opt => opt.label);
      expect(labels).toContain('All');
      expect(labels).toContain('Bugs');
      expect(labels).toContain('Security');
      expect(labels).toContain('Features');
    });

    it('should include stop point question with all options', () => {
      sourceCache.getPreference.mockReturnValue(null);

      const result = policyQuestions.getPolicyQuestions();
      const stopQuestion = result.questions[2];

      expect(stopQuestion.header).toBe('Stop Point');
      const labels = stopQuestion.options.map(opt => opt.label);
      expect(labels).toContain('Merged');
      expect(labels).toContain('PR Created');
      expect(labels).toContain('Implemented');
      expect(labels).toContain('Deployed');
      expect(labels).toContain('Production');
    });

    it('should add cached preference as first option when available', () => {
      sourceCache.getPreference.mockReturnValue({ source: 'github' });

      const result = policyQuestions.getPolicyQuestions();
      const sourceQuestion = result.questions[0];

      expect(sourceQuestion.options[0].label).toContain('(last used)');
      expect(result.cachedPreference).toEqual({ source: 'github' });
    });

    it('should format custom source label correctly', () => {
      sourceCache.getPreference.mockReturnValue({
        source: 'custom',
        type: 'cli',
        tool: 'tea'
      });

      const result = policyQuestions.getPolicyQuestions();
      const firstOption = result.questions[0].options[0];

      expect(firstOption.label).toContain('tea');
      expect(firstOption.label).toContain('cli');
      expect(firstOption.label).toContain('(last used)');
    });

    it('should truncate long cached labels to fit 30 char limit', () => {
      sourceCache.getPreference.mockReturnValue({
        source: 'custom',
        type: 'cli',
        tool: 'very-long-tool-name-that-exceeds-limit'
      });

      const result = policyQuestions.getPolicyQuestions();
      const firstOption = result.questions[0].options[0];

      // Label should be max 30 chars
      expect(firstOption.label.length).toBeLessThanOrEqual(30);
    });

    it('should return null cachedPreference when no cache exists', () => {
      sourceCache.getPreference.mockReturnValue(null);

      const result = policyQuestions.getPolicyQuestions();

      expect(result.cachedPreference).toBeNull();
    });
  });

  describe('getCustomTypeQuestions', () => {
    it('should return custom type question from handler', () => {
      const result = policyQuestions.getCustomTypeQuestions();

      expect(result).toHaveProperty('questions');
      expect(result.questions).toHaveLength(1);
      expect(customHandler.getCustomTypeQuestion).toHaveBeenCalled();
    });
  });

  describe('getCustomNameQuestion', () => {
    it('should return question for specified type', () => {
      const result = policyQuestions.getCustomNameQuestion('cli');

      expect(result).toHaveProperty('questions');
      expect(result.questions).toHaveLength(1);
      expect(customHandler.getCustomNameQuestion).toHaveBeenCalledWith('cli');
    });

    it('should include empty options for free text input', () => {
      const result = policyQuestions.getCustomNameQuestion('mcp');

      expect(result.questions[0].options).toEqual([]);
    });
  });

  describe('parseAndCachePolicy', () => {
    it('should map GitHub Issues to github source', () => {
      const result = policyQuestions.parseAndCachePolicy({
        source: 'GitHub Issues',
        priority: 'All',
        stopPoint: 'Merged'
      });

      expect(result.taskSource).toEqual({ source: 'github' });
      expect(sourceCache.savePreference).toHaveBeenCalledWith({ source: 'github' });
    });

    it('should map GitLab Issues to gitlab source', () => {
      const result = policyQuestions.parseAndCachePolicy({
        source: 'GitLab Issues',
        priority: 'Bugs',
        stopPoint: 'PR Created'
      });

      expect(result.taskSource).toEqual({ source: 'gitlab' });
    });

    it('should map Local tasks.md to local source', () => {
      const result = policyQuestions.parseAndCachePolicy({
        source: 'Local tasks.md',
        priority: 'Features',
        stopPoint: 'Implemented'
      });

      expect(result.taskSource).toEqual({ source: 'local' });
    });

    it('should handle Custom source with custom details', () => {
      const result = policyQuestions.parseAndCachePolicy({
        source: 'Custom',
        priority: 'All',
        stopPoint: 'Merged',
        custom: { type: 'CLI Tool', name: 'tea' }
      });

      expect(customHandler.mapTypeSelection).toHaveBeenCalledWith('CLI Tool');
      expect(customHandler.buildCustomConfig).toHaveBeenCalledWith('cli', 'tea');
      expect(result.taskSource.source).toBe('custom');
    });

    it('should handle Other source with description', () => {
      const result = policyQuestions.parseAndCachePolicy({
        source: 'Other',
        priority: 'All',
        stopPoint: 'Merged',
        custom: { description: 'My Jira board' }
      });

      expect(result.taskSource).toEqual({
        source: 'other',
        description: 'My Jira board'
      });
    });

    it('should not cache Other source preference', () => {
      policyQuestions.parseAndCachePolicy({
        source: 'Other',
        priority: 'All',
        stopPoint: 'Merged',
        custom: { description: 'Ad-hoc source' }
      });

      expect(sourceCache.savePreference).not.toHaveBeenCalled();
    });

    it('should use cached preference for "last used" selection', () => {
      sourceCache.getPreference.mockReturnValue({ source: 'gitlab' });

      const result = policyQuestions.parseAndCachePolicy({
        source: 'GitLab (last used)',
        priority: 'Security',
        stopPoint: 'Deployed'
      });

      expect(result.taskSource).toEqual({ source: 'gitlab' });
    });

    it('should throw when (last used) selected but cache is empty', () => {
      sourceCache.getPreference.mockReturnValue(null);

      expect(() => {
        policyQuestions.parseAndCachePolicy({
          source: 'GitHub Issues (last used)',
          priority: 'All',
          stopPoint: 'Merged'
        });
      }).toThrow('Cached source preference not found');
    });

    it('should throw on scientific notation project number', () => {
      expect(() => {
        policyQuestions.parseAndCachePolicy({
          source: 'GitHub Projects',
          priority: 'All',
          stopPoint: 'Merged',
          project: { number: '1e5', owner: '@me' }
        });
      }).toThrow('Invalid project number');
    });

    it('should map priority selections correctly', () => {
      sourceCache.getPreference.mockReturnValue(null);

      expect(policyQuestions.parseAndCachePolicy({
        source: 'GitHub Issues',
        priority: 'All',
        stopPoint: 'Merged'
      }).priorityFilter).toBe('all');

      expect(policyQuestions.parseAndCachePolicy({
        source: 'GitHub Issues',
        priority: 'Bugs',
        stopPoint: 'Merged'
      }).priorityFilter).toBe('bugs');

      expect(policyQuestions.parseAndCachePolicy({
        source: 'GitHub Issues',
        priority: 'Security',
        stopPoint: 'Merged'
      }).priorityFilter).toBe('security');

      expect(policyQuestions.parseAndCachePolicy({
        source: 'GitHub Issues',
        priority: 'Features',
        stopPoint: 'Merged'
      }).priorityFilter).toBe('features');
    });

    it('should map stop point selections correctly', () => {
      sourceCache.getPreference.mockReturnValue(null);

      expect(policyQuestions.parseAndCachePolicy({
        source: 'GitHub Issues',
        priority: 'All',
        stopPoint: 'Merged'
      }).stoppingPoint).toBe('merged');

      expect(policyQuestions.parseAndCachePolicy({
        source: 'GitHub Issues',
        priority: 'All',
        stopPoint: 'PR Created'
      }).stoppingPoint).toBe('pr-created');

      expect(policyQuestions.parseAndCachePolicy({
        source: 'GitHub Issues',
        priority: 'All',
        stopPoint: 'Implemented'
      }).stoppingPoint).toBe('implemented');

      expect(policyQuestions.parseAndCachePolicy({
        source: 'GitHub Issues',
        priority: 'All',
        stopPoint: 'Deployed'
      }).stoppingPoint).toBe('deployed');

      expect(policyQuestions.parseAndCachePolicy({
        source: 'GitHub Issues',
        priority: 'All',
        stopPoint: 'Production'
      }).stoppingPoint).toBe('production');
    });

    it('should default unknown values gracefully', () => {
      sourceCache.getPreference.mockReturnValue(null);

      const result = policyQuestions.parseAndCachePolicy({
        source: 'Unknown Source',
        priority: 'Unknown Priority',
        stopPoint: 'Unknown Stop'
      });

      expect(result.taskSource).toEqual({ source: 'github' });
      expect(result.priorityFilter).toBe('all');
      expect(result.stoppingPoint).toBe('merged');
    });

    it('should map GitHub Projects to gh-projects source', () => {
      const result = policyQuestions.parseAndCachePolicy({
        source: 'GitHub Projects',
        priority: 'All',
        stopPoint: 'Merged',
        project: { number: 5, owner: '@me' }
      });

      expect(result.taskSource.source).toBe('gh-projects');
      expect(result.taskSource.projectNumber).toBe(5);
      expect(result.taskSource.owner).toBe('@me');
      expect(sourceCache.savePreference).toHaveBeenCalledWith({
        source: 'gh-projects',
        projectNumber: 5,
        owner: '@me'
      });
    });

    it('should accept valid org name as project owner', () => {
      const result = policyQuestions.parseAndCachePolicy({
        source: 'GitHub Projects',
        priority: 'All',
        stopPoint: 'Merged',
        project: { number: 42, owner: 'my-org' }
      });

      expect(result.taskSource.owner).toBe('my-org');
    });

    it('should throw on invalid project number (negative)', () => {
      expect(() => {
        policyQuestions.parseAndCachePolicy({
          source: 'GitHub Projects',
          priority: 'All',
          stopPoint: 'Merged',
          project: { number: -1, owner: '@me' }
        });
      }).toThrow('Invalid project number');
    });

    it('should throw on invalid project number (zero)', () => {
      expect(() => {
        policyQuestions.parseAndCachePolicy({
          source: 'GitHub Projects',
          priority: 'All',
          stopPoint: 'Merged',
          project: { number: 0, owner: '@me' }
        });
      }).toThrow('Invalid project number');
    });

    it('should throw on non-numeric project number', () => {
      expect(() => {
        policyQuestions.parseAndCachePolicy({
          source: 'GitHub Projects',
          priority: 'All',
          stopPoint: 'Merged',
          project: { number: 'abc', owner: '@me' }
        });
      }).toThrow('Invalid project number');
    });

    it('should throw on project owner with shell metacharacters', () => {
      expect(() => {
        policyQuestions.parseAndCachePolicy({
          source: 'GitHub Projects',
          priority: 'All',
          stopPoint: 'Merged',
          project: { number: 1, owner: '; rm -rf /' }
        });
      }).toThrow('Invalid project owner');
    });

    it('should throw on empty project owner', () => {
      expect(() => {
        policyQuestions.parseAndCachePolicy({
          source: 'GitHub Projects',
          priority: 'All',
          stopPoint: 'Merged',
          project: { number: 1, owner: '' }
        });
      }).toThrow('Invalid project owner');
    });

    it('should throw when GitHub Projects selected without project details', () => {
      // gh-projects requires project number and owner from follow-up questions
      expect(() => {
        policyQuestions.parseAndCachePolicy({
          source: 'GitHub Projects',
          priority: 'All',
          stopPoint: 'Merged'
        });
      }).toThrow('GitHub Projects source requires project number and owner');
    });
  });

  describe('isUsingCached', () => {
    it('should return true when selection contains "(last used)"', () => {
      expect(policyQuestions.isUsingCached('GitHub (last used)')).toBe(true);
      expect(policyQuestions.isUsingCached('tea (cli) (last used)')).toBe(true);
    });

    it('should return false for non-cached selections', () => {
      expect(policyQuestions.isUsingCached('GitHub Issues')).toBe(false);
      expect(policyQuestions.isUsingCached('Custom')).toBe(false);
    });
  });

  describe('needsCustomFollowUp', () => {
    it('should return true only for "Custom" selection', () => {
      expect(policyQuestions.needsCustomFollowUp('Custom')).toBe(true);
      expect(policyQuestions.needsCustomFollowUp('GitHub Issues')).toBe(false);
      expect(policyQuestions.needsCustomFollowUp('Other')).toBe(false);
    });
  });

  describe('needsOtherDescription', () => {
    it('should return true only for "Other" selection', () => {
      expect(policyQuestions.needsOtherDescription('Other')).toBe(true);
      expect(policyQuestions.needsOtherDescription('Custom')).toBe(false);
      expect(policyQuestions.needsOtherDescription('GitHub Issues')).toBe(false);
    });
  });

  describe('needsProjectFollowUp', () => {
    it('should return true only for "GitHub Projects" selection', () => {
      expect(policyQuestions.needsProjectFollowUp('GitHub Projects')).toBe(true);
    });

    it('should return false for all other selections', () => {
      expect(policyQuestions.needsProjectFollowUp('GitHub Issues')).toBe(false);
      expect(policyQuestions.needsProjectFollowUp('GitLab Issues')).toBe(false);
      expect(policyQuestions.needsProjectFollowUp('Custom')).toBe(false);
      expect(policyQuestions.needsProjectFollowUp('Other')).toBe(false);
      expect(policyQuestions.needsProjectFollowUp('Local tasks.md')).toBe(false);
    });
  });

  describe('getProjectQuestions', () => {
    it('should return 2 questions for project number and owner', () => {
      const result = policyQuestions.getProjectQuestions();

      expect(result).toHaveProperty('questions');
      expect(result.questions).toHaveLength(2);
    });

    it('should have Project Number as first question', () => {
      const result = policyQuestions.getProjectQuestions();

      expect(result.questions[0].header).toBe('Project Number');
      expect(result.questions[0].question).toContain('Project number');
      expect(result.questions[0].options).toEqual([]);
      expect(result.questions[0].multiSelect).toBe(false);
    });

    it('should have Project Owner as second question', () => {
      const result = policyQuestions.getProjectQuestions();

      expect(result.questions[1].header).toBe('Project Owner');
      expect(result.questions[1].question).toContain('owns');
      expect(result.questions[1].options).toEqual([]);
      expect(result.questions[1].multiSelect).toBe(false);
    });

    it('should provide hints for both questions', () => {
      const result = policyQuestions.getProjectQuestions();

      expect(result.questions[0].hint).toBeDefined();
      expect(result.questions[0].hint).toContain('1');
      expect(result.questions[1].hint).toBeDefined();
      expect(result.questions[1].hint).toContain('@me');
    });
  });
});
