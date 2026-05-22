import { describe, it, expect } from 'vitest';
import { asNonEmptyString, asValidDate, asFiniteInt } from '@/lib/validation';

describe('asNonEmptyString', () => {
  it('accepts strings with non-whitespace content', () => {
    expect(asNonEmptyString('hello')).toBe('hello');
  });

  it('rejects empty, whitespace-only, and non-string input', () => {
    expect(asNonEmptyString('')).toBeNull();
    expect(asNonEmptyString('   ')).toBeNull();
    expect(asNonEmptyString(undefined)).toBeNull();
    expect(asNonEmptyString(null)).toBeNull();
    expect(asNonEmptyString(42)).toBeNull();
  });
});

describe('asValidDate', () => {
  it('parses a valid ISO date string', () => {
    const d = asValidDate('2026-05-22T14:30:00Z');
    expect(d).toBeInstanceOf(Date);
    expect(d?.getTime()).toBe(new Date('2026-05-22T14:30:00Z').getTime());
  });

  it('rejects invalid, empty, and non-date input', () => {
    expect(asValidDate('not-a-date')).toBeNull();
    expect(asValidDate('')).toBeNull();
    expect(asValidDate(undefined)).toBeNull();
    expect(asValidDate(null)).toBeNull();
    expect(asValidDate({})).toBeNull();
  });
});

describe('asFiniteInt', () => {
  it('coerces numeric input to a truncated integer', () => {
    expect(asFiniteInt(30)).toBe(30);
    expect(asFiniteInt('45')).toBe(45);
    expect(asFiniteInt(4.9)).toBe(4);
    expect(asFiniteInt(0)).toBe(0);
  });

  it('rejects non-numeric and non-finite input', () => {
    expect(asFiniteInt('abc')).toBeNull();
    expect(asFiniteInt(undefined)).toBeNull();
    expect(asFiniteInt(null)).toBeNull();
    expect(asFiniteInt(NaN)).toBeNull();
    expect(asFiniteInt(Infinity)).toBeNull();
  });
});
