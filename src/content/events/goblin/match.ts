// Goblin marriage-match event — high-standing voluntary path. See
// ./index.ts for shared context.

import type { GameEvent } from '../../../engine/events/types';

export const GOBLIN_MATCH_EVENTS: GameEvent[] = [
  {
    id: 'beastfolk_goblin_match',
    category: 'post',
    illustration: 'goblin_arrival',
    title: 'A Bargain of Her Own Making',
    text: 'She has clearly rehearsed this — a goblin, young by the look of her, who has slipped away from her clan on the strength of a rumor that {hero} is unwed and worth the gamble. She names no price and no clan; this errand is entirely her own, and if it fails she will simply go home and say nothing happened. She is watching {hero} more closely than she is letting on.',
    conditions: [
      { type: 'locationDiscovery', location: 'goblin_wilds', atLeast: 'visited' },
      { type: 'standingAtLeast', faction: 'BEASTFOLK', value: 10 },
      { type: 'heroUnmarried' },
      { type: 'heroGender', gender: 'male' },
    ],
    weight: 8,
    once: true,
    cooldownTurns: 4,
    binding: { type: 'lowestSkill', skill: 'diplomacy' },
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    arc: 'goblin_match',
    choices: [
      {
        label: 'Take the wager she is offering.',
        outcomes: {
          success: {
            text: 'It is a quiet thing, decided over an evening rather than declared — but decided all the same. She settles into the household like someone who has been planning this longer than {hero} has been aware of her.',
            outcomes: [
              { type: 'formUnion', source: 'alliance', heritage: 'goblin' },
              { type: 'standing', faction: 'BEASTFOLK', delta: 8 },
              { type: 'addTrait', trait: 'wed_goblin' },
              { type: 'history', text: 'Wed a goblin who slipped her clan on a rumor and a gamble.' },
            ],
          },
        },
      },
      {
        label: 'Send her home — kindly, but plainly.',
        outcomes: {
          success: {
            text: '{hero} says no as gently as it can be said. She takes it better than expected, shrugs, and disappears back the way she came before anyone else at the post even notices she was here.',
            outcomes: [{ type: 'standing', faction: 'BEASTFOLK', delta: -3 }],
          },
        },
      },
    ],
  },
];
