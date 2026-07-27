// Goblin integration friction: settling under the same roof doesn't end
// the beastfolk_settlement arc, it opens one (see ResidentState.friction,
// TUNING.residents.friction). See ./index.ts for shared context.

import type { GameEvent } from '../../../engine/events/types';

export const GOBLIN_INTEGRATION_EVENTS: GameEvent[] = [
  {
    id: 'beastfolk_integration_goblin',
    category: 'post',
    illustration: 'beastfolk_friction',
    title: 'Sticky Fingers, Sharp Tongues',
    text: 'The goblins who took the post up on its offer are quick, useful, and a little too quick with their hands for some residents\' comfort — a coin gone missing here, a joke made at someone\'s expense there, nothing anyone can prove and everyone half-believes anyway. {hero} is starting to hear "you can\'t trust them" more than the goblins\' actual work deserves.',
    conditions: [
      { type: 'residentTagAtLeast', tag: 'goblin', value: 1 },
      { type: 'frictionAtLeast', heritage: 'goblin', value: 4 },
    ],
    weight: 8,
    cooldownTurns: 3,
    binding: { type: 'highestSkill', skill: 'diplomacy' },
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    arc: 'goblin_integration',
    choices: [
      {
        label: 'Get ahead of the rumors and set the record straight.',
        check: { skill: 'diplomacy', stat: 'charm', difficulty: 10, tags: ['BEASTFOLK', 'diplomacy'] },
        outcomes: {
          critSuccess: {
            text: '{hero} runs down what actually happened in each case — mostly nothing, once — and says so plainly enough that even the sourest gossip has to concede the point. It doesn\'t make anyone friends, but it starves the rumor mill for a while.',
            outcomes: [
              { type: 'friction', heritage: 'goblin', delta: -5 },
              { type: 'contentment', delta: 1 },
              { type: 'history', text: 'Talked down suspicion between residents and the post\'s goblins.' },
            ],
          },
          success: {
            text: '{hero} makes the rounds and pours a little cold water on the loudest complaints. Not everyone\'s convinced, but the grumbling quiets some.',
            outcomes: [{ type: 'friction', heritage: 'goblin', delta: -3 }],
          },
          failure: {
            text: 'The rounds don\'t land — half the post hears "the goblins again" and decides {hero} is just making excuses for them.',
            outcomes: [
              { type: 'friction', heritage: 'goblin', delta: 1 },
              { type: 'stress', delta: 1 },
            ],
          },
          critFailure: {
            text: 'Somehow defending them makes it worse — now it looks like {hero} is covering for them, and the whispering picks up rather than stops.',
            outcomes: [
              { type: 'friction', heritage: 'goblin', delta: 2 },
              { type: 'contentment', delta: -1 },
            ],
          },
        },
      },
      {
        label: 'Ignore it — gossip burns itself out eventually.',
        outcomes: {
          success: {
            text: 'Maybe it does, someday. Today it just keeps smoldering, unaddressed.',
            outcomes: [{ type: 'friction', heritage: 'goblin', delta: 1 }],
          },
        },
      },
    ],
  },
  {
    id: 'beastfolk_integration_settled_goblin',
    category: 'post',
    illustration: 'beastfolk_settled',
    title: 'Counted Among the Post\'s Own',
    text: 'It happens without ceremony, the way these things do: someone leaves a goblin porter in charge of the storeroom key overnight, and nobody thinks twice about it until afterward, when {hero} realizes that a season ago that would have been unthinkable. The suspicion has simply worn away.',
    conditions: [
      { type: 'residentTagAtLeast', tag: 'goblin', value: 1 },
      { type: 'frictionAtMost', heritage: 'goblin', value: 2 },
    ],
    weight: 6,
    once: true,
    binding: { type: 'highestStat', stat: 'charm' },
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    arc: 'goblin_integration',
    choices: [
      {
        label: 'Good. Let it stand.',
        outcomes: {
          success: {
            text: 'The post is a little more itself for it — one less line dividing who belongs and who\'s merely tolerated.',
            outcomes: [
              { type: 'standing', faction: 'BEASTFOLK', delta: 2 },
              { type: 'contentment', delta: 1 },
              { type: 'history', text: 'The post\'s goblin residents finished settling in, grudge-free.' },
            ],
          },
        },
      },
    ],
  },
];
