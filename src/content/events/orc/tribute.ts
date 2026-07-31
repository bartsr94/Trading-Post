// Orc tribute demand — low-standing pressure arc. See ./index.ts for
// shared context (standing arcs, loreRef decision). The goblin counterpart
// moved to ../../goblin/tribute.ts (2026-07-27).

import type { GameEvent } from '../../../engine/events/types';
import { makeChoiceEvent, outcome } from '../eventHelpers';

export const ORC_TRIBUTE_EVENTS: GameEvent[] = [
  makeChoiceEvent({
    id: 'beastfolk_orc_tribute',
    category: 'post',
    illustration: 'orc_demand',
    title: 'A Price for Peace',
    text: 'An orc war-band camps in plain sight beyond bowshot — not hiding, not attacking, just waiting to be noticed. Their spokeswoman walks in alone at midday and names a price: grain and silver, paid now, for a season left in peace. {hero} is the one who has to answer her, with the whole camp watching to see whether the post pays like it understands the wilds, or has to be taught.',
    conditions: [
      { type: 'locationDiscovery', location: 'beast_wilds', atLeast: 'visited' },
      { type: 'standingAtMost', faction: 'BEASTFOLK', value: -20 },
    ],
    weight: 10,
    cooldownTurns: 3,
    binding: { type: 'highestStat', stat: 'resolve' },
    factions: ['BEASTFOLK'],
    peoples: ['orc'],
    arc: 'orc_tribute',
    choices: [
      {
        type: 'flat',
        label: 'Pay what she asks — buy this season\'s quiet.',
        text: 'You count it out yourself, in the open, and make the bargain plain: this season’s due in exchange for a season’s peace. She takes it without thanks, but with understanding. So long as the due keeps coming, her band will leave the post alone.',
        outcomes: [
          outcome.silver(-25),
          outcome.good('grain', -5),
          { type: 'tribute', faction: 'BEASTFOLK', direction: 'pay', silver: 12, goods: { grain: 3 } },
          outcome.standing('BEASTFOLK', 2),
          outcome.history('Paid an orc war-band to leave the post in peace.'),
        ],
      },
      {
        type: 'checked',
        label: 'Send {hero} to face her down and refuse.',
        check: { skill: 'leadership', stat: 'resolve', difficulty: 11, tags: ['BEASTFOLK'] },
        critSuccess: {
          text: '{hero} doesn\'t flinch, doesn\'t reach for a weapon, simply says no in a voice that ends the conversation. The spokeswoman studies {hero} a long moment — then laughs, once, and walks her band off without a backward look. That kind of nerve, it turns out, is its own currency here.',
          outcomes: [outcome.standing('BEASTFOLK', 3), outcome.history('Refused an orc war-band\'s demand and won their grudging respect.')],
        },
        success: {
          text: '{hero} holds the line. The spokeswoman spits, mutters something uncomplimentary, and the camp breaks by evening — nothing taken, nothing given.',
          outcomes: [outcome.standing('BEASTFOLK', 1)],
        },
        failure: {
          text: 'The refusal doesn\'t land the way {hero} meant it to. By the time the war-band moves on, the storehouse is short more than they ever asked for, and the point has been made the hard way.',
          outcomes: [outcome.good('grain', -10), outcome.silver(-15), outcome.standing('BEASTFOLK', -3), outcome.stress(1)],
        },
        critFailure: {
          text: 'Refusing turns out to have been exactly the wrong read. What the war-band takes on the way out costs far more than the price {hero} wouldn\'t pay, and they leave certain the post is theirs to lean on whenever they like.',
          outcomes: [outcome.good('grain', -18), outcome.silver(-30), outcome.standing('BEASTFOLK', -6), outcome.stress(2)],
        },
      },
    ],
  }),
];
