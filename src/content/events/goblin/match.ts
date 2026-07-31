// Goblin marriage chain — a courtship earned over three stages rather than
// decided in one roll (GOBLIN_MATCH_CHAIN_SPEC.md), mirroring the shape
// orc_match_watched/_trading/_returns established. Diverges from the Orc
// chain in two ways: it's a group proposal (a whole goblin band, not one
// suitor) resolved by repeating the `formUnion` outcome once per bride
// rather than a single marriage choice, and it's gated on the post's own
// buildings impressing the goblins (`palisade` unlocks stage 1, `common_house`
// unlocks stage 2's real choice) rather than a goblin-built structure —
// goblins are hunter-gatherers with no comparable architecture of their own,
// so it's the post's comforts doing the impressing. `heroUnmarried` gates
// the whole chain (not `heroCanMarry`, unlike Orc) — the in-fiction logic is
// that a hero with no existing wife has no reason to turn any of them down.
// Stage 1's `critFailure` can end in a real abduction (`captureHero`
// outcome, engine/captivity.ts) rather than just a stress tick — the first
// event to use that outcome. See ./index.ts for shared context.

import type { GameEvent } from '../../../engine/events/types';
import { makeChoiceEvent, outcome } from '../eventHelpers';

export const GOBLIN_MATCH_EVENTS: GameEvent[] = [
  makeChoiceEvent({
    id: 'goblin_match_skulking',
    category: 'post',
    illustration: 'goblin_encounter_01',
    title: 'Something at the Wall',
    text: 'A knot of goblins has been at the palisade\'s edge for three nights running now — not scavenging, not raiding, just watching, the way a buyer watches something they haven\'t decided to want yet. Tonight {hero} finally catches them at it before they can melt back into the dark.',
    conditions: [
      { type: 'hasBuilding', building: 'palisade' },
      { type: 'locationDiscovery', location: 'goblin_wilds', atLeast: 'visited' },
      { type: 'standingAtLeast', faction: 'BEASTFOLK', value: 10 },
      { type: 'heroGender', gender: 'male' },
      { type: 'heroUnmarried' },
    ],
    weight: 7,
    once: true,
    cooldownTurns: 4,
    binding: { type: 'weightedStat', stat: 'charm' },
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    arc: 'goblin_match',
    choices: [
      {
        type: 'checked',
        label: 'Corner them and talk your way to the truth of it.',
        check: { skill: 'diplomacy', stat: 'charm', difficulty: 10, tags: ['BEASTFOLK', 'strangers'] },
        critSuccess: {
          text: 'They don\'t scatter — they answer, all talking over each other at once, and what {hero} pieces together is less a threat than an appraisal. Whatever they were deciding about the post, and about {him}, they seem to have decided it favorably.',
          outcomes: [
            { type: 'setChainVar', key: 'impression', value: 'strong' },
            { type: 'queueEvent', eventId: 'goblin_match_intrusion', delayTurns: 3, sameHero: true },
          ],
        },
        success: {
          text: '{hero} gets more shrugging than answers, but the goblins don\'t bolt, and that alone seems to count for something in whatever ledger they\'re keeping. They slip off into the treeline still muttering to each other.',
          outcomes: [
            { type: 'setChainVar', key: 'impression', value: 'strong' },
            { type: 'queueEvent', eventId: 'goblin_match_intrusion', delayTurns: 3, sameHero: true },
          ],
        },
        failure: {
          text: 'Whatever {hero} says only gets the goblins arguing faster, in a tongue too quick to follow, before the whole knot of them scatters into the dark at once. Nothing about that felt like it went well.',
          outcomes: [outcome.stress(1)],
        },
        critFailure: {
          text: 'The talking stops being talking. Before {hero} can make sense of the sudden press of small, quick hands, {he}\'s bundled off the ground and into the wilds, laughing goblins carrying {him} like a piece of especially interesting cargo.',
          outcomes: [
            outcome.captureHero('BEASTFOLK'),
            outcome.history('Cornered a band of goblins at the wall and was carried off for it.'),
          ],
        },
      },
      {
        type: 'checked',
        label: 'Corner them and put the fear in them.',
        check: { skill: 'leadership', stat: 'resolve', difficulty: 10, tags: ['BEASTFOLK', 'intimidation'] },
        critSuccess: {
          text: '{hero}\'s voice cracks across the yard and the whole knot of them flinches as one — but nobody actually runs, which is its own kind of answer. They go, eventually, throwing looks back over their shoulders the whole way, more curious than cowed.',
          outcomes: [
            { type: 'setChainVar', key: 'impression', value: 'strong' },
            { type: 'queueEvent', eventId: 'goblin_match_intrusion', delayTurns: 3, sameHero: true },
          ],
        },
        success: {
          text: 'They scatter at the shout, mostly, though one or two linger a beat too long before following the rest — watching {hero}, not the wall, on the way out.',
          outcomes: [
            { type: 'setChainVar', key: 'impression', value: 'strong' },
            { type: 'queueEvent', eventId: 'goblin_match_intrusion', delayTurns: 3, sameHero: true },
          ],
        },
        failure: {
          text: 'The shout does nothing but make them laugh, which is somehow worse than being ignored outright. They\'re gone before {hero} decides on a second approach.',
          outcomes: [outcome.stress(1)],
        },
        critFailure: {
          text: 'Shouting at goblins, it turns out, reads to goblins as an invitation to a game. By the time {hero} understands that, {he}\'s already off {his} feet and headed for the treeline at speed, laughter on all sides.',
          outcomes: [
            outcome.captureHero('BEASTFOLK'),
            outcome.history('Tried to scare off a band of goblins at the wall and was carried off for it.'),
          ],
        },
      },
      {
        type: 'flat',
        label: 'Leave it — not tonight.',
        text: '{hero} lets them be and turns back toward the post. By morning there\'s no sign anyone was ever at the wall at all.',
        outcomes: [outcome.history('Left a band of watching goblins alone at the wall.')],
      },
    ],
  }),
  // Reputation-aware variant of the chain's opener (REPUTATION_TRAITS_SPEC.md):
  // only the `friend_of_goblins` pole fits naturally here (a hero the band
  // already treats as one of their own is a believable reason for a band
  // to start seriously courting rather than just watching) — the other two
  // poles don't fit this beat and are left alone. Shares the same downstream
  // chain (`goblin_match_intrusion`/`goblin_match_offer`) as the original,
  // which is untouched; the two events simply compete for the same hero
  // pool via their own bindings (`weightedStat` vs `withTrait`), each still
  // gated by its own independent `once`.
  makeChoiceEvent({
    id: 'goblin_match_skulking_friend',
    category: 'post',
    illustration: 'goblin_encounter_01',
    title: 'Something at the Wall',
    text: 'A knot of goblins has been at the palisade\'s edge for three nights running now — not scavenging, not raiding, just watching, the easy way you\'d watch someone you already like rather than someone you\'re still sizing up. Tonight {hero} finally catches them at it before they can melt back into the dark, and not one of them even bothers looking guilty about it.',
    conditions: [
      { type: 'hasBuilding', building: 'palisade' },
      { type: 'locationDiscovery', location: 'goblin_wilds', atLeast: 'visited' },
      { type: 'standingAtLeast', faction: 'BEASTFOLK', value: 10 },
      { type: 'heroGender', gender: 'male' },
      { type: 'heroUnmarried' },
    ],
    weight: 9,
    once: true,
    cooldownTurns: 4,
    binding: { type: 'withTrait', trait: 'friend_of_goblins' },
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    arc: 'goblin_match',
    choices: [
      {
        type: 'checked',
        label: 'Corner them and talk your way to the truth of it.',
        check: { skill: 'diplomacy', stat: 'charm', difficulty: 10, tags: ['BEASTFOLK', 'strangers'] },
        critSuccess: {
          text: 'They don\'t scatter — they barely even try to look caught, and what {hero} pieces together is less an appraisal than a decision already made. Of course it\'s {him}, one of them says, like that settles it.',
          outcomes: [
            { type: 'setChainVar', key: 'impression', value: 'strong' },
            { type: 'queueEvent', eventId: 'goblin_match_intrusion', delayTurns: 3, sameHero: true },
          ],
        },
        success: {
          text: '{hero} gets more shrugging than answers, but they don\'t bolt, and there\'s nothing anxious about the way they slip off into the treeline — more like a plan continuing than a scheme interrupted.',
          outcomes: [
            { type: 'setChainVar', key: 'impression', value: 'strong' },
            { type: 'queueEvent', eventId: 'goblin_match_intrusion', delayTurns: 3, sameHero: true },
          ],
        },
        failure: {
          text: 'Whatever {hero} says only gets the goblins arguing faster, in a tongue too quick to follow, before the whole knot of them scatters into the dark at once. Nothing about that felt like it went well.',
          outcomes: [outcome.stress(1)],
        },
        critFailure: {
          text: 'The talking stops being talking. Before {hero} can make sense of the sudden press of small, quick hands, {he}\'s bundled off the ground and into the wilds, laughing goblins carrying {him} like a piece of especially interesting cargo.',
          outcomes: [
            outcome.captureHero('BEASTFOLK'),
            outcome.history('Cornered a band of goblins at the wall and was carried off for it.'),
          ],
        },
      },
      {
        type: 'checked',
        label: 'Corner them and put the fear in them.',
        check: { skill: 'leadership', stat: 'resolve', difficulty: 10, tags: ['BEASTFOLK', 'intimidation'] },
        critSuccess: {
          text: '{hero}\'s voice cracks across the yard and the whole knot of them flinches — more startled than scared, and clearly a little hurt at the reception, given how things usually go between {him} and their kind. They go, but reluctantly.',
          outcomes: [
            { type: 'setChainVar', key: 'impression', value: 'strong' },
            { type: 'queueEvent', eventId: 'goblin_match_intrusion', delayTurns: 3, sameHero: true },
          ],
        },
        success: {
          text: 'They scatter at the shout, mostly, though it plainly costs them something — this isn\'t how {hero} usually talks to them, and they notice.',
          outcomes: [
            { type: 'setChainVar', key: 'impression', value: 'strong' },
            { type: 'queueEvent', eventId: 'goblin_match_intrusion', delayTurns: 3, sameHero: true },
          ],
        },
        failure: {
          text: 'The shout does nothing but make them laugh, which is somehow worse than being ignored outright. They\'re gone before {hero} decides on a second approach.',
          outcomes: [outcome.stress(1)],
        },
        critFailure: {
          text: 'Shouting at goblins, it turns out, reads to goblins as an invitation to a game — especially from {hero}, of all people. By the time {he} understands that, {he}\'s already off {his} feet and headed for the treeline at speed, laughter on all sides.',
          outcomes: [
            outcome.captureHero('BEASTFOLK'),
            outcome.history('Tried to scare off a band of goblins at the wall and was carried off for it.'),
          ],
        },
      },
      {
        type: 'flat',
        label: 'Leave it — not tonight.',
        text: '{hero} lets them be and turns back toward the post. By morning there\'s no sign anyone was ever at the wall at all.',
        outcomes: [outcome.history('Left a band of watching goblins alone at the wall.')],
      },
    ],
  }),
  makeChoiceEvent({
    id: 'goblin_match_intrusion',
    illustration: 'goblin_mischief',
    title: 'Uninvited Company',
    text: 'The same goblins have let themselves into {hero}\'s own quarters — not stealing, exactly, more cataloguing: turning over blankets, testing the door hinges, marveling at a hearth that stays lit without anyone tending it all night. They look up at {hero} with the guiltless expressions of people who assumed they\'d be caught eventually.',
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    arc: 'goblin_match',
    choices: [
      {
        type: 'checked',
        label: 'Let them look around — see what they\'re really after.',
        requires: [{ type: 'hasBuilding', building: 'common_house' }],
        check: { skill: 'bargain', stat: 'wits', difficulty: 10, tags: ['BEASTFOLK'] },
        critSuccess: {
          text: 'It stops being an inspection and turns into something closer to a tour — {hero} showing off the common house down the yard, the goblins trailing behind asking pointed questions about who gets to live somewhere so dry. They leave already arguing about something {hero} isn\'t meant to understand yet.',
          outcomes: [
            { type: 'setChainVar', key: 'impression', value: 'strong' },
            { type: 'queueEvent', eventId: 'goblin_match_offer', delayTurns: 3, sameHero: true },
          ],
        },
        success: {
          text: '{hero} lets the inspection run its course rather than fight it, and the goblins take their time about it, poking at everything twice. Whatever they came to confirm, they seem to have confirmed it.',
          outcomes: [
            { type: 'setChainVar', key: 'impression', value: 'strong' },
            { type: 'queueEvent', eventId: 'goblin_match_offer', delayTurns: 3, sameHero: true },
          ],
        },
        failure: {
          text: 'The goblins lose interest partway through and leave without much ceremony, taking a spoon nobody will miss until later. Whatever verdict they reached, it didn\'t look like a good one.',
          outcomes: [
            { type: 'setChainVar', key: 'impression', value: 'weak' },
            { type: 'queueEvent', eventId: 'goblin_match_offer', delayTurns: 3, sameHero: true },
          ],
        },
        critFailure: {
          text: 'Something about {hero}\'s tone offends the whole delegation at once, and they leave in a huff, pockets somehow fuller than when they arrived. Nothing more comes of it.',
          outcomes: [outcome.history('A goblin house-inspection ended badly and went nowhere further.')],
        },
      },
      {
        type: 'flat',
        label: 'Let them linger — see if the post gives them more reason to stay.',
        text: '{hero} doesn\'t press them to explain themselves, and they take the tolerance as an invitation to keep looking around at their own unhurried pace, for now.',
        outcomes: [
          outcome.history('Let a band of goblins keep looking the place over, unpressed.'),
          { type: 'queueEvent', eventId: 'goblin_match_intrusion', delayTurns: 3, sameHero: true },
        ],
      },
      {
        type: 'flat',
        label: 'Throw them out for good.',
        text: '{hero} makes it plain this isn\'t an invitation, and — for once — they actually take the hint, gone out the window they came in by. It doesn\'t feel like the end of the questions so much as the end of {hero} getting to hear the answers.',
        outcomes: [outcome.standing('BEASTFOLK', -2), outcome.history('Threw a band of goblins out of the house for good.')],
      },
    ],
  }),
  makeChoiceEvent({
    id: 'goblin_match_offer',
    illustration: 'goblin_arrival',
    title: 'We\'re Not Going Back',
    text: 'The same band is back at the gate, gear slung and packed, and this time they\'re not leaving. Camp doesn\'t compare, they say, plainly, to a house that stays dry and a fire that doesn\'t need hunting for — and goblin logic runs simple: {hero} has no wife yet, and there are enough of them here that none of them see a reason to be the one who isn\'t.',
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    arc: 'goblin_match',
    choices: [
      {
        type: 'checked',
        label: 'Take them all in as your wives.',
        requires: [{ type: 'chainVar', key: 'impression', value: 'strong' }, { type: 'heroUnmarried' }],
        check: { skill: 'bargain', stat: 'wits', difficulty: 10, tags: ['BEASTFOLK'] },
        critSuccess: {
          text: 'There\'s no ceremony to speak of — just a great deal of talking over each other until, somehow, terms everyone likes fall out of it. By evening {hero} has gone from unmarried to the head of a household three wives larger than it was that morning, and not one of them seems to think that\'s a strange way to have arranged it.',
          outcomes: [
            { type: 'formUnion', source: 'informal', heritage: 'goblin' },
            { type: 'formUnion', source: 'informal', heritage: 'goblin' },
            { type: 'formUnion', source: 'informal', heritage: 'goblin' },
            outcome.standing('BEASTFOLK', 8),
            { type: 'addTrait', trait: 'wed_goblin' },
            outcome.history('Took in an entire goblin band as wives, all at once, on their own insistence.'),
          ],
        },
        success: {
          text: 'It\'s a chaotic sort of agreement, argued out in three directions at once, but it holds — the household grows by the whole band before {hero} has quite finished agreeing to it.',
          outcomes: [
            { type: 'formUnion', source: 'informal', heritage: 'goblin' },
            { type: 'formUnion', source: 'informal', heritage: 'goblin' },
            { type: 'formUnion', source: 'informal', heritage: 'goblin' },
            outcome.standing('BEASTFOLK', 5),
            { type: 'addTrait', trait: 'wed_goblin' },
            outcome.history('Took in an entire goblin band as wives, all at once, on their own insistence.'),
          ],
        },
        failure: {
          text: 'The negotiation goes sideways — not off entirely, just uneven — and only some of them are still interested in the arrangement by the time it\'s done. The rest decide the house is worth staying near anyway, wife or not.',
          outcomes: [
            { type: 'formUnion', source: 'informal', heritage: 'goblin' },
            { type: 'addResidents', role: 'idle', count: 2, tag: 'goblin', group: 'native' },
            outcome.standing('BEASTFOLK', 2),
            { type: 'addTrait', trait: 'wed_goblin' },
            outcome.history('A goblin band\'s mass marriage proposal only partly held together.'),
          ],
        },
        critFailure: {
          text: 'Somewhere in the crosstalk the whole arrangement falls apart, loudly, and the band decides {hero} was never serious about it in the first place. They don\'t leave — goblins rarely walk back a decision to stay — but nobody\'s getting married over it now.',
          outcomes: [
            { type: 'addResidents', role: 'idle', count: 3, tag: 'goblin', group: 'native' },
            outcome.stress(1),
            outcome.history('A goblin band\'s mass marriage proposal collapsed loudly, but they settled at the post anyway.'),
          ],
        },
      },
      {
        type: 'flat',
        label: 'Welcome them as residents instead.',
        text: 'They take the offer without much fuss — a place inside the wall was most of what they came for anyway, and a wedding was never a promise, just an option they were curious about.',
        outcomes: [
          { type: 'addResidents', role: 'idle', count: 3, tag: 'goblin', group: 'native' },
          outcome.standing('BEASTFOLK', 3),
          outcome.history('A goblin band that came asking after a wedding settled at the post as residents instead.'),
        ],
      },
    ],
  }),
];
