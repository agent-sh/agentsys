/**
 * Tests for lib/schemas/validator.js
 */

const path = require('path');
const { SchemaValidator, validateManifestFile } = require('../lib/schemas/validator');

describe('SchemaValidator', () => {
  describe('validate - type checking', () => {
    test('validates string type', () => {
      const result = SchemaValidator.validate('hello', { type: 'string' });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects wrong type for string', () => {
      const result = SchemaValidator.validate(123, { type: 'string' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Expected type string');
    });

    test('validates number type', () => {
      const result = SchemaValidator.validate(42, { type: 'number' });
      expect(result.valid).toBe(true);
    });

    test('validates boolean type', () => {
      const result = SchemaValidator.validate(true, { type: 'boolean' });
      expect(result.valid).toBe(true);
    });

    test('validates array type', () => {
      const result = SchemaValidator.validate([1, 2, 3], { type: 'array' });
      expect(result.valid).toBe(true);
    });

    test('distinguishes array from object', () => {
      const result = SchemaValidator.validate([1, 2], { type: 'object' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Expected type object, got array');
    });

    test('validates object type', () => {
      const result = SchemaValidator.validate({ key: 'value' }, { type: 'object' });
      expect(result.valid).toBe(true);
    });

    test('handles null correctly', () => {
      const result = SchemaValidator.validate(null, { type: 'null' });
      expect(result.valid).toBe(true);
    });

    test('rejects null for object type', () => {
      const result = SchemaValidator.validate(null, { type: 'object' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Expected type object, got null');
    });
  });

  describe('validate - string validations', () => {
    test('validates minLength', () => {
      const schema = { type: 'string', minLength: 3 };
      expect(SchemaValidator.validate('ab', schema).valid).toBe(false);
      expect(SchemaValidator.validate('abc', schema).valid).toBe(true);
    });

    test('validates maxLength', () => {
      const schema = { type: 'string', maxLength: 5 };
      expect(SchemaValidator.validate('hello', schema).valid).toBe(true);
      expect(SchemaValidator.validate('hello!', schema).valid).toBe(false);
    });

    test('validates pattern', () => {
      const schema = { type: 'string', pattern: '^[a-z]+$' };
      expect(SchemaValidator.validate('hello', schema).valid).toBe(true);
      expect(SchemaValidator.validate('Hello', schema).valid).toBe(false);
    });

    test('error message includes pattern', () => {
      const schema = { type: 'string', pattern: '^[0-9]+$' };
      const result = SchemaValidator.validate('abc', schema);
      expect(result.errors[0]).toContain('does not match pattern');
    });
  });

  describe('validate - array validations', () => {
    test('validates minItems', () => {
      const schema = { type: 'array', minItems: 2 };
      expect(SchemaValidator.validate([1], schema).valid).toBe(false);
      expect(SchemaValidator.validate([1, 2], schema).valid).toBe(true);
    });

    test('validates maxItems', () => {
      const schema = { type: 'array', maxItems: 3 };
      expect(SchemaValidator.validate([1, 2, 3], schema).valid).toBe(true);
      expect(SchemaValidator.validate([1, 2, 3, 4], schema).valid).toBe(false);
    });

    test('validates uniqueItems', () => {
      const schema = { type: 'array', uniqueItems: true };
      expect(SchemaValidator.validate([1, 2, 3], schema).valid).toBe(true);
      expect(SchemaValidator.validate([1, 2, 2], schema).valid).toBe(false);
    });

    test('uniqueItems works with objects', () => {
      const schema = { type: 'array', uniqueItems: true };
      expect(SchemaValidator.validate([{ a: 1 }, { b: 2 }], schema).valid).toBe(true);
      expect(SchemaValidator.validate([{ a: 1 }, { a: 1 }], schema).valid).toBe(false);
    });
  });

  describe('validate - required properties', () => {
    test('validates required properties present', () => {
      const schema = {
        type: 'object',
        required: ['name', 'version']
      };
      const valid = SchemaValidator.validate({ name: 'test', version: '1.0.0' }, schema);
      expect(valid.valid).toBe(true);
    });

    test('rejects missing required properties', () => {
      const schema = {
        type: 'object',
        required: ['name', 'version']
      };
      const result = SchemaValidator.validate({ name: 'test' }, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Missing required property: version');
    });
  });

  describe('validate - properties', () => {
    test('validates nested properties', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          count: { type: 'number' }
        }
      };
      const valid = SchemaValidator.validate({ name: 'test', count: 5 }, schema);
      expect(valid.valid).toBe(true);
    });

    test('rejects invalid property type', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      };
      const result = SchemaValidator.validate({ name: 123 }, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('expected type string');
    });

    test('skips validation for absent optional properties', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          optional: { type: 'number' }
        }
      };
      const result = SchemaValidator.validate({ name: 'test' }, schema);
      expect(result.valid).toBe(true);
    });
  });

  describe('validate - additionalProperties', () => {
    test('rejects additional properties when false', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        additionalProperties: false
      };
      const result = SchemaValidator.validate({ name: 'test', extra: 'value' }, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Unexpected property: extra');
    });

    test('allows additional properties by default', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      };
      const result = SchemaValidator.validate({ name: 'test', extra: 'value' }, schema);
      expect(result.valid).toBe(true);
    });

    test('honors patternProperties', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        patternProperties: {
          '^x-': { type: 'string' }
        },
        additionalProperties: false
      };
      const result = SchemaValidator.validate({ name: 'test', 'x-custom': 'value' }, schema);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateProperty', () => {
    test('validates string property with constraints', () => {
      const schema = { type: 'string', minLength: 2, maxLength: 10 };
      expect(SchemaValidator.validateProperty('ab', schema, 'field').valid).toBe(true);
      expect(SchemaValidator.validateProperty('a', schema, 'field').valid).toBe(false);
    });

    test('validates string property maxLength constraint', () => {
      const schema = { type: 'string', maxLength: 5 };
      const result = SchemaValidator.validateProperty('toolong', schema, 'field');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('string too long');
      expect(result.errors[0]).toContain('max 5');
    });

    test('validates string property pattern constraint', () => {
      const schema = { type: 'string', pattern: '^[a-z]+$' };
      const result = SchemaValidator.validateProperty('ABC123', schema, 'field');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('does not match pattern');
    });

    test('validates array property with constraints', () => {
      const schema = { type: 'array', minItems: 1 };
      expect(SchemaValidator.validateProperty([1], schema, 'items').valid).toBe(true);
      expect(SchemaValidator.validateProperty([], schema, 'items').valid).toBe(false);
    });

    test('validates array property maxItems constraint', () => {
      const schema = { type: 'array', maxItems: 2 };
      const result = SchemaValidator.validateProperty([1, 2, 3], schema, 'items');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('array too long');
      expect(result.errors[0]).toContain('max 2');
    });

    test('validates array property uniqueItems constraint', () => {
      const schema = { type: 'array', uniqueItems: true };
      const result = SchemaValidator.validateProperty([1, 2, 2], schema, 'items');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('duplicate items not allowed');
    });

    test('validates nested object property', () => {
      const schema = {
        type: 'object',
        properties: {
          nested: { type: 'string' }
        }
      };
      const result = SchemaValidator.validateProperty({ nested: 'value' }, schema, 'obj');
      expect(result.valid).toBe(true);
    });

    test('validates nested object property with errors', () => {
      const schema = {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' }
        }
      };
      const result = SchemaValidator.validateProperty({}, schema, 'config');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('config.');
      expect(result.errors[0]).toContain('Missing required property: name');
    });

    test('includes path in error messages', () => {
      const schema = { type: 'string' };
      const result = SchemaValidator.validateProperty(123, schema, 'myField');
      expect(result.errors[0]).toContain('myField');
    });
  });

  describe('loadSchema', () => {
    test('loads valid JSON schema from file', () => {
      const fs = require('fs');
      const tempPath = path.join(__dirname, 'temp-schema.json');
      const testSchema = { type: 'object', properties: { name: { type: 'string' } } };
      fs.writeFileSync(tempPath, JSON.stringify(testSchema));
      try {
        const schema = SchemaValidator.loadSchema(tempPath);
        expect(schema).toEqual(testSchema);
      } finally {
        fs.unlinkSync(tempPath);
      }
    });

    test('throws on invalid path', () => {
      expect(() => {
        SchemaValidator.loadSchema('/nonexistent/path.json');
      }).toThrow();
    });
  });

  // Note: validatePluginManifest requires plugin-manifest.schema.json which may not exist
  // These tests use a mock schema instead
  describe('validatePluginManifest-like behavior', () => {
    test('validates object with custom schema', () => {
      const schema = {
        type: 'object',
        required: ['name', 'version'],
        properties: {
          name: { type: 'string' },
          version: { type: 'string' }
        }
      };
      const manifest = { name: 'test-plugin', version: '1.0.0' };
      const result = SchemaValidator.validate(manifest, schema);
      expect(result.valid).toBe(true);
    });

    test('rejects manifest missing required fields', () => {
      const schema = {
        type: 'object',
        required: ['name', 'version'],
        properties: {
          name: { type: 'string' },
          version: { type: 'string' }
        }
      };
      const manifest = { name: 'test-plugin' };
      const result = SchemaValidator.validate(manifest, schema);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('version'))).toBe(true);
    });
  });
});

