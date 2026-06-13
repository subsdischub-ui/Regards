import { describe, it, expect } from 'vitest';
import { flattenFeedIds, neighborsOf, feedCacheKey, mediaHref } from '@/lib/feed-cache';

const single = (id: string) => ({ type: 'single', item: { id } });
const cluster = (...ids: string[]) => ({ type: 'cluster', items: ids.map((id) => ({ id })) });

describe('flattenFeedIds', () => {
  it('flattens singles and cluster members in display order', () => {
    const items = [single('a'), cluster('b', 'c', 'd'), single('e')];
    expect(flattenFeedIds(items)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('ignores malformed entries without throwing', () => {
    const items = [single('a'), { type: 'cluster' }, { type: 'single' }, null];
    expect(flattenFeedIds(items as any)).toEqual(['a']);
  });
});

describe('neighborsOf', () => {
  const ids = ['a', 'b', 'c'];

  it('returns both neighbors in the middle', () => {
    expect(neighborsOf(ids, 'b')).toEqual({ prevId: 'a', nextId: 'c' });
  });

  it('omits prev at the head and next at the tail', () => {
    expect(neighborsOf(ids, 'a')).toEqual({ prevId: undefined, nextId: 'b' });
    expect(neighborsOf(ids, 'c')).toEqual({ prevId: 'b', nextId: undefined });
  });

  it('returns nothing for an id not in the list (deep link)', () => {
    expect(neighborsOf(ids, 'z')).toEqual({});
  });
});

describe('feedCacheKey', () => {
  it('separates the global feed from per-guest feeds', () => {
    expect(feedCacheKey()).toBe('all');
    expect(feedCacheKey('guest-123')).toBe('guest:guest-123');
  });
});

describe('mediaHref', () => {
  it('defaults to the global feed context', () => {
    expect(mediaHref('m1')).toBe('/media/m1?ctx=all');
  });

  it('url-encodes the colon in guest / moment context keys', () => {
    expect(mediaHref('m1', 'guest:g7')).toBe('/media/m1?ctx=guest%3Ag7');
    expect(mediaHref('m1', 'moment:mo3')).toBe('/media/m1?ctx=moment%3Amo3');
  });
});
