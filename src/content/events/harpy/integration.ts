// Integration friction: settling under the same roof doesn't end the arc
// ./settlement.ts starts, it opens one. See ./index.ts for shared context.

import type { GameEvent } from '../../../engine/events/types';

export const HARPY_INTEGRATION_EVENTS: GameEvent[] = [
  {
    id: 'harpy_integration',
    category: 'post',
    illustration: 'harpy_friction',
    title: 'Under Their Shadow',
    text: 'The harpies who took the post up on its offer keep the watch better than any wall of men — but the grumbling has not stopped. A hen gone missing blamed on them before a fox turns up in the coop; children hurried indoors when a shadow crosses the yard; old hands who will not stand a watch alongside them. {hero} keeps hearing it secondhand, which usually means it runs deeper than what gets said aloud.',
    conditions: [
      { type: 'residentTagAtLeast', tag: 'harpy', value: 1 },
      { type: 'frictionAtLeast', heritage: 'harpy', value: 4 },
    ],
    weight: 8,
    cooldownTurns: 3,
    binding: { type: 'highestSkill', skill: 'leadership' },
    factions: ['HARPY'],
    peoples: ['harpy'],
    arc: 'harpy_integration',
    choices: [
      {
        label: 'Make both sides share a watch and a fire.',
        check: { skill: 'leadership', stat: 'resolve', difficulty: 10, tags: ['HARPY', 'diplomacy'] },
        outcomes: {
          critSuccess: {
            text: '{hero} does not lecture anyone — just pairs a crag-born to a homeland watch and makes them get through one cold night together. By dawn they are trading the flask and complaining about the same officer. It is a small thing, and it is the first small thing that has gone right between them.',
            outcomes: [
              { type: 'friction', heritage: 'harpy', delta: -5 },
              { type: 'contentment', delta: 1 },
              { type: 'history', text: 'Thawed the standoff between the post and its harpy watch.' },
            ],
          },
          success: {
            text: 'It is an awkward few nights, but {hero} keeps them working the same wall instead of avoiding it, and something eases, a little.',
            outcomes: [{ type: 'friction', heritage: 'harpy', delta: -3 }],
          },
          failure: {
            text: 'The pairing goes nowhere — both sides do the work and neither says a word to the other, and the silence sets harder than before.',
            outcomes: [
              { type: 'friction', heritage: 'harpy', delta: 1 },
              { type: 'stress', delta: 1 },
            ],
          },
          critFailure: {
            text: '{hero} pushes the wrong pair together on the wrong night, and a shouted quarrel on the wall-walk wakes half the post. Nobody comes out of it looking reasonable, least of all {him}.',
            outcomes: [
              { type: 'friction', heritage: 'harpy', delta: 2 },
              { type: 'contentment', delta: -1 },
            ],
          },
        },
      },
      {
        label: 'Let them find their own footing.',
        outcomes: {
          success: {
            text: '{hero} decides this is not worth spending authority on yet. Whether that is patience or avoidance, the muttering does not fade on its own.',
            outcomes: [{ type: 'friction', heritage: 'harpy', delta: 1 }],
          },
        },
      },
    ],
  },
  {
    id: 'harpy_integration_settled',
    category: 'post',
    illustration: 'harpy_settled',
    title: 'Part of the Watch, Now',
    text: 'Nobody announces it. It just becomes true one ordinary night: a homeland-born sentry calls up to the harpy on the high post to ask if she can see the road, and she calls back that it is clear, and neither of them thinks twice about it. Whatever the post was uneasy about before has quietly stopped being a question.',
    conditions: [
      { type: 'residentTagAtLeast', tag: 'harpy', value: 1 },
      { type: 'frictionAtMost', heritage: 'harpy', value: 2 },
    ],
    weight: 6,
    once: true,
    binding: { type: 'highestStat', stat: 'charm' },
    factions: ['HARPY'],
    peoples: ['harpy'],
    arc: 'harpy_integration',
    choices: [
      {
        label: 'Good. Let it stand.',
        outcomes: {
          success: {
            text: 'The post is a little more itself for it — one less line dividing who belongs and who is only tolerated, and a watch that now trusts its own eyes in the sky.',
            outcomes: [
              { type: 'standing', faction: 'HARPY', delta: 2 },
              { type: 'contentment', delta: 1 },
              { type: 'history', text: 'The post\'s harpy watch finished settling in, grudge-free.' },
            ],
          },
        },
      },
    ],
  },
];
