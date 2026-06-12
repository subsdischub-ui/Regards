import { describe, it, expect } from 'vitest';
import { isTestGuestName } from '@/lib/moderation';

describe('isTestGuestName', () => {
  it('flags the names produced by the E2E suite', () => {
    expect(isTestGuestName('Sophie E2E')).toBe(true);
    expect(isTestGuestName('e2e')).toBe(true);
    expect(isTestGuestName('Marc E2E Dupont')).toBe(true);
  });

  it('flags generic test accounts', () => {
    expect(isTestGuestName('Test')).toBe(true);
    expect(isTestGuestName('test user')).toBe(true);
    expect(isTestGuestName('Compte TEST 42')).toBe(true);
    expect(isTestGuestName('test-1')).toBe(true);
  });

  it('never flags real guests whose name merely contains the letters', () => {
    expect(isTestGuestName('Testard')).toBe(false); // real French surname
    expect(isTestGuestName('Détestable')).toBe(false);
    expect(isTestGuestName('Attester')).toBe(false);
    expect(isTestGuestName('Sophie')).toBe(false);
    expect(isTestGuestName('Jean-Étienne')).toBe(false);
  });
});
