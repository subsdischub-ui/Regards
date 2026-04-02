import { describe, it, expect } from 'vitest';
import { clusterMedia } from '@/lib/db/queries/media';

const makeMedia = (id: string, guestId: string, takenAt: string) => ({
  id,
  guestId,
  takenAt: new Date(takenAt),
  fileUrl: `media/originals/${id}.jpg`,
  thumbnailUrl: `media/thumbnails/${id}.jpg`,
  fileType: 'image/jpeg',
  caption: null,
  uploadedAt: new Date(),
  processingStatus: 'done' as const,
  fileSize: 1000,
  width: 800,
  height: 600,
  challengeId: null,
  driveSynced: false,
  driveFileId: null,
  guest: { id: guestId, name: `Guest ${guestId}`, avatarUrl: null },
});

describe('clusterMedia', () => {
  it('returns single items when no clusters possible', () => {
    const items = [
      makeMedia('1', 'a', '2026-05-23T16:00:00Z'),
      makeMedia('2', 'a', '2026-05-23T16:01:00Z'), // same guest, no cluster
    ];
    const result = clusterMedia(items);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.type === 'single')).toBe(true);
  });

  it('clusters photos from different guests within 2 minutes', () => {
    const items = [
      makeMedia('1', 'a', '2026-05-23T16:00:00Z'),
      makeMedia('2', 'b', '2026-05-23T16:01:30Z'), // different guest, within 2 min
    ];
    const result = clusterMedia(items);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('cluster');
    if (result[0].type === 'cluster') {
      expect(result[0].items).toHaveLength(2);
    }
  });

  it('does not cluster photos more than 2 minutes apart', () => {
    const items = [
      makeMedia('1', 'a', '2026-05-23T16:00:00Z'),
      makeMedia('2', 'b', '2026-05-23T16:03:00Z'), // 3 min apart
    ];
    const result = clusterMedia(items);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.type === 'single')).toBe(true);
  });

  it('mixes clusters and singles correctly', () => {
    const items = [
      makeMedia('1', 'a', '2026-05-23T16:00:00Z'),
      makeMedia('2', 'b', '2026-05-23T16:01:00Z'),
      makeMedia('3', 'c', '2026-05-23T16:01:30Z'),
      makeMedia('4', 'a', '2026-05-23T17:00:00Z'), // far away, single
    ];
    const result = clusterMedia(items);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('single');
    expect(result[1].type).toBe('cluster');
  });
});