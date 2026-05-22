import { describe, it, expect } from 'vitest';
import { collectIds } from '@/hooks/use-infinite-feed';

describe('collectIds', () => {
  it('collects ids from standalone single items', () => {
    const ids = collectIds([
      { type: 'single', item: { id: 'a' } },
      { type: 'single', item: { id: 'b' } },
    ]);
    expect([...ids].sort()).toEqual(['a', 'b']);
  });

  it('collects ids from media nested inside clusters', () => {
    const ids = collectIds([
      { type: 'cluster', items: [{ id: 'x' }, { id: 'y' }], time: new Date() },
    ]);
    expect(ids.has('x')).toBe(true);
    expect(ids.has('y')).toBe(true);
  });

  it('sees a media that is already rendered inside a cluster', () => {
    // Regression: without cluster-aware dedup, an SSE prepend for a media that
    // is already inside a cluster would add a duplicate single card.
    const feed = [
      { type: 'cluster', items: [{ id: 'shared' }], time: new Date() },
    ];
    expect(collectIds(feed).has('shared')).toBe(true);
  });

  it('ignores malformed entries without throwing', () => {
    const ids = collectIds([
      null,
      undefined,
      {},
      { type: 'single' },
      { type: 'single', item: {} },
      { type: 'cluster' },
      { type: 'cluster', items: null },
    ]);
    expect(ids.size).toBe(0);
  });
});
