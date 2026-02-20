/**
 * DocCache spec — tests for app/javascript/modules/doc_cache.js
 *
 * Run with: bin/docker r yarn test
 *
 * Uses Vitest (Jest-compatible API). ES modules are imported directly; no
 * build step or window exposure required.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { docCache } from 'modules/doc_cache';

function createMockResolver(docs) {
  return {
    createResolver(ids, _settings, _chunkSize) {
      return {
        docs: docs || ids.map((id) => ({ id: String(id) })),
        fetchDocs() {
          return Promise.resolve();
        },
      };
    },
  };
}

describe('DocCache', () => {
  beforeEach(() => {
    docCache.empty();
  });

  it('addIds registers ids without fetching', () => {
    docCache.addIds(['1', '2', '3']);
    expect(docCache.hasDoc('1')).toBe(false);
    expect(docCache.knowsDoc('1')).toBe(true);
    expect(docCache.getDoc('1')).toBe(null);
  });

  it('addIds with null/undefined is a no-op', () => {
    expect(() => {
      docCache.addIds(null);
      docCache.addIds(undefined);
    }).not.toThrow();
  });

  it('update fetches and populates cache', async () => {
    const resolver = createMockResolver([{ id: '1' }, { id: '2' }, { id: '3' }]);
    docCache.addIds(['1', '2', '3']);
    await docCache.update({ proxyRequests: false }, resolver);
    expect(docCache.getDoc('1').id).toBe('1');
    expect(docCache.getDoc('2').id).toBe('2');
    expect(docCache.getDoc('3').id).toBe('3');
  });

  it('invalidate marks entries stale', async () => {
    const resolver = createMockResolver([{ id: '1' }]);
    docCache.addIds(['1']);
    await docCache.update({ proxyRequests: false }, resolver);
    expect(docCache.hasDoc('1')).toBe(true);
    docCache.invalidate();
    expect(docCache.hasDoc('1')).toBe(false);
    expect(docCache.knowsDoc('1')).toBe(true);
  });

  it('empty clears all entries', () => {
    docCache.addIds(['1', '2']);
    docCache.empty();
    expect(docCache.knowsDoc('1')).toBe(false);
    expect(docCache.knowsDoc('2')).toBe(false);
  });
});
