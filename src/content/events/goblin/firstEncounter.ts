// "A Committee of One Bad Idea" — goblin first-encounter, deliberately NOT
// built like beastfolk_first_encounter (../../orc/firstEncounter.ts).
// That chain is a grim standoff that funnels three opening choices into one
// shared `_talks` checkpoint and a shared `_close`. This one is whimsical —
// goblins are a nuisance, not a threat — and the three real choices below
// each `continueChain` straight to their OWN self-contained chain-stage
// event with its own check and ending. Nothing reconverges: the branches
// are meant to genuinely diverge, not braid back together (2026-07-27,
// EVENT_ORGANIZATION_SPEC.md). See ../goblin/index.ts for shared context.
// New content — uses the `goblin_` prefix (mirrors `harpy_`), unlike the
// legacy `beastfolk_goblin_*` ids elsewhere in this directory.

import type { GameEvent } from '../../../engine/events/types';
import { makeChoiceEvent, outcome } from '../eventHelpers';

export const GOBLIN_FIRST_ENCOUNTER_EVENTS: GameEvent[] = [
  makeChoiceEvent({
    id: 'goblin_first_encounter',
    category: 'post',
    illustration: 'goblin_mischief',
    title: 'A Committee of One Bad Idea',
    text: 'A knot of goblins crouches in the branches over the trail, mid-argument over a rope-and-bucket rig swaying gently above the path — and over which of them deserves to be under it when it drops. Nobody has noticed {hero} yet. Then all of them do, at once, and the argument stops dead. Whatever they decide next, {hero} has just become a very convenient tiebreaker.',
    conditions: [{ type: 'locationDiscovery', location: 'goblin_wilds', atLeast: 'visited' }],
    weight: 7,
    once: true,
    binding: { type: 'random' },
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    arc: 'goblin_first_encounter',
    choices: [
      {
        type: 'flat',
        label: 'Play along — offer yourself as the target, or a better prank.',
        text: '{hero} steps into the argument like a party guest arriving fashionably late, and the goblins go quiet in a different way now — considering. This might actually be more fun with a volunteer.',
        outcomes: [outcome.continueChain('goblin_first_encounter_jest')],
      },
      {
        type: 'flat',
        label: 'Shut it down before somebody actually gets hurt.',
        text: '{hero} steps out of the treeline with the particular voice reserved for children about to do something regrettable. Every goblin head turns at once, all wearing the same guilty expression.',
        outcomes: [outcome.continueChain('goblin_first_encounter_scold')],
      },
      {
        type: 'flat',
        label: 'See what they will trade for whatever is rigged up there.',
        text: '{hero} calls up something more interesting than a scolding: an offer. The argument overhead stops instantly — goblins, it turns out, will drop almost anything for the right price.',
        outcomes: [outcome.continueChain('goblin_first_encounter_trade')],
      },
      {
        type: 'flat',
        label: 'Leave them to it — not your problem today.',
        text: '{hero} keeps walking. Behind, the argument resumes at once, louder than before, as if {hero} had never been there at all.',
        outcomes: [outcome.history('Walked past a goblin scheme in progress without getting involved.')],
      },
    ],
  }),
  makeChoiceEvent({
    id: 'goblin_first_encounter_jest',
    illustration: 'goblin_mischief',
    title: 'One of the Committee, Apparently',
    text: 'They haul {hero} up into the argument like a missing vote. The bucket holds pond mud, it turns out, and the target was always going to be picked by lot — {hero} has just been nominated to either be it, or to help rig something worse. The goblins are delighted either way. This is clearly the best thing that has happened to them all week.',
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    arc: 'goblin_first_encounter',
    choices: [
      {
        type: 'checked',
        label: 'Take the mud like a good sport.',
        check: { skill: 'stealth', stat: 'agility', difficulty: 10, tags: ['BEASTFOLK', 'gamble'] },
        critSuccess: {
          text: '{hero} takes the drop, twists at the last second so it catches a shoulder instead of a face, and comes up laughing before the goblins do. They have never seen anyone enjoy losing this much, and it wins them over completely — word of the good sport at the post spreads fast, and a few of them start turning up at market just to see what else {hero} will agree to.',
          outcomes: [
            outcome.standing('BEASTFOLK', 4),
            { type: 'addTransient', kind: 'beastfolkVisitors', count: 3, turns: 2 },
            outcome.history('Took a goblin prank in good humor and won their delighted approval.'),
          ],
        },
        success: {
          text: '{hero} eats the mud, mostly, and manages a good-natured shrug about it. The goblins consider this an acceptable outcome and immediately start planning the next one.',
          outcomes: [outcome.standing('BEASTFOLK', 2), outcome.stress(1)],
        },
        failure: {
          text: '{hero} slips at exactly the wrong moment and goes down harder than the prank called for, mud and all. Even the goblins wince, in a way that suggests this one got away from them too.',
          outcomes: [outcome.health(-2), outcome.stress(1)],
        },
        critFailure: {
          text: '{hero} goes down badly and twists an ankle on the landing. The goblins have the good grace to look briefly concerned before the laughing resumes. Small mercies.',
          outcomes: [outcome.health(-4), outcome.stress(2)],
        },
      },
      {
        type: 'flat',
        label: 'Talk your way into nominating someone else.',
        text: '{hero} argues, diplomatically, for a different volunteer — and after a brief, surprisingly civil debate, the committee agrees to dump the mud somewhere ceremonial instead. Nobody is proud of the compromise. Nobody is covered in mud either.',
        outcomes: [outcome.standing('BEASTFOLK', 1)],
      },
    ],
  }),
  makeChoiceEvent({
    id: 'goblin_first_encounter_scold',
    illustration: 'goblin_mischief',
    title: 'The Tree Empties Out',
    text: '{hero}\'s voice does what it was meant to do — mostly. The committee scrambles, the argument forgotten, everyone suddenly very interested in being somewhere else. Whether the rig comes down peacefully or comes down on somebody\'s head on the way out is still, for a moment, an open question.',
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    arc: 'goblin_first_encounter',
    choices: [
      {
        type: 'checked',
        label: 'Order them down and confiscate the rig.',
        check: { skill: 'leadership', stat: 'resolve', difficulty: 10, tags: ['BEASTFOLK', 'intimidation'] },
        critSuccess: {
          text: '{hero}\'s voice cracks like a whip and the whole committee scrambles down so fast two of them fall out of the tree entirely. The rig comes apart in {hero}\'s hands almost gratefully, like it never wanted to be built in the first place. Chastened goblins, it turns out, remember exactly who scared them — and repeat it as a very flattering story.',
          outcomes: [outcome.standing('BEASTFOLK', 3), outcome.history('Scattered a goblin scheme with a single well-aimed order.')],
        },
        success: {
          text: 'The tree empties out and the rope comes down without a fight. {hero} confiscates the bucket as a matter of principle, which nobody, goblin or otherwise, seems to think was strictly necessary.',
          outcomes: [outcome.standing('BEASTFOLK', 1)],
        },
        failure: {
          text: 'The goblins scatter, but not before somebody yanks the rope out of spite on the way down. The bucket lands exactly on schedule — on {hero}, this time. The tree, it seems, gets the last word.',
          outcomes: [outcome.stress(1), outcome.standing('BEASTFOLK', -1)],
        },
        critFailure: {
          text: 'The scolding lands as a challenge rather than a warning, and by the time {hero} climbs down — soaked, furious, mud to the collarbone — the goblins are long gone with the bucket, the rope, and, inexplicably, one boot.',
          outcomes: [outcome.silver(-8), outcome.stress(1), outcome.standing('BEASTFOLK', -2)],
        },
      },
      {
        type: 'flat',
        label: 'Let it go — you have bigger problems than a bucket.',
        text: '{hero} decides a rope-and-bucket squabble is beneath the post\'s notice, for now, and walks on before the committee reconvenes.',
        outcomes: [outcome.history('Left a goblin scheme to sort itself out.')],
      },
    ],
  }),
  makeChoiceEvent({
    id: 'goblin_first_encounter_trade',
    illustration: 'goblin_mischief',
    title: 'Everything Has a Price, Apparently',
    text: 'The argument overhead pauses entirely at the word "offer," and eight goblins lean down out of the branches at once, extremely interested. Whatever {hero} has to trade, it had better be worth breaking up the committee for — they will absolutely still take it even if it isn\'t.',
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    arc: 'goblin_first_encounter',
    choices: [
      {
        type: 'checked',
        label: 'Haggle for the whole rig, rope and all.',
        check: { skill: 'bargain', stat: 'charm', difficulty: 10, tags: ['BEASTFOLK'] },
        critSuccess: {
          text: 'They practically throw the rig at {hero} for something no post ledger will ever itemize — a shiny button, torn off {hero}\'s own coat mid-negotiation without anyone quite noticing until after the deal was done. The goblins leave delighted with the button. {hero} leaves with the rope, the bucket, and a story that improves every time it\'s told.',
          outcomes: [outcome.standing('BEASTFOLK', 3), outcome.history('Talked a goblin committee out of their entire prank rig.')],
        },
        success: {
          text: '{hero} talks them down to something reasonable — a few tools traded for the rig — and the committee disbands satisfied, already arguing about what to build next.',
          outcomes: [outcome.good('tools', -2), outcome.standing('BEASTFOLK', 2)],
        },
        failure: {
          text: 'The goblins out-haggle {hero} without much effort, walking off with more than the rig was worth and the distinct impression they got the better end of it — which, this time, they did.',
          outcomes: [outcome.good('tools', -4)],
        },
        critFailure: {
          text: 'By the time the deal is done {hero} has somehow traded away far more than intended, and the goblins vanish into the branches cackling, rig and all, leaving {hero} to work out exactly when that got away from {him}.',
          outcomes: [outcome.silver(-12), outcome.good('tools', -3)],
        },
      },
      {
        type: 'flat',
        label: 'Not worth the haggling — walk on.',
        text: '{hero} decides the rig isn\'t worth the negotiation and keeps walking, ignoring the outraged offers shouted after {him}.',
        outcomes: [outcome.history('Declined to haggle with a goblin committee over their prank rig.')],
      },
    ],
  }),
];