describe('validateManifestFile', () => {
  // Skip schema-dependent test if schema file doesn't exist
  const schemaPath = path.join(__dirname, '..', 'lib', 'schemas', 'plugin-manifest.schema.json');
  const schemaExists = require('fs').existsSync(schemaPath);

  (schemaExists ? test : test.skip)('validates existing manifest file', () => {
    const manifestPath = path.join(__dirname, '..', '.claude-plugin', 'plugin.json');
    const result = validateManifestFile(manifestPath);
    expect(result.valid).toBe(true);
    expect(result.manifest).toBeDefined();
    expect(result.manifest.name).toBe('agentsys');
  });

  test('returns error for nonexistent file', () => {
    const result = validateManifestFile('/nonexistent/plugin.json');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Failed to load manifest');
  });

  test('returns error for invalid JSON', () => {
    const fs = require('fs');
    const tempPath = path.join(__dirname, 'temp-invalid.json');
    fs.writeFileSync(tempPath, '{ invalid json }');
    try {
      const result = validateManifestFile(tempPath);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Failed to load manifest');
    } finally {
      fs.unlinkSync(tempPath);
    }
  });
});

describe('Edge cases and boundary conditions', () => {
  describe('validate - schema without type', () => {
    test('validates data when no type specified', () => {
      const schema = { properties: { name: { type: 'string' } } };
      const result = SchemaValidator.validate({ name: 'test' }, schema);
      expect(result.valid).toBe(true);
    });

    test('validates required without type check', () => {
      const schema = { required: ['name'] };
      const result = SchemaValidator.validate({ name: 'test' }, schema);
      expect(result.valid).toBe(true);
    });
  });

  describe('validate - empty schemas', () => {
    test('empty schema accepts any value', () => {
      const schema = {};
      expect(SchemaValidator.validate('string', schema).valid).toBe(true);
      expect(SchemaValidator.validate(42, schema).valid).toBe(true);
      expect(SchemaValidator.validate(null, schema).valid).toBe(true);
      expect(SchemaValidator.validate([1, 2], schema).valid).toBe(true);
      expect(SchemaValidator.validate({ key: 'value' }, schema).valid).toBe(true);
    });
  });

  describe('validate - boundary string lengths', () => {
    test('string exactly at minLength passes', () => {
      const schema = { type: 'string', minLength: 5 };
      expect(SchemaValidator.validate('12345', schema).valid).toBe(true);
    });

    test('string exactly at maxLength passes', () => {
      const schema = { type: 'string', maxLength: 5 };
      expect(SchemaValidator.validate('12345', schema).valid).toBe(true);
    });

    test('empty string with minLength 0 passes', () => {
      const schema = { type: 'string', minLength: 0 };
      expect(SchemaValidator.validate('', schema).valid).toBe(true);
    });
  });

  describe('validate - boundary array items', () => {
    test('array exactly at minItems passes', () => {
      const schema = { type: 'array', minItems: 3 };
      expect(SchemaValidator.validate([1, 2, 3], schema).valid).toBe(true);
    });

    test('array exactly at maxItems passes', () => {
      const schema = { type: 'array', maxItems: 3 };
      expect(SchemaValidator.validate([1, 2, 3], schema).valid).toBe(true);
    });

    test('empty array with minItems 0 passes', () => {
      const schema = { type: 'array', minItems: 0 };
      expect(SchemaValidator.validate([], schema).valid).toBe(true);
    });
  });

  describe('validate - uniqueItems edge cases', () => {
    test('single item array always passes uniqueItems', () => {
      const schema = { type: 'array', uniqueItems: true };
      expect(SchemaValidator.validate([1], schema).valid).toBe(true);
    });

    test('empty array passes uniqueItems', () => {
      const schema = { type: 'array', uniqueItems: true };
      expect(SchemaValidator.validate([], schema).valid).toBe(true);
    });

    test('uniqueItems with null values', () => {
      const schema = { type: 'array', uniqueItems: true };
      expect(SchemaValidator.validate([null, 1], schema).valid).toBe(true);
      expect(SchemaValidator.validate([null, null], schema).valid).toBe(false);
    });

    test('uniqueItems with nested arrays', () => {
      const schema = { type: 'array', uniqueItems: true };
      expect(SchemaValidator.validate([[1, 2], [3, 4]], schema).valid).toBe(true);
      expect(SchemaValidator.validate([[1, 2], [1, 2]], schema).valid).toBe(false);
    });
  });

  describe('validate - complex patterns', () => {
    test('validates complex regex pattern', () => {
      const schema = { type: 'string', pattern: '^v?\\d+\\.\\d+\\.\\d+$' };
      expect(SchemaValidator.validate('1.0.0', schema).valid).toBe(true);
      expect(SchemaValidator.validate('v1.0.0', schema).valid).toBe(true);
      expect(SchemaValidator.validate('1.0', schema).valid).toBe(false);
    });

    test('validates email-like pattern', () => {
      const schema = { type: 'string', pattern: '^[^@]+@[^@]+\\.[^@]+$' };
      expect(SchemaValidator.validate('test@example.com', schema).valid).toBe(true);
      expect(SchemaValidator.validate('invalid-email', schema).valid).toBe(false);
    });
  });

  describe('validate - deeply nested objects', () => {
    test('validates three levels of nesting', () => {
      const schema = {
        type: 'object',
        properties: {
          level1: {
            type: 'object',
            properties: {
              level2: {
                type: 'object',
                properties: {
                  level3: { type: 'string' }
                }
              }
            }
          }
        }
      };
      const data = { level1: { level2: { level3: 'deep' } } };
      expect(SchemaValidator.validate(data, schema).valid).toBe(true);
    });

    test('error in deeply nested object includes full path', () => {
      const schema = {
        type: 'object',
        properties: {
          parent: {
            type: 'object',
            properties: {
              child: { type: 'string' }
            }
          }
        }
      };
      const data = { parent: { child: 123 } };
      const result = SchemaValidator.validate(data, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('parent');
      expect(result.errors[0]).toContain('child');
    });
  });

  describe('validate - multiple errors', () => {
    test('collects multiple required property errors', () => {
      const schema = {
        type: 'object',
        required: ['name', 'version', 'author']
      };
      const result = SchemaValidator.validate({}, schema);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(3);
    });

    test('collects errors from multiple properties', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          count: { type: 'number' }
        }
      };
      const result = SchemaValidator.validate({ name: 123, count: 'not-a-number' }, schema);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(2);
    });
  });

  describe('validate - null handling', () => {
    test('null does not cause crash with required check', () => {
      const schema = { type: 'object', required: ['name'] };
      // This should fail type check, not crash on required
      const result = SchemaValidator.validate(null, schema);
      expect(result.valid).toBe(false);
    });

    test('null does not cause crash with properties check', () => {
      const schema = {
        type: 'object',
        properties: { name: { type: 'string' } }
      };
      const result = SchemaValidator.validate(null, schema);
      expect(result.valid).toBe(false);
    });

    test('null does not cause crash with additionalProperties check', () => {
      const schema = {
        type: 'object',
        additionalProperties: false
      };
      const result = SchemaValidator.validate(null, schema);
      expect(result.valid).toBe(false);
    });
  });

  describe('validate - additionalProperties edge cases', () => {
    test('empty object passes with additionalProperties false', () => {
      const schema = {
        type: 'object',
        properties: {},
        additionalProperties: false
      };
      expect(SchemaValidator.validate({}, schema).valid).toBe(true);
    });

    test('multiple pattern properties work', () => {
      const schema = {
        type: 'object',
        properties: {},
        patternProperties: {
          '^x-': { type: 'string' },
          '^data-': { type: 'string' }
        },
        additionalProperties: false
      };
      const result = SchemaValidator.validate({ 'x-custom': 'a', 'data-id': 'b' }, schema);
      expect(result.valid).toBe(true);
    });

    test('mixed defined and pattern properties', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        patternProperties: {
          '^x-': { type: 'string' }
        },
        additionalProperties: false
      };
      const result = SchemaValidator.validate({ name: 'test', 'x-extra': 'value' }, schema);
      expect(result.valid).toBe(true);
    });

    test('rejects property not matching any pattern', () => {
      const schema = {
        type: 'object',
        properties: {},
        patternProperties: {
          '^x-': { type: 'string' }
        },
        additionalProperties: false
      };
      const result = SchemaValidator.validate({ unknown: 'value' }, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Unexpected property');
    });
  });
});

