// Goblin ambush — a travel encounter gated on a persistent per-hero counter
// (TRAVEL_AMBUSH_SPEC.md) rather than a single event's tiered outcomes: the
// check itself ("Watch the treeline") is identical in all three variants,
// but which of these three mutually-exclusive events is even eligible
// depends on how many times *this specific hero* has already failed it
// (`heroCounterAtMost`/`heroCounterAtLeast` on the counter key
// 'goblin_ambush_fails'). Only the check's failure/critFailure increments
// the counter — taking the no-check "push on" alternative isn't "failing to
// improve," it's not trying, so it never feeds the escalation. See
// ./index.ts for shared context.

import type { GameEvent } from '../../../engine/events/types';

const AMBUSH_COUNTER_KEY = 'goblin_ambush_fails';

export const GOBLIN_AMBUSH_EVENTS: GameEvent[] = [
  {
    id: 'travel_goblin_ambush',
    category: 'travel',
    illustration: 'goblin_mischief',
    title: 'Something in the Brush',
    text: 'The scrub goes quiet in a way that live scrub never quite manages, and a snare-line of braided vine sags across the trail just ahead — new, and badly hidden. Goblins, going by the giggling nobody has quite suppressed. {hero} slows, the way you do when the ground itself seems to be waiting for something.',
    conditions: [
      { type: 'destinationTag', tag: 'goblin' },
      { type: 'heroCounterAtMost', key: AMBUSH_COUNTER_KEY, value: 0 },
    ],
    weight: 10,
    cooldownTurns: 4,
    binding: { type: 'random' },
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    arc: 'goblin_ambush',
    choices: [
      {
        label: 'Watch the treeline as you walk.',
        check: { skill: 'survival', stat: 'wits', difficulty: 9, tags: ['BEASTFOLK'] },
        outcomes: {
          critSuccess: {
            text: '{hero} clocks the snare, the lookout, and the second lookout pretending to be a stump, all before the trap is even sprung. A pointed look in their direction is answer enough — the giggling stops, and the whole ambush quietly evaporates.',
            outcomes: [{ type: 'history', text: 'Spotted a goblin ambush before it could spring.' }],
          },
          success: {
            text: '{hero} sidesteps the snare a stride before it matters, and the goblins who meant to rush out of the brush instead have to stand up out of it, caught looking foolish rather than fearsome. They settle for jeering as the party walks on.',
            outcomes: [{ type: 'stress', delta: -1 }],
          },
          failure: {
            text: 'The snare finds a foot after all, and by the time {hero} is back upright half the party\'s pockets have already been gone through by small, quick hands. They\'re gone into the scrub before anyone lands a blow, hooting the whole way.',
            outcomes: [
              { type: 'expeditionSilver', delta: -12 },
              { type: 'cargo', good: 'cloth', delta: -2 },
              { type: 'stress', delta: 1 },
              { type: 'heroCounter', key: AMBUSH_COUNTER_KEY, delta: 1 },
            ],
          },
          critFailure: {
            text: 'The snare drops {hero} flat, and what follows is less a robbery than a ransacking — cargo, coin, and a fair bit of dignity, carried off giggling into the brush while {hero} is still working out which way is up.',
            outcomes: [
              { type: 'expeditionSilver', delta: -20 },
              { type: 'cargo', good: 'cloth', delta: -4 },
              { type: 'health', delta: -1 },
              { type: 'stress', delta: 2 },
              { type: 'heroCounter', key: AMBUSH_COUNTER_KEY, delta: 1 },
            ],
          },
        },
      },
      {
        label: 'Push on and pretend not to notice.',
        outcomes: {
          success: {
            text: 'Not noticing turns out to be exactly what the snare was counting on. The toll is quick, almost polite by goblin standards, and the party is moving again before the giggling even properly starts.',
            outcomes: [
              { type: 'expeditionSilver', delta: -8 },
              { type: 'cargo', good: 'cloth', delta: -1 },
            ],
          },
        },
      },
    ],
  },
  {
    id: 'travel_goblin_ambush_again',
    category: 'travel',
    illustration: 'goblin_encounter_01',
    title: 'The Same Trick Twice',
    text: 'Same stretch of scrub, same badly-hidden snare — and this time the giggling has names in it. "{hero}! {hero} again!" A goblin is actually keeping score on a stick. Whatever dignity survived the first time this happened is not going to survive this one; they are delighted to see {hero}, and delight is not a good sign here.',
    conditions: [
      { type: 'destinationTag', tag: 'goblin' },
      { type: 'heroCounterAtLeast', key: AMBUSH_COUNTER_KEY, value: 1 },
      { type: 'heroCounterAtMost', key: AMBUSH_COUNTER_KEY, value: 3 },
    ],
    weight: 10,
    cooldownTurns: 4,
    binding: { type: 'random' },
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    arc: 'goblin_ambush',
    choices: [
      {
        label: 'Watch the treeline as you walk.',
        check: { skill: 'survival', stat: 'wits', difficulty: 9, tags: ['BEASTFOLK'] },
        outcomes: {
          critSuccess: {
            text: '{hero} finds the snare, the lookout, and the scorekeeper before any of them find {him}, and the look on their faces is worth almost as much as the toll they don\'t get to collect. The scoring-stick goes back in a pocket, unmarked.',
            outcomes: [{ type: 'history', text: 'Beat the goblins at their own repeat trick.' }],
          },
          success: {
            text: '{hero} spots it in time, barely, and the goblins have to settle for razzing {him} about how close it was rather than actually taking anything. Close enough that it still stings.',
            outcomes: [{ type: 'stress', delta: -1 }],
          },
          failure: {
            text: 'The snare works exactly as well as it did last time, which the goblins find hilarious. "Still doesn\'t look!" one shouts to the others, delighted, while the rest empty pockets that {hero} really ought to be watching by now.',
            outcomes: [
              { type: 'expeditionSilver', delta: -14 },
              { type: 'cargo', good: 'cloth', delta: -2 },
              { type: 'stress', delta: 2 },
              { type: 'heroCounter', key: AMBUSH_COUNTER_KEY, delta: 1 },
            ],
          },
          critFailure: {
            text: 'The whole band turns out for this one, apparently — word travels fast in the wilds when there\'s a running joke to enjoy. {hero} goes down hard and comes up lighter in every sense, to genuine applause.',
            outcomes: [
              { type: 'expeditionSilver', delta: -22 },
              { type: 'cargo', good: 'cloth', delta: -4 },
              { type: 'health', delta: -1 },
              { type: 'stress', delta: 2 },
              { type: 'heroCounter', key: AMBUSH_COUNTER_KEY, delta: 1 },
            ],
          },
        },
      },
      {
        label: 'Push on and pretend not to notice.',
        outcomes: {
          success: {
            text: '"There he goes again," someone says, almost fondly, and the toll comes and goes with the easy familiarity of a running bit both sides know the shape of.',
            outcomes: [
              { type: 'expeditionSilver', delta: -8 },
              { type: 'cargo', good: 'cloth', delta: -1 },
            ],
          },
        },
      },
    ],
  },
  {
    id: 'travel_goblin_ambush_tired',
    category: 'travel',
    illustration: 'goblin_arrival',
    title: "Tired of the Game",
    text: 'The snare is barely hidden at all this time — nobody bothered. A dozen goblins sit around it in plain sight, arms crossed, and there is no giggling at all. "{hero} again," one says flatly, to no one in particular, the way you\'d announce a chore. This has stopped being funny to them, which is somehow worse than the mockery ever was.',
    conditions: [
      { type: 'destinationTag', tag: 'goblin' },
      { type: 'heroCounterAtLeast', key: AMBUSH_COUNTER_KEY, value: 4 },
    ],
    weight: 10,
    cooldownTurns: 4,
    binding: { type: 'random' },
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    arc: 'goblin_ambush',
    choices: [
      {
        label: 'Watch the treeline as you walk.',
        check: { skill: 'survival', stat: 'wits', difficulty: 9, tags: ['BEASTFOLK'] },
        outcomes: {
          critSuccess: {
            text: '{hero} sees it coming from a hundred paces off and simply walks the party around the whole sorry setup. The dozen goblins watch him go, and for once nobody has anything to say at all — which, from this crowd, is close to an apology.',
            outcomes: [
              { type: 'history', text: 'Finally outfoxed the goblins who\'d given up on the joke.' },
            ],
          },
          success: {
            text: '{hero} catches the snare just in time, and the goblins let the party pass without much fuss — proving the point was never really about the toll. One of them mutters something that sounds almost like relief.',
            outcomes: [{ type: 'stress', delta: -1 }],
          },
          failure: {
            text: 'Caught again, same as always — except this time nobody laughs. They take what they came for with brisk, businesslike hands, and one mutters that they\'re done making a show of it, whatever that means.',
            outcomes: [
              { type: 'expeditionSilver', delta: -16 },
              { type: 'cargo', good: 'cloth', delta: -2 },
              { type: 'stress', delta: 2 },
              { type: 'heroCounter', key: AMBUSH_COUNTER_KEY, delta: 1 },
            ],
          },
          critFailure: {
            text: '"Enough," someone says, and it isn\'t a joke anymore. This isn\'t a robbery — the goblins bind {hero}, unhurried and entirely serious, and are gone into the deep scrub with him before the rest of the party can do much more than shout. They\'re done playing games; apparently he wasn\'t going to stop losing to them any other way.',
            outcomes: [
              { type: 'captureHero', faction: 'BEASTFOLK' },
              { type: 'heroCounter', key: AMBUSH_COUNTER_KEY, delta: 1 },
              {
                type: 'history',
                text: 'Fell for the same goblin ambush one time too many, and was carried off for it.',
              },
            ],
          },
        },
      },
      {
        label: 'Push on and pretend not to notice.',
        outcomes: {
          success: {
            text: 'Nobody so much as raises a voice this time. The toll is taken in near-total silence, businesslike and joyless, and the party is waved on like a chore that\'s been dealt with.',
            outcomes: [
              { type: 'expeditionSilver', delta: -10 },
              { type: 'cargo', good: 'cloth', delta: -1 },
            ],
          },
        },
      },
    ],
  },
];
