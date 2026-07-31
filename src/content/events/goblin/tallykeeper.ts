// Yikka the Tallykeeper — the goblin pilot for NAMED_NPCS_SPEC.md: a single
// named figure attached to the BEASTFOLK faction (goblin heritage), met
// through the world rather than recruited from a menu. Deliberately built as
// pure additions on top of the existing ambush.ts/firstEncounter.ts content
// rather than edits to either — she's the answer to "who has been keeping
// score on that stick all along."
//
// Four beats: `goblin_tallykeeper_reveal` (meet her, once discovery clears),
// `goblin_tallykeeper_dealings` (repeatable travel encounter offering
// antagonize/recruit/marry/walk-away), `goblin_tallykeeper_retaliates` (the
// antagonize grudge track escalating to a raid), and
// `goblin_tallykeeper_ransom` (available once the post holds her, the
// capture payoff). Recruit/marry/ransom all resolve her arc for good
// (NAMED_NPCS_SPEC.md §4 — one-shot, no successor).

import type { GameEvent } from '../../../engine/events/types';
import { makeChoiceEvent, outcome } from '../eventHelpers';

const FIGURE_ID = 'goblin_tallykeeper';
const GRUDGE_KEY = 'goblin_tallykeeper_grudge';
const GRUDGE_RETALIATION_THRESHOLD = 3;

