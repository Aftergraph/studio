import { describe, expect, it } from 'vitest';
import { generateId, shareContent, isOnline, formatDate, truncate } from '../../src/compose/utils';

describe('utils', () => {
  describe('generateId', () => {
    it('returns a non-empty string', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('returns unique values', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateId()));
      expect(ids.size).toBe(100);
    });
  });

  describe('formatDate', () => {
    it('returns "Just now" for recent timestamps', () => {
      const now = Date.now();
      expect(formatDate(now)).toBe('Just now');
    });

    it('returns minutes for timestamps within an hour', () => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      expect(formatDate(fiveMinutesAgo)).toBe('5m ago');
    });

    it('returns hours for timestamps within a day', () => {
      const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;
      expect(formatDate(threeHoursAgo)).toBe('3h ago');
    });
  });

  describe('truncate', () => {
    it('returns original text if shorter than max', () => {
      expect(truncate('hello', 10)).toBe('hello');
    });

    it('truncates with ellipsis if longer than max', () => {
      expect(truncate('hello world', 8)).toBe('hello w…');
    });
  });

  describe('isOnline', () => {
    it('returns a boolean-like value', () => {
      const result = isOnline();
      expect([true, false]).toContain(result);
    });
  });

  describe('shareContent', () => {
    it('returns false when Web Share API is not available', async () => {
      const result = await shareContent('test', 'content');
      expect(result).toBe(false);
    });
  });
});
