import { afterEach, describe, expect, it } from 'vitest';

import { PORTRAIT_URLS, pickDependantPortraitKey, pickPortraitKey, portraitKeysFor } from './portraits';

describe('portraitKeysFor', () => {
  it('includes ethnicity variants when selecting by culture+gender', () => {
    const keys = portraitKeysFor('kiswani_female');
    expect(keys).toContain('kiswani_bayuk_female_01');
  });

  it('restricts to a specific ethnicity when provided', () => {
    const keys = portraitKeysFor('kiswani_bayuk_female');
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.every((k) => k.startsWith('kiswani_bayuk_female_'))).toBe(true);
  });
});

describe('child life-stage art', () => {
  const childKey = 'testfolk_male_child_01';

  afterEach(() => {
    PORTRAIT_URLS.delete(childKey);
  });

  it('never pulls child art into a plain adult query', () => {
    PORTRAIT_URLS.set(childKey, 'fake-child-url');
    expect(portraitKeysFor('testfolk_male')).not.toContain(childKey);
    expect(portraitKeysFor('testfolk_male_child')).toEqual([childKey]);
  });

  it('pickPortraitKey only returns child art when explicitly asked (a `_child` prefix)', () => {
    PORTRAIT_URLS.set(childKey, 'fake-child-url');
    expect(pickPortraitKey('testfolk_male', 'seed')).toBeUndefined();
    expect(pickPortraitKey('testfolk_male_child', 'seed')).toBe(childKey);
  });

  describe('pickDependantPortraitKey', () => {
    it('prefers child art when it exists for the culture/gender', () => {
      PORTRAIT_URLS.set(childKey, 'fake-child-url');
      expect(pickDependantPortraitKey('testfolk_male', 'seed', true)).toBe(childKey);
    });

    it('falls back to the adult pool when no child art exists yet', () => {
      // orc_female has adult art but no child pool painted yet.
      const adultKey = pickPortraitKey('orc_female', 'seed1');
      expect(adultKey).toBeDefined();
      expect(pickDependantPortraitKey('orc_female', 'seed1', true)).toBe(adultKey);
    });

    it('a non-child dependant always uses the adult pool, even if child art exists', () => {
      PORTRAIT_URLS.set(childKey, 'fake-child-url');
      expect(pickDependantPortraitKey('testfolk_male', 'seed', false)).toBeUndefined();
    });
  });

  it('resolves the real painted imanian_male_child pool', () => {
    // Regression check against actual asset art, not a synthetic fixture.
    const keys = portraitKeysFor('imanian_male_child');
    expect(keys).toContain('imanian_male_child_01');
    expect(pickDependantPortraitKey('imanian_male', 'seed', true)).toBe('imanian_male_child_01');
  });
});

