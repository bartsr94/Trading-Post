// "Wings Against the Wind" — a 3-stage same-sitting chain
// (CHAIN_EVENTS_SPEC.md §5), mirroring the orc first-encounter chain
// (../orc/firstEncounter.ts) beat-for-beat per WILDS_FIRST_ENCOUNTER_SPEC.md.
// Stage 1 is directly queued the instant `harpy_eyrie` reaches `visited`
// (`LocationDef.discoveryEventId` — weight 0, never drawn by the weighted
// pool); stages 2-3 are category 'chain' (weight 0) and are only ever
// reached via continueChain, so their own `conditions`/`binding` are
// decorative (never re-checked at fire time — same convention as the orc
// and goblin first-encounter chains). See ./index.ts for shared context.

import type { GameEvent } from '../../../engine/events/types';
import { makeChoiceEvent, outcome } from '../eventHelpers';

export const HARPY_FIRST_ENCOUNTER_EVENTS: GameEvent[] = [
  makeChoiceEvent({
    id: 'harpy_first_encounter',
    category: 'post',
    illustration: 'harpy_first_sight',
    title: 'Wings Against the Wind',
    text: 'The climb past the treeline has been hard going for an hour when the wind carries a sound that isn\'t wind — wingbeats, close, and then not close, circling. By the time {hero} spots them against the grey they are already spotted in turn: three shapes wheeling low over the crag, then settling onto a broken shelf of rock just above, wings mantled, watching the strangers who have just found their way to the Windward Crags. Nothing here has ever answered to a name spoken from below.',
    conditions: [
      { type: 'locationDiscovery', location: 'harpy_eyrie', atLeast: 'visited' },
    ],
    weight: 0,
    once: true,
    binding: { type: 'highestStat', stat: 'resolve' },
    factions: ['HARPY'],
    peoples: ['harpy'],
    arc: 'harpy_first_encounter',
    choices: [
      {
        type: 'checked',
        label: 'Call up peacefully — hands open, no climbing further.',
        check: { skill: 'diplomacy', stat: 'charm', difficulty: 10, tags: ['diplomacy', 'strangers', 'HARPY'] },
        critSuccess: {
          text: '{hero} plants both feet, opens both hands, and calls up something closer to a greeting than a plea. The nearest of the three cocks her head at the sound of it — an unfamiliar shape, but not a threatening one — and drops off the ledge in an unhurried glide, landing rather than diving. That alone is answer enough.',
          outcomes: [
            { type: 'setChainVar', key: 'approach', value: 'peace' },
            outcome.standing('HARPY', 1),
            outcome.continueChain('harpy_first_encounter_talks'),
          ],
        },
        success: {
          text: '{hero}\'s voice carries up thin in the wind, and it\'s hard to say how much of it lands as words rather than noise. But the wings above stay mantled, not spread — no one dives. After a long, wind-scoured pause, one of the three drops down to look {him} over properly.',
          outcomes: [
            { type: 'setChainVar', key: 'approach', value: 'peace' },
            outcome.continueChain('harpy_first_encounter_talks'),
          ],
        },
        failure: {
          text: 'The words go up and mostly come back as echo. The three on the ledge don\'t move for a long, uncomfortable while — long enough that {hero} starts to wonder if silence is itself the answer. Eventually one drops down anyway, wary, talons never quite folded away.',
          outcomes: [
            { type: 'setChainVar', key: 'approach', value: 'peace' },
            outcome.stress(1),
            outcome.continueChain('harpy_first_encounter_talks'),
          ],
        },
        critFailure: {
          text: 'Something in the pitch or the timing reads as challenge rather than greeting, and the ledge empties in a single beat of wings — not gone, just circling now, lower and tighter than before. It\'s a long, exposed climb before one of them finally lands, and she does not land gently.',
          outcomes: [
            { type: 'setChainVar', key: 'approach', value: 'peace' },
            outcome.standing('HARPY', -1),
            outcome.stress(1),
            outcome.continueChain('harpy_first_encounter_talks'),
          ],
        },
      },
      {
        type: 'checked',
        label: 'Hold the ledge — stand steady and don\'t give ground.',
        check: { skill: 'combat', stat: 'resolve', difficulty: 10, tags: ['intimidation', 'HARPY'] },
        critSuccess: {
          text: '{hero} doesn\'t retreat a single step as the nearest drops into a stooping glide meant to test exactly that — and doesn\'t flinch when the down-draft of her wings hits like a wall at the last possible moment. She peels off and lands instead of striking, folding her wings with what might, in a harpy, pass for respect.',
          outcomes: [
            { type: 'setChainVar', key: 'approach', value: 'force' },
            outcome.standing('HARPY', 1),
            outcome.continueChain('harpy_first_encounter_talks'),
          ],
        },
        success: {
          text: 'The stoop comes fast and close, close enough to feel, and {hero} holds the ground anyway. It seems to be the right answer, or at least not the wrong one — she breaks off, circles once more, and drops onto a lower shelf of rock to get a proper look.',
          outcomes: [
            { type: 'setChainVar', key: 'approach', value: 'force' },
            outcome.continueChain('harpy_first_encounter_talks'),
          ],
        },
        failure: {
          text: '{hero} holds too long against a stoop that was never going to pull up gently — a raked shoulder, a stumble on the loose rock, nothing worse. She lands anyway once the point is made, watching {him} get back up with something that isn\'t quite sympathy.',
          outcomes: [
            { type: 'setChainVar', key: 'approach', value: 'force' },
            outcome.health(-2),
            outcome.continueChain('harpy_first_encounter_talks'),
          ],
        },
        critFailure: {
          text: 'Standing firm reads as standing still, and the stoop connects properly this time — talons, not just wind, and {hero} goes down hard on the scree before she pulls up. She lands to finish what she started looking at {him}, not to make peace.',
          outcomes: [
            { type: 'setChainVar', key: 'approach', value: 'force' },
            outcome.health(-4),
            outcome.stress(1),
            outcome.continueChain('harpy_first_encounter_talks'),
          ],
        },
      },
      {
        type: 'flat',
        label: 'Back off the crag — this isn\'t worth the fall.',
        text: '{hero} gives the ledge a wide, careful berth and starts back down, and the three watch the whole descent without ever leaving the rock. Whatever the Windward Crags are, they\'re not ready to be found today.',
        outcomes: [outcome.history('Backed off the Windward Crags rather than risk a first meeting with the harpies.')],
      },
    ],
  }),
  makeChoiceEvent({
    id: 'harpy_first_encounter_talks',
    illustration: 'harpy_ledge',
    title: 'Whoever Speaks for the Crags',
    text: 'She leads {hero} up a last, wind-scoured pitch of rock to a wider shelf where an older harpy waits, feathers gone grey-white at the crown, plainly the one the others answer to. She doesn\'t bother with ceremony any more than the wind does. "You climbed all this way," she says, in a voice pitched to carry over a gale. "So — why."',
    factions: ['HARPY'],
    peoples: ['harpy'],
    arc: 'harpy_first_encounter',
    choices: [
      {
        type: 'checked',
        label: 'Press for a lasting truce.',
        requires: [{ type: 'chainVar', key: 'approach', value: 'peace' }],
        check: { skill: 'diplomacy', stat: 'charm', difficulty: 12, tags: ['diplomacy', 'HARPY'] },
        success: {
          text: 'She hears {hero} out without once looking away, and when she finally speaks it\'s with the flat certainty of something already decided. "Then your post keeps its own roofs quiet, and the crags keep theirs. We\'ll see how long that holds."',
          outcomes: [
            { type: 'setChainVar', key: 'outcome', value: 'alliance' },
            outcome.continueChain('harpy_first_encounter_close'),
          ],
        },
        failure: {
          text: 'She listens, head tilted at an angle that reads as more predatory than curious, and isn\'t moved. "Words don\'t carry on this wind," she says. "Bring the crags something that does."',
          outcomes: [
            { type: 'setChainVar', key: 'outcome', value: 'token' },
            outcome.continueChain('harpy_first_encounter_close'),
          ],
        },
      },
      {
        type: 'checked',
        label: 'Make clear the post\'s roofs are not theirs to lift.',
        requires: [{ type: 'chainVar', key: 'approach', value: 'force' }],
        check: { skill: 'leadership', stat: 'resolve', difficulty: 12, tags: ['intimidation', 'HARPY'] },
        success: {
          text: '{hero} states it plainly and doesn\'t raise {his} voice to match hers. She weighs the words against whatever the others already reported about the stoop that didn\'t break {him}, and something in her stance eases — not warmth, but a predator\'s regard for something that didn\'t run.',
          outcomes: [
            { type: 'setChainVar', key: 'outcome', value: 'respect' },
            outcome.continueChain('harpy_first_encounter_close'),
          ],
        },
        failure: {
          text: 'The warning lands as noise, not weight — she\'s plainly heard louder from creatures with far less reason to be loud. "Careful," she says, mild as the wind isn\'t. "The crags remember tone longer than words."',
          outcomes: [
            { type: 'setChainVar', key: 'outcome', value: 'grudge' },
            outcome.continueChain('harpy_first_encounter_close'),
          ],
        },
      },
      {
        type: 'flat',
        label: 'Leave what little you carry as a gesture.',
        text: '{hero} sets down what {he} has — not much, but freely given — and steps back without pressing further. She turns it over with a talon, unreadable, and finally lets it be. "Go, then. The gesture will be remembered, if nothing else.',
        outcomes: [
          { type: 'setChainVar', key: 'outcome', value: 'token' },
          outcome.continueChain('harpy_first_encounter_close'),
        ],
      },
    ],
  }),
  makeChoiceEvent({
    id: 'harpy_first_encounter_close',
    illustration: 'harpy_departure',
    title: 'What the Wind Carries Down',
    text: '{hero} makes the long climb back down with the whole exchange still turning over — the kind of first meeting the crags and the post will measure each other by for a long while yet.',
    factions: ['HARPY'],
    peoples: ['harpy'],
    arc: 'harpy_first_encounter',
    choices: [
      {
        type: 'flat',
        label: 'Seal it — send word back confirming the terms.',
        requires: [{ type: 'chainVar', key: 'outcome', value: 'alliance' }],
        text: 'Word comes back on a harpy\'s own wing before the season turns: the terms hold, and a scrap of bright wire is dropped at the gate with it — worthless to a post ledger, plainly precious to whoever chose to part with it.',
        outcomes: [
          outcome.standing('HARPY', 6),
          { type: 'tribute', faction: 'HARPY', direction: 'receive', goods: { furs: 1 } },
          outcome.history('Struck a lasting understanding with the harpies of the Windward Crags.'),
        ],
      },
      {
        type: 'flat',
        label: 'Let the terms stand as given.',
        requires: [{ type: 'chainVar', key: 'outcome', value: 'respect' }],
        text: 'Nothing more passes between the crags and the post, and nothing more needs to. The wind keeps its own counsel, and so, for now, do the harpies — a cold sort of peace, but held.',
        outcomes: [outcome.standing('HARPY', 4), outcome.history('Won a wary respect from the harpies without striking a bargain.')],
      },
      {
        type: 'flat',
        label: 'Let it lie — pressing further would only make it worse.',
        requires: [{ type: 'chainVar', key: 'outcome', value: 'grudge' }],
        text: 'The parting was cold on the ledge and it stays cold in the telling. No talons follow the party down, but no warmth either — the crags will remember {hero}\'s tone longer than {his} words.',
        outcomes: [outcome.standing('HARPY', -2), outcome.history('Left the harpies with a grudge after a tense first meeting.')],
      },
      {
        type: 'flat',
        label: 'Consider the exchange complete.',
        requires: [{ type: 'chainVar', key: 'outcome', value: 'token' }],
        text: 'The gift changes hands on the wind and the moment closes itself out — no promises made, none broken, a small debt of courtesy paid at altitude.',
        outcomes: [outcome.good('hides', -2), outcome.standing('HARPY', 2), outcome.history('Traded a token gift with the harpies at first meeting.')],
      },
      {
        type: 'flat',
        label: 'Let the whole thing end here.',
        text: 'Whatever the crags make of the encounter, the post hears nothing further of it — for now.',
        outcomes: [outcome.standing('HARPY', 1), outcome.history('A first encounter with the harpies ended without further word either way.')],
      },
    ],
  }),
];
