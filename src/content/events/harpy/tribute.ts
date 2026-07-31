// Harpy tribute demand — low-standing pressure arc. See ./index.ts for
// shared context.

import type { GameEvent } from '../../../engine/events/types';
import { makeChoiceEvent, outcome } from '../eventHelpers';

export const HARPY_TRIBUTE_EVENTS: GameEvent[] = [
  makeChoiceEvent({
    id: 'harpy_tribute',
    category: 'post',
    illustration: 'harpy_demand',
    title: 'A Shadow on the Wall',
    text: 'They come down out of a grey morning without a sound until the last moment — three harpies, wings folded, perched along the palisade top where no ladder stands. Their eldest does not climb down. She names a price from up there, in trade-tongue worn smooth by use: grain and bright metal, left on the north stones each new moon, and the crags will let the post keep its roofs. {hero} has to answer her craning {his} neck, the whole yard watching.',
    conditions: [
      { type: 'locationDiscovery', location: 'harpy_eyrie', atLeast: 'visited' },
      { type: 'standingAtMost', faction: 'HARPY', value: -20 },
    ],
    weight: 10,
    cooldownTurns: 3,
    binding: { type: 'highestStat', stat: 'resolve' },
    factions: ['HARPY'],
    peoples: ['harpy'],
    arc: 'harpy_tribute',
    choices: [
      {
        type: 'flat',
        label: 'Leave the tribute on the north stones.',
        text: 'You set it out yourself, in the open, and say the terms back to her plainly: this much each moon, for a season left in peace. She takes it without thanks and drops off the wall backward into the wind. So long as the stones are not bare, the crags will keep their distance.',
        outcomes: [
          outcome.silver(-20),
          outcome.good('grain', -5),
          { type: 'tribute', faction: 'HARPY', direction: 'pay', silver: 10, goods: { grain: 3 } },
          outcome.standing('HARPY', 2),
          outcome.history('Bought peace from the crags with a moon-tribute.'),
        ],
      },
      {
        type: 'checked',
        label: 'Send {hero} to refuse them to their faces.',
        check: { skill: 'leadership', stat: 'resolve', difficulty: 11, tags: ['HARPY', 'intimidation'] },
        critSuccess: {
          text: '{hero} climbs the wall-walk to stand level with the eldest and says no without a tremor, close enough to feel the down-draft of her wings. She studies {him} a long moment — then laughs, a harsh gull-cry of a sound, and the three of them lift off empty-handed. Nerve, it turns out, reads the same at any altitude.',
          outcomes: [outcome.standing('HARPY', 3), outcome.history('Refused the crags\' tribute to their faces and won their regard.')],
        },
        success: {
          text: '{hero} holds the line and does not look away. The eldest hisses something in her own tongue and drops off the wall — nothing taken this time, nothing given.',
          outcomes: [outcome.standing('HARPY', 1)],
        },
        failure: {
          text: 'The refusal comes out thinner than {hero} meant it to. Over the next nights the storehouse loses more to sharp claws in the dark than the tribute would ever have cost, and the lesson lands the hard way.',
          outcomes: [outcome.good('grain', -10), outcome.silver(-12), outcome.standing('HARPY', -3), outcome.stress(1)],
        },
        critFailure: {
          text: 'Refusing was exactly the wrong read. What the crags take on their way to reminding the post of its place costs far more than the price {hero} would not pay, and they leave certain the roofs are theirs to lift whenever they like.',
          outcomes: [outcome.good('grain', -16), outcome.silver(-25), outcome.standing('HARPY', -6), outcome.stress(2)],
        },
      },
    ],
  }),
];
