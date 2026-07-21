import { describe, expect, it } from 'vitest';

import { genderOf, heritageOf } from './heroes';

describe('HeroTemplate portraitKey parsing', () => {
  it('reads heritage from the first token (case-insensitive)', () => {
    expect(heritageOf({ portraitKey: 'Kiswani_bayuk_female_01' })).toBe('kiswani');
  });

  it('reads gender from the token before the index', () => {
    expect(genderOf({ portraitKey: 'kiswani_female_01' })).toBe('female');
    expect(genderOf({ portraitKey: 'kiswani_bayuk_female_01' })).toBe('female');
    expect(genderOf({ portraitKey: 'imanian_male_02' })).toBe('male');
  });
});

