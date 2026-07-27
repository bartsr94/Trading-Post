// Orc marriage-match event — high-standing voluntary path. See ./index.ts
// for shared context. The goblin counterpart moved to
// ../../goblin/match.ts (2026-07-27).

import type { GameEvent } from '../../../engine/events/types';

export const ORC_MATCH_EVENTS: GameEvent[] = [
  {
    id: 'beastfolk_orc_match',
    category: 'post',
    illustration: 'orc_arrival',
    title: 'One Who Chose to Come',
    text: 'She walks in alone, unarmed, and asks for {hero} by the reputation the wilds have given {him} — steady, fair, worth the risk. No war-band sent her and no elder blessed the errand; among her own kind there is no one left to spare, and she has decided the post is a better wager than waiting. She will not ask twice, and she will not be talked into leaving disappointed without an answer either way.',
    conditions: [
      { type: 'locationDiscovery', location: 'beast_wilds', atLeast: 'visited' },
      { type: 'standingAtLeast', faction: 'BEASTFOLK', value: 10 },
      { type: 'heroUnmarried' },
      { type: 'heroGender', gender: 'male' },
    ],
    weight: 8,
    once: true,
    cooldownTurns: 4,
    binding: { type: 'highestStat', stat: 'charm' },
    factions: ['BEASTFOLK'],
    peoples: ['orc'],
    arc: 'orc_match',
    choices: [
      {
        label: 'Welcome her into the household.',
        outcomes: {
          success: {
            text: 'There is no ceremony the Company would recognize — only her word and {hero}\'s, and a household that has grown by one. Word of it will reach the war-bands eventually, and reach them as proof the post keeps its bargains.',
            outcomes: [
              { type: 'formUnion', source: 'alliance', heritage: 'orc' },
              { type: 'standing', faction: 'BEASTFOLK', delta: 8 },
              { type: 'addTrait', trait: 'wed_orc' },
              { type: 'history', text: 'Wed an orc woman who chose the post over her own kind\'s odds.' },
            ],
          },
        },
      },
      {
        label: 'Turn her away — this is not a bond you are ready to make.',
        outcomes: {
          success: {
            text: 'She takes the refusal the way she takes most things — without argument, and without forgetting it. She leaves the way she came, and does not come back.',
            outcomes: [{ type: 'standing', faction: 'BEASTFOLK', delta: -3 }],
          },
        },
      },
    ],
  },
];