describe('validatePluginManifest', () => {
  const fs = require('fs');
  const schemaPath = path.join(__dirname, '..', 'lib', 'schemas', 'plugin-manifest.schema.json');
  let schemaCreated = false;

  beforeAll(() => {
    // Create schema file if it doesn't exist
    if (!fs.existsSync(schemaPath)) {
      const testSchema = {
        type: 'object',
        required: ['name', 'version', 'description', 'author', 'license'],
        properties: {
          name: {
            type: 'string',
            pattern: '^[a-z][a-z0-9-]*$',
            minLength: 1
          },
          version: {
            type: 'string',
            pattern: '^\\d+\\.\\d+\\.\\d+$'
          },
          description: {
            type: 'string',
            minLength: 10,
            maxLength: 500
          },
          author: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string' },
              email: { type: 'string' },
              url: { type: 'string' }
            }
          },
          license: { type: 'string' },
          homepage: { type: 'string' },
          repository: { type: 'string' },
          keywords: {
            type: 'array',
            maxItems: 20,
            uniqueItems: true
          }
        }
      };
      fs.writeFileSync(schemaPath, JSON.stringify(testSchema, null, 2));
      schemaCreated = true;
    }
  });

  afterAll(() => {
    // Clean up if we created the schema
    if (schemaCreated && fs.existsSync(schemaPath)) {
      fs.unlinkSync(schemaPath);
    }
  });

  test('validates valid plugin manifest', () => {
    const manifest = {
      name: 'test-plugin',
      version: '1.0.0',
      description: 'A test plugin for validation purposes',
      author: { name: 'Test Author' },
      license: 'MIT'
    };
    const result = SchemaValidator.validatePluginManifest(manifest);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('rejects manifest with invalid name pattern', () => {
    const manifest = {
      name: 'TestPlugin',  // Should be lowercase kebab-case
      version: '1.0.0',
      description: 'A test plugin for validation',
      author: { name: 'Test' },
      license: 'MIT'
    };
    const result = SchemaValidator.validatePluginManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('pattern'))).toBe(true);
  });

  test('rejects manifest with invalid version', () => {
    const manifest = {
      name: 'test-plugin',
      version: 'v1.0',  // Should be X.Y.Z format
      description: 'A test plugin for validation',
      author: { name: 'Test' },
      license: 'MIT'
    };
    const result = SchemaValidator.validatePluginManifest(manifest);
    expect(result.valid).toBe(false);
  });

  test('rejects manifest with missing required fields', () => {
    const manifest = {
      name: 'test-plugin'
    };
    const result = SchemaValidator.validatePluginManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('version'))).toBe(true);
  });

  test('validates manifest with optional fields', () => {
    const manifest = {
      name: 'test-plugin',
      version: '1.0.0',
      description: 'A test plugin for validation purposes',
      author: { name: 'Test', email: 'test@test.com', url: 'https://test.com' },
      license: 'MIT',
      homepage: 'https://example.com',
      repository: 'https://github.com/test/repo',
      keywords: ['test', 'plugin', 'validation']
    };
    const result = SchemaValidator.validatePluginManifest(manifest);
    expect(result.valid).toBe(true);
  });

  test('rejects manifest with duplicate keywords', () => {
    const manifest = {
      name: 'test-plugin',
      version: '1.0.0',
      description: 'A test plugin for validation purposes',
      author: { name: 'Test' },
      license: 'MIT',
      keywords: ['test', 'test']  // Duplicates not allowed
    };
    const result = SchemaValidator.validatePluginManifest(manifest);
    expect(result.valid).toBe(false);
  });
});