export const GOBLIN_TALLYKEEPER_EVENTS: GameEvent[] = [
  makeChoiceEvent({
    id: 'goblin_tallykeeper_reveal',
    category: 'post',
    illustration: 'goblin_mischief',
    title: 'The One Who Keeps the Stick',
    text: 'Word finally comes back with the goods, on a caravan that had its own brush with the goblin road: the scorekeeper has a name. Yikka. Not a chief, exactly — the bands out there don\'t hold much with chiefs — but the one whose tally stick decides who gets remembered and who gets let go. Every name scored into that wood, apparently, is one she chose to keep.',
    conditions: [{ type: 'locationDiscovery', location: 'goblin_wilds', atLeast: 'visited' }],
    weight: 6,
    once: true,
    binding: { type: 'random' },
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    arc: 'goblin_tallykeeper',
    choices: [
      {
        type: 'flat',
        label: 'Take note of the name.',
        text: '{hero} files it away. Knowing who is behind the game, at least, is worth something.',
        outcomes: [
          { type: 'introduceFigure', figureDefId: FIGURE_ID },
          outcome.history('Learned the name of the goblin who keeps the tally stick: Yikka.'),
        ],
      },
    ],
  }),
  makeChoiceEvent({
    id: 'goblin_tallykeeper_dealings',
    category: 'travel',
    illustration: 'goblin_mischief',
    title: 'The Tallykeeper',
    text: 'She\'s waiting at the usual stretch of scrub, apart from the rest of the band, tally stick in hand and no snare in sight this time — just her, sizing {hero} up the way she sizes up everyone whose name ends up on that wood. Whatever happens between the two of them today, it\'s her call more than the band\'s.',
    conditions: [
      { type: 'destinationTag', tag: 'goblin' },
      { type: 'figureExists', figureId: FIGURE_ID },
    ],
    weight: 8,
    cooldownTurns: 6,
    binding: { type: 'random' },
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    arc: 'goblin_tallykeeper',
    choices: [
      {
        type: 'checked',
        label: 'Corner her and put an end to this.',
        check: { skill: 'combat', stat: 'might', difficulty: 9, tags: ['BEASTFOLK', 'intimidation'] },
        critSuccess: {
          text: '{hero} closes the distance before she can so much as raise the stick, and it\'s over almost before the band realizes what\'s happening. She goes rigid with fury, not fear, as {he} takes her — but she goes.',
          outcomes: [
            { type: 'captureFigure', figureId: FIGURE_ID },
            outcome.standing('BEASTFOLK', -3),
            outcome.history('Cornered Yikka the Tallykeeper and took her captive.'),
          ],
        },
        success: {
          text: 'It\'s a scramble more than a fight, but {hero} comes out on top of it, and the tally stick ends up in {his} hands along with its owner. The band scatters rather than press the point.',
          outcomes: [
            { type: 'captureFigure', figureId: FIGURE_ID },
            outcome.standing('BEASTFOLK', -4),
            outcome.history('Ran down Yikka the Tallykeeper and took her captive.'),
          ],
        },
        failure: {
          text: 'She\'s faster than she looks, and slips {hero} entirely, already laughing about it from a safe distance before the band even finishes scattering.',
          outcomes: [outcome.figureCounter(FIGURE_ID, GRUDGE_KEY, 1), outcome.stress(1)],
        },
        critFailure: {
          text: 'She reads the whole attempt coming and lets {hero} run straight into the band\'s idea of a joke instead — {he} comes out of it bruised, and considerably better known to her than {he} was an hour ago.',
          outcomes: [outcome.figureCounter(FIGURE_ID, GRUDGE_KEY, 2), outcome.health(-2), outcome.stress(2)],
        },
      },
      {
        type: 'checked',
        label: 'Try to win her over.',
        check: { skill: 'bargain', stat: 'charm', difficulty: 10, tags: ['BEASTFOLK'] },
        critSuccess: {
          text: 'Whatever {hero} offers, it lands better than expected — she flips the tally stick over in her hands like she\'s already decided it belongs to somebody else\'s ledger now, and falls in with the party without a backward glance at the band.',
          outcomes: [
            { type: 'recruitFigure', figureId: FIGURE_ID },
            outcome.standing('BEASTFOLK', 5),
            outcome.history('Won Yikka the Tallykeeper over to the company.'),
          ],
        },
        success: {
          text: '{hero} makes the case, and she hears it out all the way through before making up her mind — the post, she decides, keeps a more interesting ledger than the scrub does.',
          outcomes: [
            { type: 'recruitFigure', figureId: FIGURE_ID },
            outcome.standing('BEASTFOLK', 3),
            outcome.history('Won Yikka the Tallykeeper over to the company.'),
          ],
        },
        failure: {
          text: 'She hears {hero} out, unreadable the whole time, and then just shakes her head — not offended, just unconvinced. The stick stays in her hand.',
          outcomes: [outcome.figureCounter(FIGURE_ID, GRUDGE_KEY, 1), outcome.stress(1)],
        },
        critFailure: {
          text: 'Whatever {hero} says, it comes out wrong, and she takes it as exactly the kind of insult that earns a name a worse mark on the stick.',
          outcomes: [outcome.figureCounter(FIGURE_ID, GRUDGE_KEY, 1), outcome.standing('BEASTFOLK', -2)],
        },
      },
      {
        type: 'checked',
        label: 'Court her properly.',
        requires: [
          { type: 'heroGender', gender: 'male' },
          { type: 'heroCanMarry' },
        ],
        check: { skill: 'diplomacy', stat: 'charm', difficulty: 10, tags: ['BEASTFOLK'] },
        critSuccess: {
          text: 'She sets the tally stick down — deliberately, like it matters — and hears {hero} out with none of her usual sharpness. By the time the band notices she\'s gone quiet, it\'s already decided.',
          outcomes: [
            { type: 'marryFigure', figureId: FIGURE_ID },
            outcome.standing('BEASTFOLK', 4),
            outcome.history('Won Yikka the Tallykeeper as a bride.'),
          ],
        },
        success: {
          text: 'It takes {hero} longer to talk her around than {he}\'d like, but she comes around all the same, tucking the stick away like a chapter she\'s decided is finished.',
          outcomes: [
            { type: 'marryFigure', figureId: FIGURE_ID },
            outcome.standing('BEASTFOLK', 2),
            outcome.history('Won Yikka the Tallykeeper as a bride.'),
          ],
        },
        failure: {
          text: 'She actually laughs at the offer, not unkindly, and goes right back to the tally stick like the conversation never happened.',
          outcomes: [outcome.figureCounter(FIGURE_ID, GRUDGE_KEY, 1)],
        },
        critFailure: {
          text: 'It lands badly, and she makes sure {hero} knows it — whatever mark that earns on the stick, it\'s not a flattering one.',
          outcomes: [outcome.figureCounter(FIGURE_ID, GRUDGE_KEY, 1), outcome.stress(1)],
        },
      },
      {
        type: 'flat',
        label: 'Leave her be and walk on.',
        text: '{hero} decides the tally stick isn\'t worth the trouble today, and walks on. Behind {him}, Yikka watches the party go, already turning something over.',
        outcomes: [outcome.stress(-1)],
      },
    ],
  }),
  makeChoiceEvent({
    id: 'goblin_tallykeeper_retaliates',
    category: 'post',
    illustration: 'goblin_mischief',
    title: 'Her Name for This',
    text: 'Word reaches the post the way goblin word always does — sideways, and too late to do much about it. Yikka has apparently decided the post has earned a mark of its own on that stick, and unlike the ones she scores for sport, this one she means to collect on personally.',
    conditions: [
      { type: 'figureExists', figureId: FIGURE_ID },
      { type: 'figureCounterAtLeast', figureId: FIGURE_ID, key: GRUDGE_KEY, value: GRUDGE_RETALIATION_THRESHOLD },
    ],
    weight: 5,
    once: true,
    binding: { type: 'random' },
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    arc: 'goblin_tallykeeper',
    choices: [
      {
        type: 'flat',
        label: 'Brace the post for it.',
        text: 'There\'s no talking a grudge like this back down — only getting ready for it.',
        outcomes: [
          { type: 'startRaid', faction: 'BEASTFOLK' },
          outcome.history('Drew Yikka the Tallykeeper\'s personal grudge down on the post.'),
        ],
      },
    ],
  }),
  makeChoiceEvent({
    id: 'goblin_tallykeeper_ransom',
    category: 'post',
    illustration: 'goblin_arrival',
    title: 'A Name Worth Silver',
    text: 'She sits where {hero} left her, tally stick confiscated and temper very much intact, making it clear with every silence that the band will pay to have their scorekeeper back — if the post is willing to name a price.',
    conditions: [{ type: 'figureHeldByPost', figureId: FIGURE_ID }],
    weight: 6,
    cooldownTurns: 2,
    binding: { type: 'random' },
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    arc: 'goblin_tallykeeper',
    choices: [
      {
        type: 'flat',
        label: 'Ransom her back to the band.',
        text: 'Word goes out, and the band pays without much haggling — apparently a tallykeeper is worth more to them than pride is.',
        outcomes: [
          { type: 'ransomFigure', figureId: FIGURE_ID, silver: 60 },
          outcome.standing('BEASTFOLK', 2),
          outcome.history('Ransomed Yikka the Tallykeeper back to the goblins.'),
        ],
      },
      {
        type: 'flat',
        label: 'Hold onto her for now.',
        text: 'Not yet. Whatever the post decides to do with her, it can wait a little longer.',
        outcomes: [],
      },
    ],
  }),
];
