const path = require('path');
const fs = require('fs');
const expandTemplates = require('../scripts/expand-templates');

const REPO_ROOT = path.join(__dirname, '..');
const SNIPPETS_DIR = path.join(REPO_ROOT, 'templates', 'agent-snippets');
const FIXTURE_PLUGIN = path.join(REPO_ROOT, 'plugins', 'enhance', 'agents');

// Helper: create a temp agent file with TEMPLATE markers, run test, then clean up
function withTempAgentFile(filename, content, fn) {
  const filePath = path.join(FIXTURE_PLUGIN, filename);
  fs.writeFileSync(filePath, content, 'utf8');
  try {
    return fn(filePath);
  } finally {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

describe('expand-templates', () => {
  describe('variable substitution', () => {
    test('replaces all {{var}} placeholders with provided values', () => {
      const content = [
        '# Agent',
        '<!-- TEMPLATE: model-choice {"model": "opus", "reason_1": "Complex reasoning", "reason_2": "Multi-step analysis", "reason_3": "Architecture decisions"} -->',
        'old content here',
        '<!-- /TEMPLATE -->',
        'footer'
      ].join('\n');

      withTempAgentFile('_test-subst.md', content, (filePath) => {
        const result = expandTemplates.main([]);
        expect(result.changed).toBe(true);

        const expanded = fs.readFileSync(filePath, 'utf8');
        expect(expanded).toContain('Uses **opus** model because:');
        expect(expanded).toContain('- Complex reasoning');
        expect(expanded).toContain('- Multi-step analysis');
        expect(expanded).toContain('- Architecture decisions');
        // Markers still present
        expect(expanded).toContain('<!-- TEMPLATE: model-choice');
        expect(expanded).toContain('<!-- /TEMPLATE -->');
        // Footer preserved
        expect(expanded).toContain('footer');
      });
    });

    test('throws on missing variable in snippet', () => {
      const content = [
        '<!-- TEMPLATE: model-choice {"model": "opus"} -->',
        'old',
        '<!-- /TEMPLATE -->'
      ].join('\n');

      withTempAgentFile('_test-missing-var.md', content, () => {
        expect(() => expandTemplates.main([])).toThrow(/Missing variable \{\{reason_1\}\} in snippet model-choice/);
      });
    });
  });

  describe('snippet loading', () => {
    test('throws on unknown snippet name', () => {
      const content = [
        '<!-- TEMPLATE: nonexistent-snippet {"a": "b"} -->',
        'old',
        '<!-- /TEMPLATE -->'
      ].join('\n');

      withTempAgentFile('_test-unknown-snippet.md', content, () => {
        expect(() => expandTemplates.main([])).toThrow(/Snippet not found: nonexistent-snippet/);
      });
    });

    test('throws on invalid JSON in marker', () => {
      const content = [
        '<!-- TEMPLATE: model-choice {invalid json} -->',
        'old',
        '<!-- /TEMPLATE -->'
      ].join('\n');

      withTempAgentFile('_test-bad-json.md', content, () => {
        expect(() => expandTemplates.main([])).toThrow(/Invalid JSON in TEMPLATE marker/);
      });
    });

    test('throws on missing closing marker', () => {
      const content = [
        '<!-- TEMPLATE: model-choice {"model": "opus", "reason_1": "a", "reason_2": "b", "reason_3": "c"} -->',
        'old content without closing marker'
      ].join('\n');

      withTempAgentFile('_test-no-close.md', content, () => {
        expect(() => expandTemplates.main([])).toThrow(/Missing closing <!-- \/TEMPLATE --> marker/);
      });
    });
  });

  describe('files without markers', () => {
    test('files without TEMPLATE markers are unchanged', () => {
      const content = '# Simple Agent\n\nNo template markers here.\n';

      withTempAgentFile('_test-no-markers.md', content, (filePath) => {
        const result = expandTemplates.main([]);
        const after = fs.readFileSync(filePath, 'utf8');
        expect(after).toBe(content);
        // File should not appear in changed list
        expect(result.files.every(f => !f.includes('_test-no-markers.md'))).toBe(true);
      });
    });
  });

  describe('multiple markers', () => {
    test('expands multiple TEMPLATE markers in a single file', () => {
      const content = [
        '# Agent',
        '',
        '<!-- TEMPLATE: model-choice {"model": "sonnet", "reason_1": "Fast", "reason_2": "Efficient", "reason_3": "Reliable"} -->',
        'old model content',
        '<!-- /TEMPLATE -->',
        '',
        'Middle section.',
        '',
        '<!-- TEMPLATE: enhance-integration-points {"command_suffix": "docs"} -->',
        'old integration content',
        '<!-- /TEMPLATE -->',
        '',
        'End.'
      ].join('\n');

      withTempAgentFile('_test-multi.md', content, (filePath) => {
        expandTemplates.main([]);
        const expanded = fs.readFileSync(filePath, 'utf8');

        // First marker expanded
        expect(expanded).toContain('Uses **sonnet** model because:');
        expect(expanded).toContain('- Fast');

        // Second marker expanded
        expect(expanded).toContain('`/enhance:docs` command');
        expect(expanded).toContain('/enhance` master orchestrator');

        // Surrounding content preserved
        expect(expanded).toContain('Middle section.');
        expect(expanded).toContain('End.');
      });
    });
  });

  describe('idempotence', () => {
    test('running expansion twice produces identical output', () => {
      const content = [
        '<!-- TEMPLATE: model-choice {"model": "haiku", "reason_1": "Quick", "reason_2": "Simple", "reason_3": "Mechanical"} -->',
        'placeholder',
        '<!-- /TEMPLATE -->'
      ].join('\n');

      withTempAgentFile('_test-idempotent.md', content, (filePath) => {
        expandTemplates.main([]);
        const firstPass = fs.readFileSync(filePath, 'utf8');

        const result = expandTemplates.main([]);
        const secondPass = fs.readFileSync(filePath, 'utf8');

        expect(secondPass).toBe(firstPass);
        expect(result.changed).toBe(false);
      });
    });
  });

  describe('checkFreshness', () => {
    test('returns fresh when all templates are already expanded', () => {
      const result = expandTemplates.checkFreshness();
      expect(result.status).toBe('fresh');
      expect(result.staleFiles).toEqual([]);
      expect(result.message).toBe('All agent templates are up to date');
    });

    test('returns stale when a file has unexpanded markers', () => {
      const content = [
        '<!-- TEMPLATE: model-choice {"model": "opus", "reason_1": "a", "reason_2": "b", "reason_3": "c"} -->',
        'stale content that differs from expansion',
        '<!-- /TEMPLATE -->'
      ].join('\n');

      withTempAgentFile('_test-stale.md', content, () => {
        const result = expandTemplates.checkFreshness();
        expect(result.status).toBe('stale');
        expect(result.staleFiles.length).toBeGreaterThan(0);
        expect(result.staleFiles.some(f => f.includes('_test-stale.md'))).toBe(true);
      });
    });

    test('returns fresh after expansion', () => {
      const content = [
        '<!-- TEMPLATE: model-choice {"model": "opus", "reason_1": "a", "reason_2": "b", "reason_3": "c"} -->',
        'old',
        '<!-- /TEMPLATE -->'
      ].join('\n');

      withTempAgentFile('_test-fresh-after.md', content, () => {
        expandTemplates.main([]);
        const result = expandTemplates.checkFreshness();
        expect(result.status).toBe('fresh');
      });
    });
  });

  describe('main --check', () => {
    test('returns 0 when all templates are fresh', () => {
      const result = expandTemplates.main(['--check']);
      expect(result).toBe(0);
    });

    test('returns 1 when templates are stale', () => {
      const content = [
        '<!-- TEMPLATE: model-choice {"model": "opus", "reason_1": "a", "reason_2": "b", "reason_3": "c"} -->',
        'stale',
        '<!-- /TEMPLATE -->'
      ].join('\n');

      withTempAgentFile('_test-check-stale.md', content, () => {
        const result = expandTemplates.main(['--check']);
        expect(result).toBe(1);
      });
    });

    test('--check does not modify files', () => {
      const content = [
        '<!-- TEMPLATE: model-choice {"model": "opus", "reason_1": "a", "reason_2": "b", "reason_3": "c"} -->',
        'stale content',
        '<!-- /TEMPLATE -->'
      ].join('\n');

      withTempAgentFile('_test-check-nowrite.md', content, (filePath) => {
        expandTemplates.main(['--check']);
        const after = fs.readFileSync(filePath, 'utf8');
        expect(after).toBe(content);
      });
    });
  });

  describe('main --dry-run', () => {
    test('--dry-run does not write files', () => {
      const content = [
        '<!-- TEMPLATE: model-choice {"model": "opus", "reason_1": "a", "reason_2": "b", "reason_3": "c"} -->',
        'stale content',
        '<!-- /TEMPLATE -->'
      ].join('\n');

      withTempAgentFile('_test-dry-run.md', content, (filePath) => {
        const result = expandTemplates.main(['--dry-run']);
        const after = fs.readFileSync(filePath, 'utf8');
        expect(after).toBe(content);
        expect(result.changed).toBe(true);
        expect(result.files.some(f => f.includes('_test-dry-run.md'))).toBe(true);
      });
    });
  });

  describe('main default mode', () => {
    test('returns result object with changed and files', () => {
      const result = expandTemplates.main([]);
      expect(result).toHaveProperty('changed');
      expect(result).toHaveProperty('files');
      expect(typeof result.changed).toBe('boolean');
      expect(Array.isArray(result.files)).toBe(true);
    });
  });

  describe('real snippet integration', () => {
    test('all snippet files in templates/agent-snippets/ are loadable', () => {
      const snippetFiles = fs.readdirSync(SNIPPETS_DIR).filter(f => f.endsWith('.md'));
      expect(snippetFiles.length).toBeGreaterThan(0);

      for (const file of snippetFiles) {
        const content = fs.readFileSync(path.join(SNIPPETS_DIR, file), 'utf8');
        expect(content.length).toBeGreaterThan(0);
        // Each snippet should have at least one {{variable}}
        expect(content).toMatch(/\{\{\w+\}\}/);
      }
    });

    test('enhance-integration-points snippet expands correctly', () => {
      const content = [
        '# Test',
        '<!-- TEMPLATE: enhance-integration-points {"command_suffix": "agents"} -->',
        'old',
        '<!-- /TEMPLATE -->'
      ].join('\n');

      withTempAgentFile('_test-integration.md', content, (filePath) => {
        expandTemplates.main([]);
        const expanded = fs.readFileSync(filePath, 'utf8');
        expect(expanded).toContain('/enhance:agents');
        expect(expanded).toContain('master orchestrator');
      });
    });

    test('enhance-skill-delegation snippet expands correctly', () => {
      const content = [
        '# Test',
        '<!-- TEMPLATE: enhance-skill-delegation {"file_type": "SKILL.md", "path_default": ".", "skill_name": "enhance-skills"} -->',
        'old',
        '<!-- /TEMPLATE -->'
      ].join('\n');

      withTempAgentFile('_test-delegation.md', content, (filePath) => {
        expandTemplates.main([]);
        const expanded = fs.readFileSync(filePath, 'utf8');
        expect(expanded).toContain('SKILL.md');
        expect(expanded).toContain('enhance-skills');
        expect(expanded).toContain('--fix');
      });
    });
  });
});
