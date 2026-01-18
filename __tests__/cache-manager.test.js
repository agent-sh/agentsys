/**
 * Tests for CacheManager
 */

const { CacheManager } = require('../lib/utils/cache-manager');

describe('CacheManager', () => {
  let cache;

  beforeEach(() => {
    cache = new CacheManager({ maxSize: 3, ttl: 100 });
  });

  describe('constructor', () => {
    it('should create cache with default options', () => {
      const defaultCache = new CacheManager();
      expect(defaultCache.maxSize).toBe(100);
      expect(defaultCache.ttl).toBe(60000);
      expect(defaultCache.maxValueSize).toBeNull();
    });

    it('should create cache with custom options', () => {
      const customCache = new CacheManager({
        maxSize: 50,
        ttl: 5000,
        maxValueSize: 1024
      });
      expect(customCache.maxSize).toBe(50);
      expect(customCache.ttl).toBe(5000);
      expect(customCache.maxValueSize).toBe(1024);
    });
  });

  describe('set and get', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should overwrite existing values', () => {
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');
      expect(cache.get('key1')).toBe('value2');
    });

    it('should handle different value types', () => {
      cache.set('string', 'hello');
      cache.set('number', 42);
      cache.set('object', { foo: 'bar' });
      cache.set('array', [1, 2, 3]);
      cache.set('null', null);

      expect(cache.get('string')).toBe('hello');
      expect(cache.get('number')).toBe(42);
      expect(cache.get('object')).toEqual({ foo: 'bar' });
      expect(cache.get('array')).toEqual([1, 2, 3]);
      expect(cache.get('null')).toBeNull();
    });
  });

  describe('TTL (time-to-live)', () => {
    it('should return undefined for expired entries', (done) => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');

      // Wait for TTL to expire
      setTimeout(() => {
        expect(cache.get('key1')).toBeUndefined();
        done();
      }, 150); // TTL is 100ms
    }, 200);

    it('should refresh timestamp on set', (done) => {
      cache.set('key1', 'value1');

      setTimeout(() => {
        cache.set('key1', 'value2'); // Refresh
        expect(cache.get('key1')).toBe('value2');

        setTimeout(() => {
          expect(cache.get('key1')).toBe('value2'); // Still valid
          done();
        }, 50);
      }, 60);
    }, 200);
  });

  describe('maxSize enforcement (FIFO eviction)', () => {
    it('should evict oldest entry when maxSize exceeded', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4'); // Should evict key1

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });

    it('should maintain FIFO order across multiple evictions', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4'); // Evicts key1
      cache.set('key5', 'value5'); // Evicts key2

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
      expect(cache.get('key5')).toBe('value5');
    });
  });

  describe('maxValueSize enforcement', () => {
    it('should reject values exceeding maxValueSize', () => {
      const sizedCache = new CacheManager({ maxValueSize: 10 });
      const result = sizedCache.set('key1', '12345678901'); // 11 chars
      expect(result).toBe(false);
      expect(sizedCache.get('key1')).toBeUndefined();
    });

    it('should accept values within maxValueSize', () => {
      const sizedCache = new CacheManager({ maxValueSize: 10 });
      const result = sizedCache.set('key1', '1234567890'); // 10 chars
      expect(result).toBe(true);
      expect(sizedCache.get('key1')).toBe('1234567890');
    });

    it('should only enforce maxValueSize for strings', () => {
      const sizedCache = new CacheManager({ maxValueSize: 10 });
      const largeObject = { data: 'x'.repeat(100) };
      const result = sizedCache.set('key1', largeObject);
      expect(result).toBe(true); // Objects not size-checked
      expect(sizedCache.get('key1')).toEqual(largeObject);
    });
  });

  describe('has', () => {
    it('should return true for existing non-expired keys', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
    });

    it('should return false for non-existent keys', () => {
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should return false for expired keys', (done) => {
      cache.set('key1', 'value1');
      setTimeout(() => {
        expect(cache.has('key1')).toBe(false);
        done();
      }, 150);
    }, 200);
  });

  describe('delete', () => {
    it('should remove entries and return true', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should return false for non-existent keys', () => {
      expect(cache.delete('nonexistent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      cache.clear();

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.get('key3')).toBeUndefined();
      expect(cache.size).toBe(0);
    });
  });

  describe('size', () => {
    it('should return current number of entries', () => {
      expect(cache.size).toBe(0);
      cache.set('key1', 'value1');
      expect(cache.size).toBe(1);
      cache.set('key2', 'value2');
      expect(cache.size).toBe(2);
      cache.delete('key1');
      expect(cache.size).toBe(1);
    });

    it('should not exceed maxSize', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4');
      expect(cache.size).toBe(3); // maxSize is 3
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(3);
      expect(stats.ttl).toBe(100);
      expect(stats.maxValueSize).toBeNull();
    });
  });

  describe('prune', () => {
    it('should remove expired entries and return count', (done) => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      setTimeout(() => {
        cache.set('key3', 'value3'); // Fresh entry
        const removed = cache.prune();

        expect(removed).toBe(2); // key1 and key2 expired
        expect(cache.get('key1')).toBeUndefined();
        expect(cache.get('key2')).toBeUndefined();
        expect(cache.get('key3')).toBe('value3');
        done();
      }, 150);
    }, 200);

    it('should return 0 when no expired entries', () => {
      cache.set('key1', 'value1');
      const removed = cache.prune();
      expect(removed).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string keys', () => {
      cache.set('', 'empty key');
      expect(cache.get('')).toBe('empty key');
    });

    it('should handle empty string values', () => {
      cache.set('key1', '');
      expect(cache.get('key1')).toBe('');
    });

    it('should distinguish between null and undefined', () => {
      cache.set('null', null);
      expect(cache.get('null')).toBeNull();
      expect(cache.get('undefined')).toBeUndefined();
    });
  });

  describe('concurrent operations', () => {
    it('should handle rapid set operations', () => {
      for (let i = 0; i < 100; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      // Should only keep last 3 (maxSize = 3)
      expect(cache.size).toBe(3);
      expect(cache.get('key97')).toBe('value97');
      expect(cache.get('key98')).toBe('value98');
      expect(cache.get('key99')).toBe('value99');
    });
  });
});
