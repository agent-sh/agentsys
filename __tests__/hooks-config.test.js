const fs = require('fs');
const path = require('path');

describe('hooks configuration', () => {
  const nextTaskDir = path.join(__dirname, '..', 'plugins', 'next-task');
  const hooksPath = path.join(nextTaskDir, 'hooks', 'hooks.json');

  describe('hooks.json validity', () => {
    let hooks;

    beforeAll(() => {
      hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));
    });

    test('is valid JSON', () => {
      expect(hooks).toBeDefined();
      expect(typeof hooks).toBe('object');
    });

    test('has expected hook types', () => {
      // Check for common hook types - hooks are nested under 'hooks' property
      expect(hooks).toHaveProperty('hooks');
      expect(hooks.hooks).toHaveProperty('SubagentStop');
    });
  });

  describe('SubagentStop hook', () => {
    let hooks;
    let content;

    beforeAll(() => {
      content = fs.readFileSync(hooksPath, 'utf8');
      hooks = JSON.parse(content);
    });

    test('references sync-docs:sync-docs-agent', () => {
      expect(content).toContain('sync-docs:sync-docs-agent');
    });

    test('does not reference removed docs-updater', () => {
      // Should not have "docs-updater" as a standalone agent reference
      // May have it in historical context or comments
      const lines = content.split('\n');
      lines.forEach(line => {
        // Skip comments
        if (!line.trim().startsWith('//')) {
          // Check for standalone agent reference pattern
          if (line.includes('"docs-updater"') || line.includes("'docs-updater'")) {
            // This should not happen
            expect(line).not.toMatch(/["']docs-updater["']/);
          }
        }
      });
    });
  });

  describe('workflow sequence in hooks', () => {
    let content;

    beforeAll(() => {
      content = fs.readFileSync(hooksPath, 'utf8');
    });

    test('workflow mentions Phase 11 docs update', () => {
      // The hook should reference docs update in workflow
      expect(content.toLowerCase()).toMatch(/doc/);
    });

    test('workflow uses correct agent for docs', () => {
      expect(content).toContain('sync-docs');
    });
  });

  describe('hook file structure', () => {
    test('hooks.json exists', () => {
      expect(fs.existsSync(hooksPath)).toBe(true);
    });

    test('hooks directory exists', () => {
      const hooksDir = path.join(nextTaskDir, 'hooks');
      expect(fs.existsSync(hooksDir)).toBe(true);
    });
  });

  describe('all plugin hooks directories', () => {
    const pluginsDir = path.join(__dirname, '..', 'plugins');
    const plugins = fs.readdirSync(pluginsDir).filter(f =>
      fs.statSync(path.join(pluginsDir, f)).isDirectory()
    );

    plugins.forEach(plugin => {
      const hooksDir = path.join(pluginsDir, plugin, 'hooks');

      if (fs.existsSync(hooksDir)) {
        test(`${plugin}/hooks has valid JSON files`, () => {
          const hookFiles = fs.readdirSync(hooksDir).filter(f => f.endsWith('.json'));
          hookFiles.forEach(hookFile => {
            const hookPath = path.join(hooksDir, hookFile);
            expect(() => JSON.parse(fs.readFileSync(hookPath, 'utf8'))).not.toThrow();
          });
        });
      }
    });
  });
});
