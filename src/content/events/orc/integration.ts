// Orc integration friction: settling under the same roof doesn't end the
// arc ./settlement.ts starts, it opens one (see ResidentState.friction,
// TUNING.residents.friction). See ./index.ts for shared context. The goblin
// counterpart moved to ../../goblin/integration.ts (2026-07-27).

import type { GameEvent } from '../../../engine/events/types';

export const ORC_INTEGRATION_EVENTS: GameEvent[] = [
  {
    id: 'beastfolk_integration_orc',
    category: 'post',
    illustration: 'beastfolk_friction',
    title: 'Not Yet One of Us',
    text: 'The orcs who took the post\'s roof over their heads are pulling their weight well enough, but the grumbling hasn\'t stopped — a missing tool blamed on them before it turns up misplaced, a joke that lands wrong, old residents who still cross the yard to avoid walking past them. {hero} keeps hearing about it secondhand, which usually means it\'s worse than what gets said aloud.',
    conditions: [
      { type: 'residentTagAtLeast', tag: 'orc', value: 1 },
      { type: 'frictionAtLeast', heritage: 'orc', value: 4 },
    ],
    weight: 8,
    cooldownTurns: 3,
    binding: { type: 'highestSkill', skill: 'leadership' },
    factions: ['BEASTFOLK'],
    peoples: ['orc'],
    arc: 'orc_integration',
    choices: [
      {
        label: 'Sit both sides down and clear the air.',
        check: { skill: 'leadership', stat: 'resolve', difficulty: 10, tags: ['BEASTFOLK', 'diplomacy'] },
        outcomes: {
          critSuccess: {
            text: '{hero} doesn\'t lecture anyone — just makes both sides say their piece in front of each other, then makes them agree on one thing before they leave. It\'s a small thing, but it\'s the first small thing that\'s gone right between them.',
            outcomes: [
              { type: 'friction', heritage: 'orc', delta: -5 },
              { type: 'contentment', delta: 1 },
              { type: 'history', text: 'Talked down a flare-up between residents and the post\'s orcs.' },
            ],
          },
          success: {
            text: 'It\'s an awkward hour, but {hero} keeps both sides talking instead of stewing, and something eases, a little.',
            outcomes: [{ type: 'friction', heritage: 'orc', delta: -3 }],
          },
          failure: {
            text: 'The conversation goes nowhere — both sides say their piece and neither one hears it. If anything, saying it out loud made the grudge more official.',
            outcomes: [
              { type: 'friction', heritage: 'orc', delta: 1 },
              { type: 'stress', delta: 1 },
            ],
          },
          critFailure: {
            text: '{hero} says the wrong thing to the wrong person, and what was grumbling becomes a shouting match half the post overhears. Nobody comes out of this looking reasonable.',
            outcomes: [
              { type: 'friction', heritage: 'orc', delta: 2 },
              { type: 'contentment', delta: -1 },
            ],
          },
        },
      },
      {
        label: 'Let them work it out themselves.',
        outcomes: {
          success: {
            text: '{hero} decides this isn\'t worth spending authority on yet. Whether that\'s wisdom or just avoidance, the grumbling doesn\'t go anywhere on its own.',
            outcomes: [{ type: 'friction', heritage: 'orc', delta: 1 }],
          },
        },
      },
    ],
  },
  {
    id: 'beastfolk_integration_settled_orc',
    category: 'post',
    illustration: 'beastfolk_settled',
    title: 'One of the Wall, Now',
    text: 'Nobody announces it. It just becomes true one ordinary evening: an orc guardswoman passes a joke to a homeland-born farmer at the well, and it lands the way jokes are supposed to — nobody flinches, nobody watches to see how it\'s taken. Whatever the post was arguing about before, it has quietly stopped.',
    conditions: [
      { type: 'residentTagAtLeast', tag: 'orc', value: 1 },
      { type: 'frictionAtMost', heritage: 'orc', value: 2 },
    ],
    weight: 6,
    once: true,
    binding: { type: 'highestStat', stat: 'charm' },
    factions: ['BEASTFOLK'],
    peoples: ['orc'],
    arc: 'orc_integration',
    choices: [
      {
        label: 'Good. Let it stand.',
        outcomes: {
          success: {
            text: 'The post is a little more itself for it — one less line dividing who belongs and who\'s merely tolerated.',
            outcomes: [
              { type: 'standing', faction: 'BEASTFOLK', delta: 2 },
              { type: 'contentment', delta: 1 },
              { type: 'history', text: 'The post\'s orc residents finished settling in, grudge-free.' },
            ],
          },
        },
      },
    ],
  },
];
