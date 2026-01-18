/**
 * Context Optimizer Tests
 * Comprehensive test coverage for security-critical shell escaping and validation functions
 */

const contextOptimizer = require('../lib/utils/context-optimizer');
const {
  escapeShell,
  escapeSingleQuotes,
  sanitizeExtension,
  validateBranchName,
  validateGitRef,
  validateLimit
} = contextOptimizer._internal;

describe('Context Optimizer', () => {
  // ============================================
  // escapeShell() - Security Critical Tests
  // ============================================
  describe('escapeShell', () => {
    describe('type handling', () => {
      it('should return empty string for non-string input', () => {
        expect(escapeShell(null)).toBe('');
        expect(escapeShell(undefined)).toBe('');
        expect(escapeShell(123)).toBe('');
        expect(escapeShell({})).toBe('');
        expect(escapeShell([])).toBe('');
      });

      it('should handle empty string', () => {
        expect(escapeShell('')).toBe('');
      });
    });

    describe('dangerous character rejection', () => {
      it('should throw on null bytes', () => {
        expect(() => escapeShell('test\0injection')).toThrow('invalid characters');
        expect(() => escapeShell('\0')).toThrow('invalid characters');
      });

      it('should throw on newlines', () => {
        expect(() => escapeShell('test\ninjection')).toThrow('invalid characters');
        expect(() => escapeShell('\n')).toThrow('invalid characters');
      });

      it('should throw on carriage returns', () => {
        expect(() => escapeShell('test\rinjection')).toThrow('invalid characters');
        expect(() => escapeShell('\r')).toThrow('invalid characters');
      });
    });

    describe('shell metacharacter escaping', () => {
      it('should escape double quotes', () => {
        expect(escapeShell('test"value')).toBe('test\\"value');
        expect(escapeShell('"quoted"')).toBe('\\"quoted\\"');
      });

      it('should escape dollar sign (variable expansion)', () => {
        expect(escapeShell('$HOME')).toBe('\\$HOME');
        expect(escapeShell('${PATH}')).toBe('\\$\\{PATH\\}');
      });

      it('should escape backticks (command substitution)', () => {
        expect(escapeShell('`whoami`')).toBe('\\`whoami\\`');
      });

      it('should escape backslash', () => {
        expect(escapeShell('path\\to\\file')).toBe('path\\\\to\\\\file');
      });

      it('should escape exclamation mark (history expansion)', () => {
        expect(escapeShell('test!!')).toBe('test\\!\\!');
      });

      it('should escape semicolon (command separator)', () => {
        expect(escapeShell('cmd1;cmd2')).toBe('cmd1\\;cmd2');
        expect(escapeShell('test; rm -rf /')).toBe('test\\;\\ rm\\ -rf\\ /');
      });

      it('should escape pipe (command chaining)', () => {
        expect(escapeShell('cmd|cat')).toBe('cmd\\|cat');
      });

      it('should escape ampersand (background/AND)', () => {
        expect(escapeShell('cmd&')).toBe('cmd\\&');
        expect(escapeShell('cmd&&cmd2')).toBe('cmd\\&\\&cmd2');
      });

      it('should escape redirects', () => {
        expect(escapeShell('cmd>file')).toBe('cmd\\>file');
        expect(escapeShell('cmd<file')).toBe('cmd\\<file');
        expect(escapeShell('cmd>>file')).toBe('cmd\\>\\>file');
      });

      it('should escape parentheses (subshell)', () => {
        expect(escapeShell('$(cmd)')).toBe('\\$\\(cmd\\)');
        expect(escapeShell('(subshell)')).toBe('\\(subshell\\)');
      });

      it('should escape curly braces (brace expansion)', () => {
        expect(escapeShell('{a,b}')).toBe('\\{a,b\\}');
      });

      it('should escape square brackets (glob)', () => {
        expect(escapeShell('[abc]')).toBe('\\[abc\\]');
      });

      it('should escape asterisk (glob)', () => {
        expect(escapeShell('*.txt')).toBe('\\*.txt');
      });

      it('should escape question mark (glob)', () => {
        expect(escapeShell('file?.txt')).toBe('file\\?.txt');
      });

      it('should escape tilde (home expansion)', () => {
        expect(escapeShell('~/file')).toBe('\\~/file');
      });

      it('should escape hash (comment)', () => {
        expect(escapeShell('#comment')).toBe('\\#comment');
      });

      it('should escape single quotes', () => {
        expect(escapeShell("it's")).toBe("it\\'s");
      });

      it('should escape spaces', () => {
        expect(escapeShell('file name')).toBe('file\\ name');
      });

      it('should escape tabs', () => {
        expect(escapeShell('col1\tcol2')).toBe('col1\\\tcol2');
      });
    });

    describe('command injection prevention', () => {
      it('should neutralize common injection patterns', () => {
        // These should be escaped, not throw
        expect(escapeShell('; rm -rf /')).toBe('\\;\\ rm\\ -rf\\ /');
        expect(escapeShell('$(cat /etc/passwd)')).toBe('\\$\\(cat\\ /etc/passwd\\)');
        expect(escapeShell('`cat /etc/passwd`')).toBe('\\`cat\\ /etc/passwd\\`');
        expect(escapeShell('| cat /etc/passwd')).toBe('\\|\\ cat\\ /etc/passwd');
        expect(escapeShell('&& cat /etc/passwd')).toBe('\\&\\&\\ cat\\ /etc/passwd');
      });

      it('should handle complex injection attempts', () => {
        const injection = 'test"; rm -rf / #';
        const escaped = escapeShell(injection);
        expect(escaped).toBe('test\\"\\;\\ rm\\ -rf\\ /\\ \\#');
      });
    });

    describe('safe strings', () => {
      it('should not modify safe alphanumeric strings', () => {
        expect(escapeShell('test123')).toBe('test123');
        expect(escapeShell('HelloWorld')).toBe('HelloWorld');
      });

      it('should not modify paths without special chars', () => {
        expect(escapeShell('/usr/local/bin')).toBe('/usr/local/bin');
      });
    });
  });

  // ============================================
  // escapeSingleQuotes() Tests
  // ============================================
  describe('escapeSingleQuotes', () => {
    it('should return empty string for non-string input', () => {
      expect(escapeSingleQuotes(null)).toBe('');
      expect(escapeSingleQuotes(undefined)).toBe('');
      expect(escapeSingleQuotes(123)).toBe('');
    });

    it('should handle empty string', () => {
      expect(escapeSingleQuotes('')).toBe('');
    });

    it('should escape single quotes using shell idiom', () => {
      expect(escapeSingleQuotes("it's")).toBe("it'\\''s");
      // Each ' becomes '\'' so 'quoted' (2 quotes) becomes '\''quoted'\''
      expect(escapeSingleQuotes("'quoted'")).toBe("'\\''quoted'\\''");
    });

    it('should not modify strings without single quotes', () => {
      expect(escapeSingleQuotes('test')).toBe('test');
      expect(escapeSingleQuotes('test "double"')).toBe('test "double"');
    });
  });

  // ============================================
  // sanitizeExtension() Tests
  // ============================================
  describe('sanitizeExtension', () => {
    it('should return default for non-string input', () => {
      expect(sanitizeExtension(null)).toBe('ts');
      expect(sanitizeExtension(undefined)).toBe('ts');
      expect(sanitizeExtension(123)).toBe('ts');
    });

    it('should return default for empty result', () => {
      expect(sanitizeExtension('')).toBe('ts');
      expect(sanitizeExtension('...')).toBe('ts');
      expect(sanitizeExtension('!@#$')).toBe('ts');
    });

    it('should strip non-alphanumeric characters', () => {
      expect(sanitizeExtension('.js')).toBe('js');
      expect(sanitizeExtension('*.py')).toBe('py');
      expect(sanitizeExtension('file.ts')).toBe('filets');
    });

    it('should preserve valid extensions', () => {
      expect(sanitizeExtension('ts')).toBe('ts');
      expect(sanitizeExtension('js')).toBe('js');
      expect(sanitizeExtension('py')).toBe('py');
      expect(sanitizeExtension('rs')).toBe('rs');
    });

    it('should handle injection attempts', () => {
      expect(sanitizeExtension('ts; rm -rf /')).toBe('tsrmrf');
      expect(sanitizeExtension('$(whoami)')).toBe('whoami');
    });
  });

  // ============================================
  // validateBranchName() Tests
  // ============================================
  describe('validateBranchName', () => {
    describe('type validation', () => {
      it('should throw for non-string input', () => {
        expect(() => validateBranchName(null)).toThrow('non-empty string');
        expect(() => validateBranchName(undefined)).toThrow('non-empty string');
        expect(() => validateBranchName(123)).toThrow('non-empty string');
      });

      it('should throw for empty string', () => {
        expect(() => validateBranchName('')).toThrow('non-empty string');
      });
    });

    describe('length validation', () => {
      it('should accept branch names up to 255 characters', () => {
        const longBranch = 'a'.repeat(255);
        expect(validateBranchName(longBranch)).toBe(longBranch);
      });

      it('should reject branch names over 255 characters', () => {
        const tooLong = 'a'.repeat(256);
        expect(() => validateBranchName(tooLong)).toThrow('too long');
      });
    });

    describe('valid branch names', () => {
      it('should accept standard branch names', () => {
        expect(validateBranchName('main')).toBe('main');
        expect(validateBranchName('master')).toBe('master');
        expect(validateBranchName('develop')).toBe('develop');
      });

      it('should accept branch names with slashes', () => {
        expect(validateBranchName('feature/new-feature')).toBe('feature/new-feature');
        expect(validateBranchName('bugfix/fix-123')).toBe('bugfix/fix-123');
      });

      it('should accept branch names with dots', () => {
        expect(validateBranchName('release/v1.0.0')).toBe('release/v1.0.0');
      });

      it('should accept branch names with underscores', () => {
        expect(validateBranchName('feature_branch')).toBe('feature_branch');
      });

      it('should accept branch names with numbers', () => {
        expect(validateBranchName('feature123')).toBe('feature123');
        expect(validateBranchName('123feature')).toBe('123feature');
      });
    });

    describe('command injection prevention', () => {
      it('should reject branch names with semicolons', () => {
        expect(() => validateBranchName('main; rm -rf /')).toThrow('invalid characters');
      });

      it('should reject branch names with pipes', () => {
        expect(() => validateBranchName('main|cat')).toThrow('invalid characters');
      });

      it('should reject branch names with ampersands', () => {
        expect(() => validateBranchName('main&&echo')).toThrow('invalid characters');
      });

      it('should reject branch names with backticks', () => {
        expect(() => validateBranchName('`whoami`')).toThrow('invalid characters');
      });

      it('should reject branch names with dollar signs', () => {
        expect(() => validateBranchName('$(whoami)')).toThrow('invalid characters');
      });

      it('should reject branch names with spaces', () => {
        expect(() => validateBranchName('branch name')).toThrow('invalid characters');
      });
    });

    describe('git option injection prevention', () => {
      it('should reject branch names starting with hyphen', () => {
        expect(() => validateBranchName('-version')).toThrow('cannot start with hyphen');
        expect(() => validateBranchName('--help')).toThrow('cannot start with hyphen');
        expect(() => validateBranchName('-n')).toThrow('cannot start with hyphen');
      });

      it('should accept hyphens in middle of name', () => {
        expect(validateBranchName('feature-branch')).toBe('feature-branch');
        expect(validateBranchName('a-b-c')).toBe('a-b-c');
      });
    });
  });

  // ============================================
  // validateGitRef() Tests
  // ============================================
  describe('validateGitRef', () => {
    describe('type validation', () => {
      it('should throw for non-string input', () => {
        expect(() => validateGitRef(null)).toThrow('non-empty string');
        expect(() => validateGitRef(undefined)).toThrow('non-empty string');
        expect(() => validateGitRef(123)).toThrow('non-empty string');
      });

      it('should throw for empty string', () => {
        expect(() => validateGitRef('')).toThrow('non-empty string');
      });
    });

    describe('length validation', () => {
      it('should accept refs up to 255 characters', () => {
        const longRef = 'a'.repeat(255);
        expect(validateGitRef(longRef)).toBe(longRef);
      });

      it('should reject refs over 255 characters', () => {
        const tooLong = 'a'.repeat(256);
        expect(() => validateGitRef(tooLong)).toThrow('too long');
      });
    });

    describe('valid git references', () => {
      it('should accept HEAD references', () => {
        expect(validateGitRef('HEAD')).toBe('HEAD');
        expect(validateGitRef('HEAD~1')).toBe('HEAD~1');
        expect(validateGitRef('HEAD~5')).toBe('HEAD~5');
        expect(validateGitRef('HEAD^')).toBe('HEAD^');
        expect(validateGitRef('HEAD^^')).toBe('HEAD^^');
      });

      it('should accept commit hashes', () => {
        expect(validateGitRef('abc123')).toBe('abc123');
        expect(validateGitRef('abc123def456')).toBe('abc123def456');
      });

      it('should accept branch names', () => {
        expect(validateGitRef('main')).toBe('main');
        expect(validateGitRef('feature/test')).toBe('feature/test');
      });

      it('should accept tag references', () => {
        expect(validateGitRef('v1.0.0')).toBe('v1.0.0');
        expect(validateGitRef('release-1.0')).toBe('release-1.0');
      });

      it('should accept remote references', () => {
        expect(validateGitRef('origin/main')).toBe('origin/main');
      });
    });

    describe('command injection prevention', () => {
      it('should reject refs with semicolons', () => {
        expect(() => validateGitRef('HEAD~5; rm -rf /')).toThrow('invalid characters');
      });

      it('should reject refs with pipes', () => {
        expect(() => validateGitRef('HEAD|cat')).toThrow('invalid characters');
      });

      it('should reject refs with spaces', () => {
        expect(() => validateGitRef('HEAD 5')).toThrow('invalid characters');
      });
    });

    describe('git option injection prevention', () => {
      it('should reject refs starting with hyphen', () => {
        expect(() => validateGitRef('-version')).toThrow('cannot start with hyphen');
        expect(() => validateGitRef('--help')).toThrow('cannot start with hyphen');
      });
    });
  });

  // ============================================
  // validateLimit() Tests
  // ============================================
  describe('validateLimit', () => {
    describe('valid inputs', () => {
      it('should accept positive integers', () => {
        expect(validateLimit(1)).toBe(1);
        expect(validateLimit(10)).toBe(10);
        expect(validateLimit(100)).toBe(100);
        expect(validateLimit(1000)).toBe(1000);
      });

      it('should accept numeric strings', () => {
        expect(validateLimit('1')).toBe(1);
        expect(validateLimit('10')).toBe(10);
        expect(validateLimit('999')).toBe(999);
      });
    });

    describe('invalid inputs', () => {
      it('should reject zero', () => {
        expect(() => validateLimit(0)).toThrow('positive integer');
      });

      it('should reject negative numbers', () => {
        expect(() => validateLimit(-1)).toThrow('positive integer');
        expect(() => validateLimit(-100)).toThrow('positive integer');
      });

      it('should reject floats', () => {
        expect(() => validateLimit(1.5)).toThrow('positive integer');
        expect(() => validateLimit(10.9)).toThrow('positive integer');
      });

      it('should reject non-numeric strings', () => {
        expect(() => validateLimit('abc')).toThrow('positive integer');
        expect(() => validateLimit('10abc')).toThrow('positive integer');
        expect(() => validateLimit('10; rm -rf /')).toThrow('positive integer');
      });

      it('should reject values exceeding max', () => {
        expect(() => validateLimit(1001)).toThrow('cannot exceed 1000');
        expect(() => validateLimit(9999)).toThrow('cannot exceed 1000');
      });
    });

    describe('custom max value', () => {
      it('should respect custom max parameter', () => {
        expect(validateLimit(50, 100)).toBe(50);
        expect(() => validateLimit(101, 100)).toThrow('cannot exceed 100');
      });
    });

    describe('injection prevention', () => {
      it('should reject injection attempts in strings', () => {
        expect(() => validateLimit('10; rm')).toThrow('positive integer');
        expect(() => validateLimit('10 && echo')).toThrow('positive integer');
        expect(() => validateLimit('10|cat')).toThrow('positive integer');
      });
    });
  });

  // ============================================
  // contextOptimizer methods Tests
  // ============================================
  describe('contextOptimizer methods', () => {
    describe('recentCommits', () => {
      it('should generate valid command with default limit', () => {
        const cmd = contextOptimizer.recentCommits();
        expect(cmd).toBe('git log --oneline --no-decorate -10 --format="%h %s"');
      });

      it('should generate valid command with custom limit', () => {
        const cmd = contextOptimizer.recentCommits(5);
        expect(cmd).toContain('-5');
      });

      it('should reject invalid limits', () => {
        expect(() => contextOptimizer.recentCommits(-1)).toThrow();
        expect(() => contextOptimizer.recentCommits('abc')).toThrow();
      });
    });

    describe('compactStatus', () => {
      it('should generate valid command', () => {
        expect(contextOptimizer.compactStatus()).toBe('git status -uno --porcelain');
      });
    });

    describe('fileChanges', () => {
      it('should generate valid command with default ref', () => {
        const cmd = contextOptimizer.fileChanges();
        expect(cmd).toBe('git diff HEAD~5..HEAD --name-status');
      });

      it('should validate custom refs', () => {
        expect(contextOptimizer.fileChanges('HEAD~10')).toContain('HEAD~10');
        expect(() => contextOptimizer.fileChanges('HEAD; rm')).toThrow();
      });
    });

    describe('currentBranch', () => {
      it('should generate valid command', () => {
        expect(contextOptimizer.currentBranch()).toBe('git branch --show-current');
      });
    });

    describe('lineAge', () => {
      it('should escape file paths', () => {
        const cmd = contextOptimizer.lineAge('test file.js', 10);
        expect(cmd).toContain('test\\ file.js');
      });

      it('should validate line numbers', () => {
        expect(() => contextOptimizer.lineAge('file.js', -1)).toThrow('positive integer');
        expect(() => contextOptimizer.lineAge('file.js', 0)).toThrow('positive integer');
        expect(() => contextOptimizer.lineAge('file.js', 'abc')).toThrow('positive integer');
      });

      it('should enforce upper bound on line numbers', () => {
        // Should accept reasonable line numbers
        expect(() => contextOptimizer.lineAge('file.js', 1000000)).not.toThrow();
        expect(() => contextOptimizer.lineAge('file.js', 10000000)).not.toThrow(); // max

        // Should reject excessively large line numbers
        expect(() => contextOptimizer.lineAge('file.js', 10000001)).toThrow('cannot exceed');
        expect(() => contextOptimizer.lineAge('file.js', 999999999)).toThrow('cannot exceed');
      });

      it('should reject dangerous file paths', () => {
        expect(() => contextOptimizer.lineAge('file\ninjection', 1)).toThrow('invalid characters');
      });
    });

    describe('findSourceFiles', () => {
      it('should sanitize extensions', () => {
        const cmd = contextOptimizer.findSourceFiles('.js');
        expect(cmd).toContain('\\.js$');
      });

      it('should handle injection attempts', () => {
        const cmd = contextOptimizer.findSourceFiles('ts; rm');
        expect(cmd).toContain('\\.tsrm$');
      });
    });

    describe('branches', () => {
      it('should validate limit', () => {
        expect(contextOptimizer.branches(5)).toContain('head -5');
        expect(() => contextOptimizer.branches('5; rm')).toThrow();
      });
    });

    describe('tags', () => {
      it('should validate limit', () => {
        expect(contextOptimizer.tags(5)).toContain('head -5');
        expect(() => contextOptimizer.tags(-1)).toThrow();
      });
    });

    describe('commitsSinceBranch', () => {
      it('should validate branch name', () => {
        expect(contextOptimizer.commitsSinceBranch('main')).toContain('main..HEAD');
        expect(() => contextOptimizer.commitsSinceBranch('main; rm')).toThrow();
        expect(() => contextOptimizer.commitsSinceBranch('--version')).toThrow();
      });
    });

    describe('mergeBase', () => {
      it('should validate branch name', () => {
        expect(contextOptimizer.mergeBase('develop')).toContain('develop HEAD');
        expect(() => contextOptimizer.mergeBase('$(whoami)')).toThrow();
      });
    });

    describe('branchChangedFiles', () => {
      it('should validate branch name', () => {
        expect(contextOptimizer.branchChangedFiles('main')).toContain('main...HEAD');
        expect(() => contextOptimizer.branchChangedFiles('main|cat')).toThrow();
      });
    });

    describe('authorCommitCount', () => {
      it('should escape author names', () => {
        const cmd = contextOptimizer.authorCommitCount('John Doe');
        expect(cmd).toContain('John\\ Doe');
      });

      it('should reject dangerous author strings', () => {
        expect(() => contextOptimizer.authorCommitCount('test\n')).toThrow();
      });
    });

    describe('fileExists', () => {
      it('should escape file names with single quotes', () => {
        const cmd = contextOptimizer.fileExists("it's a file");
        expect(cmd).toContain("it'\\''s");
      });
    });

    describe('diffStat', () => {
      it('should validate ref', () => {
        expect(contextOptimizer.diffStat('HEAD~3')).toContain('HEAD~3');
        expect(() => contextOptimizer.diffStat('HEAD; cat')).toThrow();
      });
    });

    describe('static commands', () => {
      it('should return consistent commands', () => {
        expect(contextOptimizer.remoteInfo()).toBe('git remote -v | head -2');
        expect(contextOptimizer.hasStashes()).toBe('git stash list --oneline | wc -l');
        expect(contextOptimizer.worktreeList()).toBe('git worktree list --porcelain');
        expect(contextOptimizer.contributors()).toBe('git shortlog -sn --no-merges | head -10');
        expect(contextOptimizer.lastCommitMessage()).toBe('git log -1 --format=%s');
        expect(contextOptimizer.lastCommitFiles()).toBe('git diff-tree --no-commit-id --name-only -r HEAD');
        expect(contextOptimizer.isClean()).toBe('git status --porcelain | wc -l');
      });
    });
  });
});
