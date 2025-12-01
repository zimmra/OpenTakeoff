/**
 * Pagination Utilities Tests
 * Unit tests for RFC5988 Link header building and query parameter extraction
 */

import { describe, it, expect } from 'vitest';
import { buildLinkHeader, extractQueryParams } from './pagination.js';

describe('Pagination Utilities', () => {
  describe('buildLinkHeader', () => {
    it('should return null when nextCursor is null', () => {
      const result = buildLinkHeader('/api/projects', { limit: 10 }, null);

      expect(result).toBeNull();
    });

    it('should build correct Link header with cursor', () => {
      const result = buildLinkHeader('/api/projects', { limit: 10 }, 'abc123');

      expect(result).toBe('</api/projects?limit=10&cursor=abc123>; rel="next"');
    });

    it('should include all params except existing cursor', () => {
      const params = {
        limit: 20,
        cursor: 'old-cursor', // This should be replaced
        filter: 'active',
      };

      const result = buildLinkHeader('/api/items', params, 'new-cursor');

      expect(result).toBe('</api/items?limit=20&filter=active&cursor=new-cursor>; rel="next"');
      expect(result).not.toContain('old-cursor');
    });

    it('should handle empty params object', () => {
      const result = buildLinkHeader('/api/data', {}, 'cursor123');

      expect(result).toBe('</api/data?cursor=cursor123>; rel="next"');
    });

    it('should skip undefined values in params', () => {
      const params = {
        limit: 10,
        filter: undefined,
        sort: 'name',
      };

      const result = buildLinkHeader('/api/items', params, 'xyz');

      expect(result).toBe('</api/items?limit=10&sort=name&cursor=xyz>; rel="next"');
      expect(result).not.toContain('filter');
    });

    it('should handle numeric values correctly', () => {
      const params = {
        limit: 50,
        page: 2,
      };

      const result = buildLinkHeader('/api/data', params, 'cursor');

      expect(result).toBe('</api/data?limit=50&page=2&cursor=cursor>; rel="next"');
    });

    it('should handle URL paths with special characters', () => {
      const result = buildLinkHeader('/api/projects/proj-123/plans', { limit: 5 }, 'abc');

      expect(result).toBe('</api/projects/proj-123/plans?limit=5&cursor=abc>; rel="next"');
    });

    it('should properly encode cursor with special characters', () => {
      const result = buildLinkHeader('/api/data', { limit: 10 }, 'id=123&foo=bar');

      // URLSearchParams will encode special characters
      expect(result).toContain('cursor=id%3D123%26foo%3Dbar');
    });

    it('should handle base64-like cursor values', () => {
      const base64Cursor = 'eyJpZCI6IjEyMyIsInRpbWUiOjE2MDA=';
      const result = buildLinkHeader('/api/items', { limit: 20 }, base64Cursor);

      expect(result).toContain('cursor=eyJpZCI6IjEyMyIsInRpbWUiOjE2MDA%3D');
    });
  });

  describe('extractQueryParams', () => {
    it('should extract string values', () => {
      const query = {
        name: 'test',
        filter: 'active',
      };

      const result = extractQueryParams(query);

      expect(result).toEqual({
        name: 'test',
        filter: 'active',
      });
    });

    it('should extract number values', () => {
      const query = {
        limit: 10,
        page: 2,
      };

      const result = extractQueryParams(query);

      expect(result).toEqual({
        limit: 10,
        page: 2,
      });
    });

    it('should skip undefined values', () => {
      const query = {
        name: 'test',
        filter: undefined,
      };

      const result = extractQueryParams(query);

      expect(result).toEqual({
        name: 'test',
      });
      expect(result).not.toHaveProperty('filter');
    });

    it('should skip null values', () => {
      const query = {
        name: 'test',
        filter: null,
      };

      const result = extractQueryParams(query);

      expect(result).toEqual({
        name: 'test',
      });
      expect(result).not.toHaveProperty('filter');
    });

    it('should handle empty query object', () => {
      const result = extractQueryParams({});

      expect(result).toEqual({});
    });

    it('should handle mixed value types', () => {
      const query = {
        name: 'test',
        limit: 20,
        active: undefined,
        cursor: 'abc123',
      };

      const result = extractQueryParams(query);

      expect(result).toEqual({
        name: 'test',
        limit: 20,
        cursor: 'abc123',
      });
    });

    it('should skip non-string/number values', () => {
      const query = {
        name: 'test',
        data: { nested: true },
        items: [1, 2, 3],
        valid: 42,
      };

      const result = extractQueryParams(query);

      expect(result).toEqual({
        name: 'test',
        valid: 42,
      });
      expect(result).not.toHaveProperty('data');
      expect(result).not.toHaveProperty('items');
    });

    it('should handle boolean values by skipping them', () => {
      const query = {
        name: 'test',
        active: true,
        disabled: false,
      };

      const result = extractQueryParams(query);

      expect(result).toEqual({
        name: 'test',
      });
    });

    it('should preserve empty string values', () => {
      const query = {
        name: '',
        filter: 'active',
      };

      const result = extractQueryParams(query);

      expect(result).toEqual({
        name: '',
        filter: 'active',
      });
    });

    it('should preserve zero values', () => {
      const query = {
        offset: 0,
        limit: 10,
      };

      const result = extractQueryParams(query);

      expect(result).toEqual({
        offset: 0,
        limit: 10,
      });
    });
  });

  describe('integration', () => {
    it('should work together to build Link headers from request query', () => {
      const requestQuery = {
        limit: 25,
        filter: 'active',
        cursor: 'old-cursor',
      };

      const params = extractQueryParams(requestQuery);
      const nextCursor = 'new-cursor-from-db';
      const linkHeader = buildLinkHeader('/api/items', params, nextCursor);

      expect(linkHeader).toBe('</api/items?limit=25&filter=active&cursor=new-cursor-from-db>; rel="next"');
    });

    it('should handle the full pagination flow', () => {
      // First page request
      const page1Query = { limit: 10 };
      const page1Params = extractQueryParams(page1Query);
      const page1Link = buildLinkHeader('/api/data', page1Params, 'cursor-page-2');

      expect(page1Link).toBe('</api/data?limit=10&cursor=cursor-page-2>; rel="next"');

      // Second page request (simulating client using the cursor)
      const page2Query = { limit: 10, cursor: 'cursor-page-2' };
      const page2Params = extractQueryParams(page2Query);
      const page2Link = buildLinkHeader('/api/data', page2Params, 'cursor-page-3');

      expect(page2Link).toBe('</api/data?limit=10&cursor=cursor-page-3>; rel="next"');

      // Last page (no more data)
      const lastPageQuery = { limit: 10, cursor: 'cursor-page-3' };
      const lastPageParams = extractQueryParams(lastPageQuery);
      const lastPageLink = buildLinkHeader('/api/data', lastPageParams, null);

      expect(lastPageLink).toBeNull();
    });
  });
});