describe('validateManifestFile with schema', () => {
  const fs = require('fs');
  const schemaPath = path.join(__dirname, '..', 'lib', 'schemas', 'plugin-manifest.schema.json');
  let schemaCreated = false;

  beforeAll(() => {
    // Create schema file if it doesn't exist
    if (!fs.existsSync(schemaPath)) {
      const testSchema = {
        type: 'object',
        required: ['name', 'version'],
        properties: {
          name: { type: 'string' },
          version: { type: 'string' }
        }
      };
      fs.writeFileSync(schemaPath, JSON.stringify(testSchema, null, 2));
      schemaCreated = true;
    }
  });

  afterAll(() => {
    // Clean up if we created the schema
    if (schemaCreated && fs.existsSync(schemaPath)) {
      fs.unlinkSync(schemaPath);
    }
  });

  test('validates valid manifest file', () => {
    const tempPath = path.join(__dirname, 'temp-valid-manifest.json');
    // Must match all required fields in plugin-manifest.schema.json
    const manifest = {
      name: 'test-plugin',
      version: '1.0.0',
      description: 'A test plugin for validation tests',
      author: { name: 'Test Author' },
      license: 'MIT'
    };
    fs.writeFileSync(tempPath, JSON.stringify(manifest));
    try {
      const result = validateManifestFile(tempPath);
      expect(result.valid).toBe(true);
      expect(result.manifest).toBeDefined();
      expect(result.manifest.name).toBe('test-plugin');
    } finally {
      fs.unlinkSync(tempPath);
    }
  });

  test('returns validation errors for invalid manifest file', () => {
    const tempPath = path.join(__dirname, 'temp-invalid-manifest.json');
    const manifest = { name: 'test-plugin' };  // Missing required version, description, author, license
    fs.writeFileSync(tempPath, JSON.stringify(manifest));
    try {
      const result = validateManifestFile(tempPath);
      expect(result.valid).toBe(false);
      expect(result.manifest).toBeDefined();
      expect(result.errors.some(e => e.includes('version'))).toBe(true);
    } finally {
      fs.unlinkSync(tempPath);
    }
  });
});

