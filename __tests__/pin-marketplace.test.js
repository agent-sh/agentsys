'use strict';

const {
  parseOrgRepo,
  resolveTagSha,
  pinPlugin,
  setGhRunner,
} = require('../scripts/pin-marketplace.js');

afterEach(() => {
  setGhRunner(null); // reset to default
});

describe('parseOrgRepo', () => {
  test.each([
    ['https://github.com/agent-sh/foo.git', 'agent-sh', 'foo'],
    ['https://github.com/agent-sh/foo', 'agent-sh', 'foo'],
    ['https://github.com/agent-sh/foo/', 'agent-sh', 'foo'],
    ['https://github.com/agent-sh/foo.git/', 'agent-sh', 'foo'],
    ['git@github.com:agent-sh/foo.git', 'agent-sh', 'foo'],
    ['https://github.com/agent-sh/next-task.git', 'agent-sh', 'next-task'],
  ])('parses %s', (url, owner, repo) => {
    expect(parseOrgRepo(url)).toEqual({ owner, repo });
  });

  test('throws on non-github urls', () => {
    expect(() => parseOrgRepo('https://example.com/foo/bar')).toThrow(
      /Cannot parse/,
    );
  });
});

describe('resolveTagSha', () => {
  test('returns sha for lightweight tag', () => {
    setGhRunner((args) => {
      expect(args).toEqual([
        'api',
        'repos/owner/repo/git/ref/tags/v1.0.0',
      ]);
      return JSON.stringify({
        ref: 'refs/tags/v1.0.0',
        object: { type: 'commit', sha: 'deadbeef' },
      });
    });
    expect(resolveTagSha('owner', 'repo', 'v1.0.0')).toBe('deadbeef');
  });

  test('derefs annotated tag to commit sha', () => {
    const calls = [];
    setGhRunner((args) => {
      calls.push(args);
      if (args[1] === 'repos/owner/repo/git/ref/tags/v2.0.0') {
        return JSON.stringify({
          object: { type: 'tag', sha: 'tagobj' },
        });
      }
      if (args[1] === 'repos/owner/repo/git/tags/tagobj') {
        return JSON.stringify({ object: { sha: 'realcommit' } });
      }
      throw new Error(`unexpected ${args.join(' ')}`);
    });
    expect(resolveTagSha('owner', 'repo', 'v2.0.0')).toBe('realcommit');
    expect(calls).toHaveLength(2);
  });

  test('returns null on 404', () => {
    setGhRunner(() => {
      const err = new Error('gh api failed: Not Found');
      err.stderr = 'HTTP 404: Not Found';
      throw err;
    });
    expect(resolveTagSha('owner', 'repo', 'vnope')).toBeNull();
  });

  test('rejects ambiguous array response', () => {
    setGhRunner(() =>
      JSON.stringify([
        { ref: 'refs/tags/v1.0.0', object: { sha: 'a' } },
        { ref: 'refs/tags/v1.0.0-rc1', object: { sha: 'b' } },
      ]),
    );
    expect(() => resolveTagSha('owner', 'repo', 'v1.0.0')).toThrow(
      /Ambiguous tag lookup/,
    );
  });
});

describe('pinPlugin fallback behavior', () => {
  test('pins tag+commit when tag resolves', () => {
    setGhRunner(() =>
      JSON.stringify({
        object: { type: 'commit', sha: 'abc123' },
      }),
    );
    const plugin = {
      name: 'x',
      version: '1.2.3',
      source: { source: 'url', url: 'https://github.com/agent-sh/x.git' },
    };
    const result = pinPlugin(plugin);
    expect(result.status).toBe('pinned');
    expect(plugin.source.ref).toBe('v1.2.3');
    expect(plugin.source.commit).toBe('abc123');
  });

  test('fallback clears stale ref from a previous pin', () => {
    // Simulate: previous run pinned `v0.9.0` successfully; the new run has
    // no matching tag (returns 404) and must clear the stale ref before
    // setting the commit.
    let call = 0;
    setGhRunner((args) => {
      call += 1;
      if (call === 1) {
        const err = new Error('not found');
        err.stderr = '404 Not Found';
        throw err;
      }
      // defaultBranchHeadSha
      expect(args[1]).toBe('repos/agent-sh/x/commits/HEAD');
      return 'newheadsha';
    });
    const plugin = {
      name: 'x',
      version: '1.0.0',
      source: {
        source: 'url',
        url: 'https://github.com/agent-sh/x.git',
        ref: 'v0.9.0',      // stale
        commit: 'oldsha',   // stale
      },
    };
    const result = pinPlugin(plugin);
    expect(result.status).toBe('fallback');
    expect(plugin.source.ref).toBeUndefined();
    expect(plugin.source.commit).toBe('newheadsha');
  });

  test('skips non-url plugins', () => {
    const plugin = {
      name: 'local',
      version: '1.0.0',
      source: { source: 'path', path: './plugins/local' },
    };
    // No gh runner invocation expected.
    setGhRunner(() => {
      throw new Error('should not be called');
    });
    expect(pinPlugin(plugin).status).toBe('skipped');
  });
});
