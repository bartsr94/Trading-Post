// Harpy marriage-match event — high-standing voluntary path. See ./index.ts
// for shared context.

import type { GameEvent } from '../../../engine/events/types';
import { makeChoiceEvent, outcome } from '../eventHelpers';

export const HARPY_MATCH_EVENTS: GameEvent[] = [
  makeChoiceEvent({
    id: 'harpy_match',
    category: 'post',
    illustration: 'harpy_arrival',
    title: 'One Who Came Down',
    text: 'She lands in the yard at dusk, alone, wings still half-spread as if she has not decided to stay — and asks for {hero} by the name the crags have given {him}. No aerie sent her; among her own kind a daughter who leaves is a daughter counted lost, and she has weighed the post against that and chosen it anyway. She will not ask twice, and she will not be talked into leaving with a soft answer instead of a true one.',
    conditions: [
      { type: 'locationDiscovery', location: 'harpy_eyrie', atLeast: 'visited' },
      { type: 'standingAtLeast', faction: 'HARPY', value: 10 },
      { type: 'heroUnmarried' },
      { type: 'heroGender', gender: 'male' },
    ],
    weight: 8,
    once: true,
    cooldownTurns: 4,
    binding: { type: 'highestStat', stat: 'charm' },
    factions: ['HARPY'],
    peoples: ['harpy'],
    arc: 'harpy_match',
    choices: [
      {
        type: 'flat',
        label: 'Welcome her into the household.',
        text: 'There is no rite the Company would name a marriage — only her word and {hero}\'s, and a roof that now shelters one of the crag-born. Word of it will reach the aeries on the wind, and reach them as proof the post keeps faith with those who come down to it.',
        outcomes: [
          { type: 'formUnion', source: 'alliance', heritage: 'harpy' },
          outcome.standing('HARPY', 8),
          { type: 'addTrait', trait: 'wed_harpy' },
          outcome.history('Wed a harpy who came down from the crags and chose the post.'),
        ],
      },
      {
        type: 'flat',
        label: 'Send her back to the wind — this is not a bond you are ready to make.',
        text: 'She hears the refusal out, unblinking, and takes it the way the crag-born take most things — without argument and without forgetting. She is airborne before {hero} finishes speaking, and does not come down again.',
        outcomes: [outcome.standing('HARPY', -3)],
      },
    ],
  }),
];
