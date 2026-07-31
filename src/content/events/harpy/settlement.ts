// Harpy settlement event — a flight asking to join the post outright as
// watch and hunters. See ./index.ts for shared context.

import type { GameEvent } from '../../../engine/events/types';
import { makeChoiceEvent, outcome } from '../eventHelpers';

export const HARPY_SETTLEMENT_EVENTS: GameEvent[] = [
  makeChoiceEvent({
    id: 'harpy_settlement',
    category: 'post',
    illustration: 'harpy_settlers',
    title: 'A Flight Asks to Roost',
    text: 'Half a dozen harpies put down on the palisade at first light and, for once, none of them names a price. They are tired, their spokeswoman says — tired of a life spent quarreling over thin hunting on the high crags — and they would sooner keep watch over the post\'s walls and hunt its country than raid it. They offer sharp eyes and sharper talons for a place to roost. No aerie will vouch for them; they vouch for themselves.',
    conditions: [
      { type: 'locationDiscovery', location: 'harpy_eyrie', atLeast: 'visited' },
      { type: 'standingAtLeast', faction: 'HARPY', value: 25 },
    ],
    weight: 6,
    cooldownTurns: 6,
    binding: { type: 'highestSkill', skill: 'leadership' },
    factions: ['HARPY'],
    peoples: ['harpy'],
    arc: 'harpy_settlement',
    choices: [
      {
        type: 'flat',
        label: 'Give them the wall and the hunting grounds.',
        text: 'They roost along the highest points of the palisade and take to the sky at dawn and dusk, and nothing crosses the open ground for a mile without the watch knowing. Some of the post\'s own are slow to sleep easy under that shadow — but the walls have keener eyes on them than they have ever had.',
        outcomes: [
          { type: 'addResidents', role: 'guards', count: 2, tag: 'harpy', group: 'native' },
          { type: 'addResidents', role: 'hunters', count: 1, tag: 'harpy', group: 'native' },
          outcome.standing('HARPY', 4),
          outcome.contentment(-1),
          // A roost is not yet a welcome — settling in is its own slow arc
          // (harpy_integration), not resolved by this one yes.
          outcome.friction('harpy', 7),
          outcome.history('A flight of harpies settled at the post as watch and hunters.'),
        ],
      },
      {
        type: 'flat',
        label: 'Decline — the post is not ready to sleep under their wings.',
        text: '{hero} turns them away as gently as the thing allows. They take it without rancor, spread their wings, and are gone on the next gust to try their luck over country less crowded with reasons to say no.',
        outcomes: [outcome.standing('HARPY', -2)],
      },
    ],
  }),
];
