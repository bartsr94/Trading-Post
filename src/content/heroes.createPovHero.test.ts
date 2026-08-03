// Coverage for the player-embodied POV hero's chargen constructor
// (POV_CHARACTER_SPEC.md §4.5) — createPovHero turns validated UI choices
// into a runtime Hero; these lock down that mapping so a future refactor
// can't silently drop a field.

import { describe, expect, it } from 'vitest';
import { defaultSubPeople } from '../engine/types';
import type { PovHeroBuild } from './heroes';
import { createPovHero } from './heroes';
import { POV_BACKGROUNDS } from './povBackgrounds';

function build(overrides: Partial<PovHeroBuild> = {}): PovHeroBuild {
  return {
    name: 'Rowan',
    gender: 'male',
    heritage: 'imanian',
    backgroundId: 'company_factor',
    stats: { might: 3, agility: 3, wits: 3, charm: 3, resolve: 3 },
    skills: {
      bargain: 0,
      diplomacy: 0,
      combat: 0,
      survival: 0,
      leadership: 0,
      lore: 0,
      craft: 0,
      stealth: 0,
    },
    ...overrides,
  };
}

describe('createPovHero', () => {
  it('always mints the fixed runtime id, and copies name/gender/heritage/stats through', () => {
    const hero = createPovHero(build({ name: 'Aldric', gender: 'female', heritage: 'kiswani' }));
    expect(hero.id).toBe('pov');
    expect(hero.name).toBe('Aldric');
    expect(hero.gender).toBe('female');
    expect(hero.heritage).toBe('kiswani');
    expect(hero.stats).toEqual({ might: 3, agility: 3, wits: 3, charm: 3, resolve: 3 });
    expect(hero.status).toBe('active');
    expect(hero.health).toBe(10);
    expect(hero.stress).toBe(0);
    expect(hero.skillMarks).toEqual([]);
  });

  it('applies the chosen background — epithet, bio, traits, and opening history', () => {
    const veteran = POV_BACKGROUNDS.find((b) => b.id === 'veteran_officer')!;
    const hero = createPovHero(build({ backgroundId: 'veteran_officer' }));
    expect(hero.epithet).toBe(veteran.epithet);
    expect(hero.bio).toBe(veteran.description);
    expect(hero.traits).toEqual(veteran.traits);
    expect(hero.history).toEqual([veteran.openingHistory]);
  });

  it('falls back to the first background if given an unknown backgroundId', () => {
    const hero = createPovHero(build({ backgroundId: 'not_a_real_background' }));
    expect(hero.epithet).toBe(POV_BACKGROUNDS[0]!.epithet);
    expect(hero.traits).toEqual(POV_BACKGROUNDS[0]!.traits);
  });

  it('copies the chargen skill allocation through', () => {
    const hero = createPovHero(
      build({
        skills: {
          bargain: 2,
          diplomacy: 0,
          combat: 1,
          survival: 0,
          leadership: 0,
          lore: 3,
          craft: 0,
          stealth: 0,
        },
      }),
    );
    expect(hero.skills.bargain).toBe(2);
    expect(hero.skills.combat).toBe(1);
    expect(hero.skills.lore).toBe(3);
    expect(hero.skills.stealth).toBe(0);
  });

  it('defaults subPeople from heritage when not given, but keeps an explicit one', () => {
    const defaulted = createPovHero(build({ heritage: 'kiswani' }));
    expect(defaulted.subPeople).toBe(defaultSubPeople('kiswani'));

    const explicit = createPovHero(build({ heritage: 'kiswani', subPeople: 'bejasi_hills' }));
    expect(explicit.subPeople).toBe('bejasi_hills');
  });

  it('sets portraitKey only when the build provides one', () => {
    const withPortrait = createPovHero(build({ portraitKey: 'imanian_male_02' }));
    expect(withPortrait.portraitKey).toBe('imanian_male_02');

    const withoutPortrait = createPovHero(build());
    expect(withoutPortrait.portraitKey).toBeUndefined();
  });
});
