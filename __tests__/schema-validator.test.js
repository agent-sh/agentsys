/**
 * Tests for JSON Schema Validator
 */

const path = require('path');
const { SchemaValidator, validateManifestFile } = require('../lib/schemas/validator');

describe('SchemaValidator', () => {
  describe('validatePluginManifest', () => {
    it('should validate a valid minimal manifest', () => {
      const manifest = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'A test plugin for validation',
        author: {
          name: 'Test Author'
        },
        license: 'MIT'
      };

      const result = SchemaValidator.validatePluginManifest(manifest);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate a full manifest with all optional fields', () => {
      const manifest = {
        name: 'awesome-slash',
        version: '2.4.2',
        description: 'Professional-grade slash commands for Claude Code',
        author: {
          name: 'Avi Fenesh',
          email: '[email protected]',
          url: 'https://github.com/avifenesh'
        },
        homepage: 'https://github.com/avifenesh/awesome-slash',
        repository: 'https://github.com/avifenesh/awesome-slash',
        license: 'MIT',
        keywords: ['workflow', 'automation', 'productivity'],
        minClaudeVersion: '1.0.0',
        dependencies: {
          'other-plugin': '^1.0.0'
        },
        config: {
          setting1: 'value1'
        }
      };

      const result = SchemaValidator.validatePluginManifest(manifest);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject manifest without required name', () => {
      const manifest = {
        version: '1.0.0',
        description: 'A test plugin',
        author: { name: 'Test' },
        license: 'MIT'
      };

      const result = SchemaValidator.validatePluginManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required property: name');
    });

    it('should reject manifest without required version', () => {
      const manifest = {
        name: 'test-plugin',
        description: 'A test plugin',
        author: { name: 'Test' },
        license: 'MIT'
      };

      const result = SchemaValidator.validatePluginManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required property: version');
    });

    it('should reject manifest without required description', () => {
      const manifest = {
        name: 'test-plugin',
        version: '1.0.0',
        author: { name: 'Test' },
        license: 'MIT'
      };

      const result = SchemaValidator.validatePluginManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required property: description');
    });

    it('should reject manifest without required author', () => {
      const manifest = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'A test plugin',
        license: 'MIT'
      };

      const result = SchemaValidator.validatePluginManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required property: author');
    });

    it('should reject manifest without required license', () => {
      const manifest = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'A test plugin',
        author: { name: 'Test' }
      };

      const result = SchemaValidator.validatePluginManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required property: license');
    });

    it('should reject manifest with invalid name pattern', () => {
      const manifest = {
        name: 'Test_Plugin', // Should be kebab-case
        version: '1.0.0',
        description: 'A test plugin',
        author: { name: 'Test' },
        license: 'MIT'
      };

      const result = SchemaValidator.validatePluginManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('pattern'))).toBe(true);
    });

    it('should reject manifest with invalid version pattern', () => {
      const manifest = {
        name: 'test-plugin',
        version: 'v1.0', // Should be X.Y.Z
        description: 'A test plugin',
        author: { name: 'Test' },
        license: 'MIT'
      };

      const result = SchemaValidator.validatePluginManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('pattern'))).toBe(true);
    });

    it('should reject manifest with description too short', () => {
      const manifest = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'Short', // < 10 chars
        author: { name: 'Test' },
        license: 'MIT'
      };

      const result = SchemaValidator.validatePluginManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('too short'))).toBe(true);
    });

    it('should reject manifest with additional properties', () => {
      const manifest = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'A test plugin for validation',
        author: { name: 'Test' },
        license: 'MIT',
        invalidField: 'should not be here'
      };

      const result = SchemaValidator.validatePluginManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unexpected property: invalidField');
    });
  });

  describe('validate', () => {
    it('should validate string type', () => {
      const result = SchemaValidator.validate('hello', { type: 'string' });
      expect(result.valid).toBe(true);
    });

    it('should reject wrong type', () => {
      const result = SchemaValidator.validate(123, { type: 'string' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Expected type string');
    });

    it('should validate minLength constraint', () => {
      const result = SchemaValidator.validate('ab', {
        type: 'string',
        minLength: 5
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('too short'))).toBe(true);
    });

    it('should validate maxLength constraint', () => {
      const result = SchemaValidator.validate('abcdefgh', {
        type: 'string',
        maxLength: 5
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('too long'))).toBe(true);
    });

    it('should validate pattern constraint', () => {
      const result = SchemaValidator.validate('Test_123', {
        type: 'string',
        pattern: '^[a-z0-9-]+$'
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('does not match pattern'))).toBe(true);
    });
  });

  describe('validateManifestFile', () => {
    it('should validate the root plugin.json', () => {
      const manifestPath = path.join(__dirname, '../.claude-plugin/plugin.json');
      const result = validateManifestFile(manifestPath);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.manifest).toBeDefined();
      expect(result.manifest.name).toBe('awesome-slash');
    });

    it('should return error for missing file', () => {
      const result = validateManifestFile('nonexistent.json');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Failed to load manifest');
    });

    it('should return error for invalid JSON', () => {
      const fs = require('fs');
      fs.readFileSync.mockReturnValue('{"name": "test",}'); // Invalid JSON with trailing comma

      const result = validateManifestFile('invalid.json');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Failed to load manifest');
    });
  });

  describe('edge cases', () => {
    it('should handle null input', () => {
      const result = SchemaValidator.validate(null, { type: 'object' });
      expect(result.valid).toBe(false);
    });

    it('should handle undefined input', () => {
      const result = SchemaValidator.validate(undefined, { type: 'object' });
      expect(result.valid).toBe(false);
    });

    it('should handle arrays', () => {
      const result = SchemaValidator.validate(['a', 'b', 'c'], {
        type: 'array',
        minItems: 2,
        maxItems: 5
      });
      expect(result.valid).toBe(true);
    });

    it('should validate uniqueItems constraint', () => {
      const result = SchemaValidator.validate(['a', 'b', 'a'], {
        type: 'array',
        uniqueItems: true
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('duplicate'))).toBe(true);
    });

    it('should handle nested objects', () => {
      const data = {
        name: 'test',
        author: {
          name: 'John'
        }
      };

      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          author: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string' }
            }
          }
        }
      };

      const result = SchemaValidator.validate(data, schema);
      expect(result.valid).toBe(true);
    });
  });
});