describe('validateProperty - additional edge cases', () => {
  test('validates combined string constraints', () => {
    const schema = { type: 'string', minLength: 3, maxLength: 10, pattern: '^[a-z]+$' };
    expect(SchemaValidator.validateProperty('hello', schema, 'field').valid).toBe(true);
    expect(SchemaValidator.validateProperty('hi', schema, 'field').valid).toBe(false);
    expect(SchemaValidator.validateProperty('verylongstring', schema, 'field').valid).toBe(false);
    expect(SchemaValidator.validateProperty('Hello', schema, 'field').valid).toBe(false);
  });

  test('validates combined array constraints', () => {
    const schema = { type: 'array', minItems: 2, maxItems: 5, uniqueItems: true };
    expect(SchemaValidator.validateProperty([1, 2, 3], schema, 'items').valid).toBe(true);
    expect(SchemaValidator.validateProperty([1], schema, 'items').valid).toBe(false);
    expect(SchemaValidator.validateProperty([1, 2, 3, 4, 5, 6], schema, 'items').valid).toBe(false);
    expect(SchemaValidator.validateProperty([1, 2, 2], schema, 'items').valid).toBe(false);
  });

  test('returns early on type mismatch', () => {
    const schema = { type: 'string', minLength: 5 };
    const result = SchemaValidator.validateProperty(123, schema, 'field');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain('expected type string');
  });

  test('handles array type detection correctly', () => {
    const schema = { type: 'array' };
    const arrResult = SchemaValidator.validateProperty([1, 2], schema, 'field');
    expect(arrResult.valid).toBe(true);

    const objResult = SchemaValidator.validateProperty({ length: 2 }, schema, 'field');
    expect(objResult.valid).toBe(false);
  });
});

