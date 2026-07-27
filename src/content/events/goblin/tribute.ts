// Goblin tribute demand — low-standing pressure arc. See ./index.ts for
// shared context.

import type { GameEvent } from '../../../engine/events/types';

export const GOBLIN_TRIBUTE_EVENTS: GameEvent[] = [
  {
    id: 'beastfolk_goblin_tribute',
    category: 'post',
    illustration: 'goblin_demand',
    title: 'The Clan at the Gate',
    text: 'A goblin clan-mother arrives with a handful of her sisters and a wagon to fill — cloth, tools, salt, whatever the post can spare, in exchange for a promise to trouble you no further this year. She is patient, businesslike, and utterly unbothered by the guards watching her from the wall. {hero} is left to haggle over what "no further trouble" is actually worth.',
    conditions: [
      { type: 'locationDiscovery', location: 'goblin_wilds', atLeast: 'visited' },
      { type: 'standingAtMost', faction: 'BEASTFOLK', value: -20 },
    ],
    weight: 10,
    cooldownTurns: 3,
    binding: { type: 'highestSkill', skill: 'bargain' },
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    arc: 'goblin_tribute',
    choices: [
      {
        label: 'Fill the wagon — it is cheaper than a grudge.',
        outcomes: {
          success: {
            text: '{hero} loads the wagon without ceremony, and makes the understanding explicit: the wagon now, and a smaller due each season after, so long as the clan keeps its word. The clan-mother counts the goods with a practiced eye and agrees.',
            outcomes: [
              { type: 'good', good: 'cloth', delta: -6 },
              { type: 'good', good: 'tools', delta: -3 },
              { type: 'tribute', faction: 'BEASTFOLK', direction: 'pay', goods: { cloth: 2, tools: 1 } },
              { type: 'standing', faction: 'BEASTFOLK', delta: 2 },
              { type: 'history', text: 'Paid a goblin clan to keep the peace.' },
            ],
          },
        },
      },
      {
        label: 'Haggle her down to a fraction of what she asked.',
        check: { skill: 'bargain', stat: 'charm', difficulty: 10, tags: ['BEASTFOLK'] },
        outcomes: {
          critSuccess: {
            text: 'The clan-mother laughs outright at {hero}\'s counter-offer — and then, to everyone\'s surprise, accepts something close to it. "You bargain like one of us," she says, which is either a compliment or a warning. Possibly both.',
            outcomes: [
              { type: 'good', good: 'cloth', delta: -1 },
              { type: 'standing', faction: 'BEASTFOLK', delta: 3 },
              { type: 'history', text: 'Out-haggled a goblin clan-mother and earned her respect.' },
            ],
          },
          success: {
            text: '{hero} talks the price down to something the storehouse won\'t miss. The clan-mother grumbles but takes the deal — a fair trade, by her own lights.',
            outcomes: [
              { type: 'good', good: 'cloth', delta: -2 },
              { type: 'standing', faction: 'BEASTFOLK', delta: 1 },
            ],
          },
          failure: {
            text: 'She doesn\'t bargain so much as wait {hero} out, and it works. The wagon leaves fuller than it needed to, and the lesson — that this post can be talked into more than it meant to give — is the real price paid.',
            outcomes: [
              { type: 'good', good: 'cloth', delta: -9 },
              { type: 'good', good: 'tools', delta: -4 },
              { type: 'standing', faction: 'BEASTFOLK', delta: -2 },
            ],
          },
          critFailure: {
            text: 'The haggling turns sour; the clan-mother decides {hero} has been wasting her time and helps herself to a good deal more on the way out, calling it interest.',
            outcomes: [
              { type: 'good', good: 'cloth', delta: -14 },
              { type: 'good', good: 'tools', delta: -6 },
              { type: 'silver', delta: -10 },
              { type: 'standing', faction: 'BEASTFOLK', delta: -4 },
            ],
          },
        },
      },
    ],
  },
];
