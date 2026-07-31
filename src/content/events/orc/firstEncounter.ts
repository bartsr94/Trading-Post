// "A Patrol at the Treeline" — a 3-stage same-sitting chain
// (CHAIN_EVENTS_SPEC.md §5), the showcase for continueChain/chainVar.
// Stage 1 is the only one drawn by the weighted pool; stages 2-3 are
// category 'chain' (weight 0) and are only ever reached via continueChain,
// so their own `conditions` are decorative (never re-checked at fire time
// — same convention as the existing post_amber_find chain stage). See
// ./index.ts for shared context.
//
// Orc-only (narrowed 2026-07-27 when Goblins got their own first-encounter
// chain, ../../goblin/firstEncounter.ts, with a deliberately different,
// whimsical tone — this one stays the grim/wary standoff). Ids keep the
// `beastfolk_` prefix despite being people-specific now, matching the
// existing beastfolk_orc_*/beastfolk_goblin_* convention — no id renames.

import type { GameEvent } from '../../../engine/events/types';
import { makeChoiceEvent, outcome } from '../eventHelpers';

export const ORC_FIRST_ENCOUNTER_EVENTS: GameEvent[] = [
  makeChoiceEvent({
    id: 'beastfolk_first_encounter',
    category: 'post',
    illustration: 'beastfolk_patrol',
    title: 'Eyes at the Treeline',
    text: 'The treeline breaks without warning: an orc patrol, spears low but not raised, watching from twenty paces like they\'ve been watching longer than that. No war-band flag, no clan token — just eyes on {hero}, waiting to see what the post\'s people do with a moment like this. Whatever happens next, they\'ll carry the telling of it home.',
    conditions: [
      { type: 'locationDiscovery', location: 'beast_wilds', atLeast: 'visited' },
    ],
    weight: 7,
    once: true,
    binding: { type: 'highestStat', stat: 'resolve' },
    factions: ['BEASTFOLK'],
    peoples: ['orc'],
    arc: 'orc_first_encounter',
    choices: [
      {
        type: 'checked',
        label: 'Speak first — offer words, not weapons.',
        check: { skill: 'diplomacy', stat: 'charm', difficulty: 10, tags: ['diplomacy', 'strangers', 'BEASTFOLK'] },
        critSuccess: {
          text: '{hero} opens both hands and speaks slow, plain, unhurried — the oldest of the patrol lowers her spear first, and the rest follow half a beat later. It isn\'t trust yet, but it\'s the shape trust could take.',
          outcomes: [
            { type: 'setChainVar', key: 'approach', value: 'peace' },
            outcome.standing('BEASTFOLK', 1),
            outcome.continueChain('beastfolk_first_encounter_talks'),
          ],
        },
        success: {
          text: '{hero}\'s words land somewhere short of welcome and short of trouble. The patrol doesn\'t lower its guard, but it doesn\'t press either — they gesture {hero} to follow, toward whoever back at the camp actually decides things.',
          outcomes: [
            { type: 'setChainVar', key: 'approach', value: 'peace' },
            outcome.continueChain('beastfolk_first_encounter_talks'),
          ],
        },
        failure: {
          text: '{hero} talks, and the patrol listens with the particular patience of people who\'ve heard promises before. No blood spilled, but no ground gained either — they wave {hero} on toward the camp anyway, unconvinced.',
          outcomes: [
            { type: 'setChainVar', key: 'approach', value: 'peace' },
            outcome.stress(1),
            outcome.continueChain('beastfolk_first_encounter_talks'),
          ],
        },
        critFailure: {
          text: 'Something in {hero}\'s tone or timing goes wrong, and the goodwill drains out of the moment fast. The patrol closes ranks, spears no longer quite so low — but they still, grudgingly, lead {hero} toward the camp instead of driving {him} off.',
          outcomes: [
            { type: 'setChainVar', key: 'approach', value: 'peace' },
            outcome.standing('BEASTFOLK', -1),
            outcome.stress(1),
            outcome.continueChain('beastfolk_first_encounter_talks'),
          ],
        },
      },
      {
        type: 'checked',
        label: 'Show strength — plant your feet and don\'t move.',
        check: { skill: 'combat', stat: 'might', difficulty: 10, tags: ['intimidation', 'BEASTFOLK'] },
        critSuccess: {
          text: '{hero} doesn\'t reach for a weapon — doesn\'t need to. Something in the stillness reads as its own kind of threat, and the patrol\'s spears come up a fraction, then, unmistakably, ease back down. Respect, of a wary kind.',
          outcomes: [
            { type: 'setChainVar', key: 'approach', value: 'force' },
            outcome.standing('BEASTFOLK', 1),
            outcome.continueChain('beastfolk_first_encounter_talks'),
          ],
        },
        success: {
          text: '{hero} holds ground and holds it well. The patrol studies {him} a long moment, weighing the risk of a fight against whatever they came here to do — then falls back half a step and gestures {him} toward the camp.',
          outcomes: [
            { type: 'setChainVar', key: 'approach', value: 'force' },
            outcome.continueChain('beastfolk_first_encounter_talks'),
          ],
        },
        failure: {
          text: 'The standoff runs longer than it should, and it\'s {hero} who breaks first, not by choice — a shoved shoulder, a scraped forearm, nothing worse. The patrol seems almost amused. They lead {him} on anyway.',
          outcomes: [
            { type: 'setChainVar', key: 'approach', value: 'force' },
            outcome.health(-2),
            outcome.continueChain('beastfolk_first_encounter_talks'),
          ],
        },
        critFailure: {
          text: 'It goes physical fast, and badly — {hero} comes out of it bruised and short of breath, and the lesson the patrol takes isn\'t the one intended. They march {him} toward the camp less as an equal than as a catch.',
          outcomes: [
            { type: 'setChainVar', key: 'approach', value: 'force' },
            outcome.health(-4),
            outcome.stress(1),
            outcome.continueChain('beastfolk_first_encounter_talks'),
          ],
        },
      },
      {
        type: 'flat',
        label: 'Withdraw quietly — this isn\'t a fight worth having.',
        text: '{hero} backs away slow and empty-handed, and the patrol lets {him} go without a word — watching until the treeline swallows {him} again. Whatever this was, it\'s over before it started.',
        outcomes: [outcome.history('Backed away from an orc patrol at the treeline rather than risk a first meeting.')],
      },
    ],
  }),
  makeChoiceEvent({
    id: 'beastfolk_first_encounter_talks',
    illustration: 'beastfolk_camp',
    title: 'Whoever Speaks for Them',
    text: 'The patrol brings {hero} in past the cook-fires to someone who wears no obvious mark of rank but is plainly the one they answer to. She doesn\'t waste time on ceremony. "You\'re here," she says. "So — why."',
    factions: ['BEASTFOLK'],
    peoples: ['orc'],
    arc: 'orc_first_encounter',
    choices: [
      {
        type: 'checked',
        label: 'Press for a lasting truce.',
        requires: [{ type: 'chainVar', key: 'approach', value: 'peace' }],
        check: { skill: 'diplomacy', stat: 'charm', difficulty: 12, tags: ['diplomacy', 'BEASTFOLK'] },
        success: {
          text: 'She hears {hero} out fully, weighing every word, and when she finally nods it\'s with the air of someone who has decided something larger than one conversation warranted. "Then we\'ll see if your post keeps its word better than the last one did."',
          outcomes: [
            { type: 'setChainVar', key: 'outcome', value: 'alliance' },
            outcome.continueChain('beastfolk_first_encounter_close'),
          ],
        },
        failure: {
          text: 'She listens, but the offer doesn\'t move her the way {hero} hoped — too soon, too easy, too much like every other stranger who\'s promised more than they meant. "Words are cheap," she says. "Bring me something else next time."',
          outcomes: [
            { type: 'setChainVar', key: 'outcome', value: 'token' },
            outcome.continueChain('beastfolk_first_encounter_close'),
          ],
        },
      },
      {
        type: 'checked',
        label: 'Demand they keep clear of the post\'s ground.',
        requires: [{ type: 'chainVar', key: 'approach', value: 'force' }],
        check: { skill: 'leadership', stat: 'resolve', difficulty: 12, tags: ['intimidation', 'BEASTFOLK'] },
        success: {
          text: '{hero} states the terms plainly and doesn\'t soften them. She weighs the demand against the patrol\'s report of what happened at the treeline, and something in her expression settles — not friendship, but a kind of respect for someone who doesn\'t waste her time.',
          outcomes: [
            { type: 'setChainVar', key: 'outcome', value: 'respect' },
            outcome.continueChain('beastfolk_first_encounter_close'),
          ],
        },
        failure: {
          text: 'The demand doesn\'t land as strength — it lands as posturing, and she\'s clearly heard enough of that from enough people. "Careful," she says, not raising her voice at all, which is somehow worse. "That tone gets remembered."',
          outcomes: [
            { type: 'setChainVar', key: 'outcome', value: 'grudge' },
            outcome.continueChain('beastfolk_first_encounter_close'),
          ],
        },
      },
      {
        type: 'flat',
        label: 'Leave a token of goodwill and go.',
        text: '{hero} offers what little {he}\'s carrying — not much, but freely given — and says nothing more. She turns it over in her hands, unreadable, and finally sets it aside. "Go on, then. We\'ll remember the gesture, at least."',
        outcomes: [
          { type: 'setChainVar', key: 'outcome', value: 'token' },
          outcome.continueChain('beastfolk_first_encounter_close'),
        ],
      },
    ],
  }),
  makeChoiceEvent({
    id: 'beastfolk_first_encounter_close',
    illustration: 'beastfolk_parting',
    title: 'What Comes of It',
    text: '{hero} makes it back to the post with the whole conversation still turning over — the kind of first meeting that will color everything the wilds and the post are to each other from here.',
    factions: ['BEASTFOLK'],
    peoples: ['orc'],
    arc: 'orc_first_encounter',
    choices: [
      {
        type: 'flat',
        label: 'Seal it — send word back confirming the terms.',
        requires: [{ type: 'chainVar', key: 'outcome', value: 'alliance' }],
        text: 'The messenger returns before the season\'s out: the terms hold, and with them a small gift, wrapped in leaf and cord, sent as much to test the post\'s manners as to please it.',
        outcomes: [
          outcome.standing('BEASTFOLK', 6),
          { type: 'tribute', faction: 'BEASTFOLK', direction: 'receive', goods: { hides: 2 } },
          outcome.history('Struck a lasting understanding with an orc patrol at the treeline.'),
        ],
      },
      {
        type: 'flat',
        label: 'Let the terms stand as given.',
        requires: [{ type: 'chainVar', key: 'outcome', value: 'respect' }],
        text: 'Nothing more is said, and nothing more needs to be. The wilds hold to the line {hero} drew, and the post holds to its own — a cold sort of peace, but peace.',
        outcomes: [outcome.standing('BEASTFOLK', 4), outcome.history('Won a wary respect from an orc patrol without striking a bargain.')],
      },
      {
        type: 'flat',
        label: 'Let it lie — pressing further would only make it worse.',
        requires: [{ type: 'chainVar', key: 'outcome', value: 'grudge' }],
        text: 'The parting was cold and it stays cold. No violence comes of it, but no warmth either — the wilds will remember {hero}\'s tone longer than they remember {his} words.',
        outcomes: [outcome.standing('BEASTFOLK', -2), outcome.history('Left an orc patrol with a grudge after a tense first meeting.')],
      },
      {
        type: 'flat',
        label: 'Consider the exchange complete.',
        requires: [{ type: 'chainVar', key: 'outcome', value: 'token' }],
        text: 'The gift changes hands and the moment closes itself out — no promises made, none broken, just a small debt of courtesy paid in full.',
        outcomes: [outcome.good('grain', -3), outcome.standing('BEASTFOLK', 2), outcome.history('Traded a token gift with an orc patrol at first meeting.')],
      },
      {
        type: 'flat',
        label: 'Let the whole thing end here.',
        text: 'Whatever the wilds make of the encounter, the post hears nothing further of it — for now.',
        outcomes: [outcome.standing('BEASTFOLK', 1), outcome.history('A first encounter with an orc patrol ended without further word either way.')],
      },
    ],
  }),
];
