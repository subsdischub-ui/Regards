import { describe, it, expect } from 'vitest';
import { checkBadges } from '@/lib/points';

describe('checkBadges', () => {
  it('awards "Paparazzi" for 20+ photos', () => {
    const badges = checkBadges({
      currentBadges: [],
      photoCount: 20,
      videoCount: 0,
      commentCount: 0,
      reactionCount: 0,
      challengeCount: 0,
      isFirstUpload: false,
      isAfterMidnight: false,
    });
    expect(badges).toContain('Paparazzi');
  });

  it('awards "Noctambule" for uploads after midnight', () => {
    const badges = checkBadges({
      currentBadges: [],
      photoCount: 1,
      videoCount: 0,
      commentCount: 0,
      reactionCount: 0,
      challengeCount: 0,
      isFirstUpload: false,
      isAfterMidnight: true,
    });
    expect(badges).toContain('Noctambule');
  });

  it('does not re-award existing badges', () => {
    const badges = checkBadges({
      currentBadges: ['Paparazzi'],
      photoCount: 25,
      videoCount: 0,
      commentCount: 0,
      reactionCount: 0,
      challengeCount: 0,
      isFirstUpload: false,
      isAfterMidnight: false,
    });
    expect(badges).not.toContain('Paparazzi');
  });
});