describe('CLI usage', () => {
  const { execSync, spawnSync } = require('child_process');
  const fs = require('fs');
  const validatorPath = path.join(__dirname, '..', 'lib', 'schemas', 'validator.js');
  const schemaPath = path.join(__dirname, '..', 'lib', 'schemas', 'plugin-manifest.schema.json');
  let schemaCreated = false;

  beforeAll(() => {
    // Create schema file if it doesn't exist
    if (!fs.existsSync(schemaPath)) {
      const testSchema = {
        type: 'object',
        required: ['name', 'version', 'description', 'author', 'license'],
        properties: {
          name: { type: 'string' },
          version: { type: 'string' },
          description: { type: 'string' },
          author: {
            type: 'object',
            required: ['name'],
            properties: { name: { type: 'string' } }
          },
          license: { type: 'string' }
        }
      };
      fs.writeFileSync(schemaPath, JSON.stringify(testSchema, null, 2));
      schemaCreated = true;
    }
  });

  afterAll(() => {
    if (schemaCreated && fs.existsSync(schemaPath)) {
      fs.unlinkSync(schemaPath);
    }
  });

  test('CLI exits with 0 for valid manifest', () => {
    const tempPath = path.join(__dirname, 'temp-cli-valid.json');
    const manifest = {
      name: 'test-plugin',
      version: '1.0.0',
      description: 'A valid test manifest',
      author: { name: 'Test' },
      license: 'MIT'
    };
    fs.writeFileSync(tempPath, JSON.stringify(manifest));
    try {
      const result = spawnSync('node', [validatorPath, tempPath], { encoding: 'utf8' });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('[OK]');
      expect(result.stdout).toContain('test-plugin');
    } finally {
      fs.unlinkSync(tempPath);
    }
  });

  test('CLI exits with 1 for invalid manifest', () => {
    const tempPath = path.join(__dirname, 'temp-cli-invalid.json');
    const manifest = { name: 'test' };  // Missing required fields
    fs.writeFileSync(tempPath, JSON.stringify(manifest));
    try {
      const result = spawnSync('node', [validatorPath, tempPath], { encoding: 'utf8' });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('[ERROR]');
    } finally {
      fs.unlinkSync(tempPath);
    }
  });

  test('CLI exits with 1 for nonexistent file', () => {
    const result = spawnSync('node', [validatorPath, '/nonexistent/path.json'], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('[ERROR]');
  });

  test('CLI uses default path when no argument provided', () => {
    // This will fail because default path doesn't exist, but tests the code path
    const result = spawnSync('node', [validatorPath], {
      encoding: 'utf8',
      cwd: __dirname  // Use test directory where plugin.json won't exist
    });
    // Should fail since .claude-plugin/plugin.json won't exist in test dir
    expect(result.status).toBe(1);
  });

  test('CLI shows plugin info for valid manifest', () => {
    const tempPath = path.join(__dirname, 'temp-cli-info.json');
    const manifest = {
      name: 'my-plugin',
      version: '2.5.0',
      description: 'A test plugin',
      author: { name: 'Jane Doe' },
      license: 'MIT'
    };
    fs.writeFileSync(tempPath, JSON.stringify(manifest));
    try {
      const result = spawnSync('node', [validatorPath, tempPath], { encoding: 'utf8' });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Plugin: my-plugin v2.5.0');
      expect(result.stdout).toContain('Author: Jane Doe');
    } finally {
      fs.unlinkSync(tempPath);
    }
  });

  test('CLI shows all validation errors', () => {
    const tempPath = path.join(__dirname, 'temp-cli-errors.json');
    const manifest = {};  // Missing all required fields
    fs.writeFileSync(tempPath, JSON.stringify(manifest));
    try {
      const result = spawnSync('node', [validatorPath, tempPath], { encoding: 'utf8' });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('name');
      expect(result.stderr).toContain('version');
    } finally {
      fs.unlinkSync(tempPath);
    }
  });
});
