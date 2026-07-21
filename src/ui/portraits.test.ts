import { describe, expect, it } from 'vitest';

import { portraitKeysFor } from './portraits';

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

