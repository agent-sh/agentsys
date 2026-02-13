/**
 * Fixer Module Tests
 * Tests for lib/enhance/fixer.js - auto-fix application for enhancement findings
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const fixer = require('@agentsys/lib/enhance/fixer');

describe('Fixer Module', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixer-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // ============================================
  // applyFixes Tests
  // ============================================
  describe('applyFixes', () => {
    it('should apply fixes to JSON files with autoFixFn', () => {
      const jsonFile = path.join(tempDir, 'test.json');
      fs.writeFileSync(jsonFile, JSON.stringify({ version: '1.0.0' }), 'utf8');

      const issues = [{
        certainty: 'HIGH',
        filePath: jsonFile,
        issue: 'Version mismatch',
        fix: 'Update version',
        autoFixFn: (data) => ({ ...data, version: '2.0.0' })
      }];

      const result = fixer.applyFixes(issues);

      expect(result.applied).toHaveLength(1);
      expect(result.errors).toHaveLength(0);

      const updated = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
      expect(updated.version).toBe('2.0.0');
    });

    it('should skip non-HIGH certainty issues', () => {
      const jsonFile = path.join(tempDir, 'test.json');
      fs.writeFileSync(jsonFile, JSON.stringify({ version: '1.0.0' }), 'utf8');

      const issues = [{
        certainty: 'MEDIUM',
        filePath: jsonFile,
        issue: 'Version mismatch',
        autoFixFn: (data) => ({ ...data, version: '2.0.0' })
      }];

      const result = fixer.applyFixes(issues);

      expect(result.applied).toHaveLength(0);
      expect(result.skipped.length).toBeGreaterThan(0);
      expect(result.skipped[0].reason).toContain('HIGH');
    });

    it('should create backup files when backup option is true', () => {
      const jsonFile = path.join(tempDir, 'backup-test.json');
      fs.writeFileSync(jsonFile, JSON.stringify({ value: 'original' }), 'utf8');

      const issues = [{
        certainty: 'HIGH',
        filePath: jsonFile,
        issue: 'Test issue',
        autoFixFn: (data) => ({ ...data, value: 'modified' })
      }];

      fixer.applyFixes(issues, { backup: true });

      const backupPath = `${jsonFile}.backup`;
      expect(fs.existsSync(backupPath)).toBe(true);

      const backupContent = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      expect(backupContent.value).toBe('original');
    });

    it('should not write files in dryRun mode', () => {
      const jsonFile = path.join(tempDir, 'dryrun-test.json');
      fs.writeFileSync(jsonFile, JSON.stringify({ value: 'original' }), 'utf8');

      const issues = [{
        certainty: 'HIGH',
        filePath: jsonFile,
        issue: 'Test issue',
        autoFixFn: (data) => ({ ...data, value: 'modified' })
      }];

      const result = fixer.applyFixes(issues, { dryRun: true });

      expect(result.applied).toHaveLength(1);

      const content = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
      expect(content.value).toBe('original');
    });

    it('should handle missing files gracefully', () => {
      const issues = [{
        certainty: 'HIGH',
        filePath: path.join(tempDir, 'nonexistent.json'),
        issue: 'Test issue',
        autoFixFn: (data) => data
      }];

      const result = fixer.applyFixes(issues);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('not found');
    });

    it('should apply markdown fixes with known pattern IDs', () => {
      const mdFile = path.join(tempDir, 'test.md');
      fs.writeFileSync(mdFile, '# Agent\n\nContent.', 'utf8');

      const issues = [{
        certainty: 'HIGH',
        filePath: mdFile,
        patternId: 'missing_frontmatter',
        issue: 'Missing frontmatter'
      }];

      const result = fixer.applyFixes(issues);

      expect(result.applied).toHaveLength(1);

      const content = fs.readFileSync(mdFile, 'utf8');
      expect(content).toContain('---');
      expect(content).toContain('name:');
    });

    it('should skip unsupported file types', () => {
      const txtFile = path.join(tempDir, 'test.txt');
      fs.writeFileSync(txtFile, 'plain text', 'utf8');

      const issues = [{
        certainty: 'HIGH',
        filePath: txtFile,
        patternId: 'some_pattern',
        issue: 'Test issue'
      }];

      const result = fixer.applyFixes(issues);

      // .txt files are skipped with "Unsupported file type" reason
      // But since patternId is not in markdownAutoFixPatternIds, it gets filtered out earlier
      // and added to skipped with "No auto-fix available" reason
      expect(result.skipped.length).toBeGreaterThan(0);
    });

    it('should apply fixes at specific schema paths', () => {
      const jsonFile = path.join(tempDir, 'nested.json');
      fs.writeFileSync(jsonFile, JSON.stringify({
        config: {
          settings: {
            enabled: false
          }
        }
      }), 'utf8');

      const issues = [{
        certainty: 'HIGH',
        filePath: jsonFile,
        schemaPath: 'config.settings.enabled',
        issue: 'Setting disabled',
        autoFixFn: () => true
      }];

      const result = fixer.applyFixes(issues);

      expect(result.applied).toHaveLength(1);

      const updated = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
      expect(updated.config.settings.enabled).toBe(true);
    });

    it('should handle array paths in schema paths', () => {
      const jsonFile = path.join(tempDir, 'array.json');
      fs.writeFileSync(jsonFile, JSON.stringify({
        items: [{ name: 'first' }, { name: 'second' }]
      }), 'utf8');

      const issues = [{
        certainty: 'HIGH',
        filePath: jsonFile,
        schemaPath: 'items[1].name',
        issue: 'Name issue',
        autoFixFn: () => 'updated'
      }];

      const result = fixer.applyFixes(issues);

      expect(result.applied).toHaveLength(1);

      const updated = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
      expect(updated.items[1].name).toBe('updated');
    });
  });

  // ============================================
  // Markdown Fixer Tests
  // ============================================
  describe('fixMissingFrontmatter', () => {
    it('should add frontmatter template to content', () => {
      const content = '# Agent\n\nContent.';
      const fixed = fixer.fixMissingFrontmatter(content);

      expect(fixed).toContain('---');
      expect(fixed).toContain('name:');
      expect(fixed).toContain('description:');
      expect(fixed).toContain('tools:');
      expect(fixed).toContain('model:');
      expect(fixed).toContain('# Agent');
    });

    it('should handle empty content by returning it unchanged', () => {
      // Empty string is falsy, so function returns it as-is
      const fixed = fixer.fixMissingFrontmatter('');
      expect(fixed).toBe('');
    });

    it('should handle null/undefined input', () => {
      expect(fixer.fixMissingFrontmatter(null)).toBeNull();
      expect(fixer.fixMissingFrontmatter(undefined)).toBeUndefined();
    });
  });

  describe('fixUnrestrictedBash', () => {
    it('should replace unrestricted Bash with restricted version', () => {
      const content = `---
name: test
tools: Read, Bash, Grep
---`;

      const fixed = fixer.fixUnrestrictedBash(content);

      expect(fixed).toContain('Bash(git:*)');
      expect(fixed).not.toMatch(/tools:.*\bBash\b(?!\()/);
    });

    it('should not affect already restricted Bash', () => {
      const content = `---
name: test
tools: Read, Bash(git:*), Grep
---`;

      const fixed = fixer.fixUnrestrictedBash(content);
      expect(fixed).toBe(content);
    });

    it('should handle multiple Bash occurrences in tools line', () => {
      const content = `---
tools: Bash, Read, Bash
---`;

      const fixed = fixer.fixUnrestrictedBash(content);
      expect(fixed).toContain('Bash(git:*)');
      expect(fixed.match(/Bash\(git:\*\)/g).length).toBe(2);
    });

    it('should not affect Bash outside frontmatter', () => {
      const content = `---
name: test
tools: Read
---

Use Bash for commands.`;

      const fixed = fixer.fixUnrestrictedBash(content);
      expect(fixed).toContain('Use Bash for commands.');
    });
  });

  describe('fixMissingRole', () => {
    it('should add role section after frontmatter', () => {
      const content = `---
name: test
---

# Agent`;

      const fixed = fixer.fixMissingRole(content);

      expect(fixed).toContain('## Your Role');
      expect(fixed).toContain('You are an agent');
      expect(fixed.indexOf('## Your Role')).toBeGreaterThan(fixed.indexOf('---'));
    });

    it('should add role at beginning if no frontmatter', () => {
      const content = '# Agent\n\nContent.';
      const fixed = fixer.fixMissingRole(content);

      expect(fixed).toContain('## Your Role');
      expect(fixed.indexOf('## Your Role')).toBeLessThan(fixed.indexOf('# Agent'));
    });
  });

  describe('fixInconsistentHeadings', () => {
    it('should fix heading level jumps', () => {
      const content = `# Main Title
## Section
#### Jumped too far`;

      const fixed = fixer.fixInconsistentHeadings(content);

      expect(fixed).toContain('### Jumped too far');
      expect(fixed).not.toContain('#### Jumped too far');
    });

    it('should not modify correct heading hierarchy', () => {
      const content = `# Main
## Section
### Subsection`;

      const fixed = fixer.fixInconsistentHeadings(content);
      expect(fixed).toBe(content);
    });

    it('should ignore headings in code blocks', () => {
      const content = '# Title\n\n```\n#### In code block\n```\n\n#### After code';

      const fixed = fixer.fixInconsistentHeadings(content);

      expect(fixed).toContain('#### In code block');
      expect(fixed).toContain('## After code');
    });
  });

  describe('fixVerboseExplanations', () => {
    it('should simplify verbose phrases', () => {
      const content = 'In order to do this, due to the fact that it is able to work.';
      const fixed = fixer.fixVerboseExplanations(content);

      // "In order to" at start gets capitalized "To"
      expect(fixed).toContain('To do this');
      expect(fixed).toContain('because');
      expect(fixed).toContain('can work');
      expect(fixed).not.toContain('In order to');
      expect(fixed).not.toContain('due to the fact that');
      expect(fixed).not.toContain('is able to');
    });

    it('should preserve case of first character', () => {
      const content = 'In order to proceed. in order to continue.';
      const fixed = fixer.fixVerboseExplanations(content);

      expect(fixed).toContain('To proceed');
      expect(fixed).toContain('to continue');
    });

    it('should not modify content in code blocks', () => {
      const content = 'In order to test.\n```\nIn order to preserve\n```\nIn order to fix.';
      const fixed = fixer.fixVerboseExplanations(content);

      expect(fixed).toContain('To test');
      expect(fixed).toContain('In order to preserve');
      expect(fixed).toContain('To fix');
    });

    it('should handle multiple verbose phrases', () => {
      const content = 'prior to making use of the majority of a large number of items';
      const fixed = fixer.fixVerboseExplanations(content);

      expect(fixed).toContain('before');
      expect(fixed).toContain('use');
      expect(fixed).toContain('most');
      expect(fixed).toContain('many');
    });
  });

  // ============================================
  // Prompt Fixer Tests
  // ============================================
  describe('fixMissingOutputFormat', () => {
    it('should add output format section', () => {
      const content = '# Prompt\n\nInstructions.';
      const fixed = fixer.fixMissingOutputFormat(content);

      expect(fixed).toContain('## Output Format');
      expect(fixed).toContain('Respond with');
    });

    it('should not add if output format already exists', () => {
      const content = '# Prompt\n\n## Output Format\n\nReturn JSON.';
      const fixed = fixer.fixMissingOutputFormat(content);

      expect(fixed).toBe(content);
    });

    it('should not add if xml output_format tag exists', () => {
      const content = '# Prompt\n\n<output_format>JSON</output_format>';
      const fixed = fixer.fixMissingOutputFormat(content);

      expect(fixed).toBe(content);
    });
  });

  describe('fixMissingExamples', () => {
    it('should add example section', () => {
      const content = '# Prompt\n\nInstructions.';
      const fixed = fixer.fixMissingExamples(content);

      expect(fixed).toContain('## Examples');
      expect(fixed).toContain('<good-example>');
      expect(fixed).toContain('<bad-example>');
    });

    it('should not add if example section already exists', () => {
      const content = '# Prompt\n\n## Example\n\nExample content.';
      const fixed = fixer.fixMissingExamples(content);

      expect(fixed).toBe(content);
    });

    it('should not add if example tag exists', () => {
      const content = '# Prompt\n\n<example>Sample</example>';
      const fixed = fixer.fixMissingExamples(content);

      expect(fixed).toBe(content);
    });
  });

  describe('fixMissingXmlStructure', () => {
    it('should wrap role section in XML tags', () => {
      const content = '## Your Role\n\nYou are an agent.\n\n## Other';
      const fixed = fixer.fixMissingXmlStructure(content);

      expect(fixed).toContain('<role>');
      expect(fixed).toContain('</role>');
    });

    it('should wrap constraints section in XML tags', () => {
      const content = '## Constraints\n\nDo not break things.\n\n## Other';
      const fixed = fixer.fixMissingXmlStructure(content);

      expect(fixed).toContain('<constraints>');
      expect(fixed).toContain('</constraints>');
    });

    it('should not add XML if already has XML tags', () => {
      const content = '<role>\n## Your Role\n</role>';
      const fixed = fixer.fixMissingXmlStructure(content);

      expect(fixed).toBe(content);
    });
  });

  describe('fixMissingVerificationCriteria', () => {
    it('should add verification section', () => {
      const content = '# Task\n\nDo the thing.';
      const fixed = fixer.fixMissingVerificationCriteria(content);

      expect(fixed).toContain('## Verification');
      expect(fixed).toContain('Run relevant tests');
    });

    it('should not add if verification keywords exist', () => {
      const content = '# Task\n\nRun tests to verify the change works.';
      const fixed = fixer.fixMissingVerificationCriteria(content);

      expect(fixed).toBe(content);
    });

    it('should not add if validate keyword exists', () => {
      const content = '# Task\n\nValidate the output.';
      const fixed = fixer.fixMissingVerificationCriteria(content);

      expect(fixed).toBe(content);
    });
  });

  describe('fixMissingTriggerPhrase', () => {
    it('should add trigger phrase to description', () => {
      const content = `---
name: test-skill
description: Analyze code quality
---

Skill content.`;

      const fixed = fixer.fixMissingTriggerPhrase(content);

      expect(fixed).toContain('Use when user asks to');
      expect(fixed).toContain('analyze code quality');
    });

    it('should not modify if trigger phrase exists', () => {
      const content = `---
name: test-skill
description: Use when user asks to analyze code
---`;

      const fixed = fixer.fixMissingTriggerPhrase(content);
      expect(fixed).toBe(content);
    });

    it('should remove leading "to" from description', () => {
      const content = `---
description: to analyze code
---`;

      const fixed = fixer.fixMissingTriggerPhrase(content);
      expect(fixed).toContain('Use when user asks to analyze code');
      expect(fixed).not.toContain('to to analyze');
    });
  });

  describe('fixAggressiveEmphasis', () => {
    it('should reduce aggressive CAPS', () => {
      const content = 'NEVER do this. ALWAYS check. MUST be done.';
      const fixed = fixer.fixAggressiveEmphasis(content);

      expect(fixed).toContain('Never do this');
      expect(fixed).toContain('Always check');
      expect(fixed).toContain('Must be done');
    });

    it('should preserve acceptable acronyms', () => {
      const content = 'Use the API and JSON for HTTP requests.';
      const fixed = fixer.fixAggressiveEmphasis(content);

      expect(fixed).toContain('API');
      expect(fixed).toContain('JSON');
      expect(fixed).toContain('HTTP');
    });

    it('should reduce multiple exclamation marks', () => {
      const content = 'Important!! Very important!!! Critical!!!!';
      const fixed = fixer.fixAggressiveEmphasis(content);

      expect(fixed).toContain('Important!');
      expect(fixed).not.toContain('!!');
    });

    it('should not modify code blocks', () => {
      const content = 'NEVER outside.\n```\nNEVER inside code\n```\nALWAYS after.';
      const fixed = fixer.fixAggressiveEmphasis(content);

      expect(fixed).toContain('Never outside');
      expect(fixed).toContain('NEVER inside code');
      expect(fixed).toContain('Always after');
    });

    it('should preserve HIGH, MEDIUM, LOW severity markers', () => {
      const content = 'Severity: HIGH, MEDIUM, or LOW.';
      const fixed = fixer.fixAggressiveEmphasis(content);

      expect(fixed).toContain('HIGH');
      expect(fixed).toContain('MEDIUM');
      expect(fixed).toContain('LOW');
    });
  });

  // ============================================
  // JSON Schema Fixer Tests
  // ============================================
  describe('fixAdditionalProperties', () => {
    it('should add additionalProperties: false to object schemas', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      };

      const fixed = fixer.fixAdditionalProperties(schema);

      expect(fixed.additionalProperties).toBe(false);
    });

    it('should recursively fix nested object schemas', () => {
      const schema = {
        type: 'object',
        properties: {
          nested: {
            type: 'object',
            properties: {
              value: { type: 'string' }
            }
          }
        }
      };

      const fixed = fixer.fixAdditionalProperties(schema);

      expect(fixed.additionalProperties).toBe(false);
      expect(fixed.properties.nested.additionalProperties).toBe(false);
    });

    it('should handle null/undefined input', () => {
      expect(fixer.fixAdditionalProperties(null)).toBeNull();
      expect(fixer.fixAdditionalProperties(undefined)).toBeUndefined();
    });
  });

  describe('fixRequiredFields', () => {
    it('should add required array with all non-optional properties', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        }
      };

      const fixed = fixer.fixRequiredFields(schema);

      expect(fixed.required).toBeDefined();
      expect(fixed.required).toContain('name');
      expect(fixed.required).toContain('age');
    });

    it('should exclude properties with defaults', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          enabled: { type: 'boolean', default: true }
        }
      };

      const fixed = fixer.fixRequiredFields(schema);

      expect(fixed.required).toContain('name');
      expect(fixed.required).not.toContain('enabled');
    });

    it('should exclude properties marked optional in description', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          nickname: { type: 'string', description: 'Optional nickname' }
        }
      };

      const fixed = fixer.fixRequiredFields(schema);

      expect(fixed.required).toContain('name');
      expect(fixed.required).not.toContain('nickname');
    });

    it('should not modify if required already exists', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        required: ['name']
      };

      const fixed = fixer.fixRequiredFields(schema);

      expect(fixed.required).toEqual(['name']);
    });
  });

  describe('fixVersionMismatch', () => {
    it('should update version to target version', () => {
      const plugin = { name: 'test', version: '1.0.0' };
      const fixed = fixer.fixVersionMismatch(plugin, '2.0.0');

      expect(fixed.version).toBe('2.0.0');
      expect(fixed.name).toBe('test');
    });
  });

  // ============================================
  // Utility Function Tests
  // ============================================
  describe('previewFixes', () => {
    it('should preview fixable issues', () => {
      const issues = [
        {
          certainty: 'HIGH',
          filePath: '/test/file.json',
          issue: 'Test issue',
          fix: 'Test fix',
          autoFixFn: () => {}
        }
      ];

      const previews = fixer.previewFixes(issues);

      expect(previews).toHaveLength(1);
      expect(previews[0].willApply).toBe(true);
      expect(previews[0].issue).toBe('Test issue');
    });

    it('should mark non-fixable issues as willApply: false', () => {
      const issues = [
        {
          certainty: 'MEDIUM',
          filePath: '/test/file.json',
          issue: 'Low certainty issue'
        },
        {
          certainty: 'HIGH',
          filePath: '/test/file.json',
          issue: 'No fix function'
        }
      ];

      const previews = fixer.previewFixes(issues);

      expect(previews).toHaveLength(2);
      expect(previews[0].willApply).toBe(false);
      expect(previews[0].reason).toContain('HIGH');
      expect(previews[1].willApply).toBe(false);
      expect(previews[1].reason).toContain('auto-fix');
    });
  });

  describe('restoreFromBackup', () => {
    it('should restore file from backup', () => {
      const file = path.join(tempDir, 'restore-test.json');
      const backup = `${file}.backup`;

      fs.writeFileSync(file, 'modified content', 'utf8');
      fs.writeFileSync(backup, 'original content', 'utf8');

      const result = fixer.restoreFromBackup(file);

      expect(result).toBe(true);
      expect(fs.readFileSync(file, 'utf8')).toBe('original content');
      expect(fs.existsSync(backup)).toBe(false);
    });

    it('should return false if no backup exists', () => {
      const file = path.join(tempDir, 'no-backup.json');
      fs.writeFileSync(file, 'content', 'utf8');

      const result = fixer.restoreFromBackup(file);

      expect(result).toBe(false);
    });
  });

  describe('cleanupBackups', () => {
    it('should remove all backup files in directory', () => {
      const file1 = path.join(tempDir, 'file1.json.backup');
      const file2 = path.join(tempDir, 'file2.md.backup');
      const regular = path.join(tempDir, 'regular.json');

      fs.writeFileSync(file1, 'backup1', 'utf8');
      fs.writeFileSync(file2, 'backup2', 'utf8');
      fs.writeFileSync(regular, 'regular', 'utf8');

      const count = fixer.cleanupBackups(tempDir);

      expect(count).toBe(2);
      expect(fs.existsSync(file1)).toBe(false);
      expect(fs.existsSync(file2)).toBe(false);
      expect(fs.existsSync(regular)).toBe(true);
    });

    it('should find backups in nested directories', () => {
      const subDir = path.join(tempDir, 'subdir');
      fs.mkdirSync(subDir);

      const backup1 = path.join(tempDir, 'file.backup');
      const backup2 = path.join(subDir, 'nested.backup');

      fs.writeFileSync(backup1, 'backup1', 'utf8');
      fs.writeFileSync(backup2, 'backup2', 'utf8');

      const count = fixer.cleanupBackups(tempDir);

      expect(count).toBe(2);
    });

    it('should handle non-existent directory gracefully', () => {
      const count = fixer.cleanupBackups(path.join(tempDir, 'nonexistent'));
      expect(count).toBe(0);
    });
  });
});
