// Thralls / "indentured labor" (THRALLS_SPEC.md): the event-acquisition
// vector (Acquisition §4) and the revolt content the restiveness lever is
// designed to feed (Risk levers §2) — ordinary weighted content using the
// addThralls/loseThralls/thrallRestiveness outcome vocabulary, no new engine
// mechanism. Tone per CLAUDE.md: second person, terse, 60–120 words, choices
// as intentions.

import type { GameEvent } from '../../engine/events/types';

export const THRALL_EVENTS: GameEvent[] = [
  {
    id: 'thrall_river_clans_offer',
    category: 'post',
    illustration: 'thrall_barge',
    title: 'Chains for Sale',
    text: 'A Tributary Towns trader poles a low-riding barge up to the landing — not goods this time, but people, taken in some upriver feud the post never heard of and offered now for whatever silver it will give. She names no names and expects none asked. {hero} is the one who has to look the captives in the eye and decide whether the post\'s coffers are worth what they\'d buy.',
    conditions: [
      { type: 'standingAtLeast', faction: 'RIVER_CLANS', value: 10 },
      { type: 'locationDiscovery', location: 'river_meet', atLeast: 'visited' },
    ],
    weight: 6,
    cooldownTurns: 10,
    binding: { type: 'highestSkill', skill: 'bargain' },
    factions: ['RIVER_CLANS'],
    peoples: ['kiswani'],
    choices: [
      {
        label: 'Buy the lot — silver now, hands later.',
        check: { skill: 'bargain', stat: 'charm', difficulty: 10, tags: ['RIVER_CLANS', 'bargain'] },
        outcomes: {
          critSuccess: {
            text: '{hero} talks her down twice over, and the barge empties for less than she meant to ask. Three chained figures are led up to the post, and the trader poles off looking faintly annoyed at her own weak bargaining.',
            outcomes: [
              { type: 'silver', delta: -18 },
              { type: 'addThralls', role: 'idle', count: 3, tag: 'kiswani', group: 'native' },
              { type: 'history', text: 'Bought thralls off a Tributary Towns trader\'s barge.' },
            ],
          },
          success: {
            text: '{hero} settles on a price that leaves neither side happy, which the trader seems to take as proof it was fair. Two are led ashore in silence.',
            outcomes: [
              { type: 'silver', delta: -20 },
              { type: 'addThralls', role: 'idle', count: 2, tag: 'kiswani', group: 'native' },
            ],
          },
          failure: {
            text: 'The haggling goes nowhere and {hero} pays close to what she first asked for a single captive — word of an easy buyer at the post will outrun the barge downriver.',
            outcomes: [
              { type: 'silver', delta: -15 },
              { type: 'addThralls', role: 'idle', count: 1, tag: 'kiswani', group: 'native' },
              { type: 'contentment', delta: -1 },
            ],
          },
          critFailure: {
            text: '{hero} fumbles the whole exchange badly enough that the trader simply poles off insulted, silver already pocketed for "the trouble of stopping."',
            outcomes: [
              { type: 'silver', delta: -10 },
              { type: 'standing', faction: 'RIVER_CLANS', delta: -2 },
            ],
          },
        },
      },
      {
        label: 'Wave the barge on — this is not a trade you\'ll make.',
        outcomes: {
          success: {
            text: '{hero} shakes {his} head once, plainly, and the trader shrugs and poles back into the current without another word. Whatever becomes of her cargo downriver is no longer the post\'s question to answer.',
            outcomes: [
              { type: 'history', text: 'Turned away a slave-trader\'s barge at the landing.' },
            ],
          },
        },
      },
    ],
  },
  {
    id: 'thrall_revolt',
    category: 'post',
    illustration: 'thrall_revolt',
    title: 'The Breaking Point',
    text: 'It happens in the yard, not the fields — thralls who have had enough throw down their tools all at once, and for a long, ugly moment nobody at the post is sure whether this ends in words or blood. Guards are already reaching for weapons before anyone has given an order. {hero} has to decide, right now, which way this goes.',
    conditions: [
      { type: 'thrallsAtLeast', value: 3 },
      { type: 'thrallRestivenessAtLeast', value: 7 },
    ],
    weight: 9,
    cooldownTurns: 6,
    binding: { type: 'highestSkill', skill: 'leadership' },
    choices: [
      {
        label: 'Put it down — by force if it comes to that.',
        check: { skill: 'combat', stat: 'might', difficulty: 11, tags: ['intimidation'] },
        outcomes: {
          critSuccess: {
            text: '{hero} is on them before the standoff can turn into anything worse, and the show of force alone breaks what fight was left in the yard. A handful are dragged off in irons; the rest go back to work faster than they left it.',
            outcomes: [
              { type: 'loseThralls', count: 2 },
              { type: 'thrallRestiveness', delta: -6 },
              { type: 'history', text: 'Put down a thrall revolt before it drew blood.' },
            ],
          },
          success: {
            text: 'It gets ugly before it\'s over — a guard comes away bleeding, and more than one thrall doesn\'t come back from the yard at all — but the post holds.',
            outcomes: [
              { type: 'loseResidents', role: 'guards', count: 1 },
              { type: 'loseThralls', count: 4 },
              { type: 'thrallRestiveness', delta: -5 },
              { type: 'contentment', delta: -1 },
            ],
          },
          failure: {
            text: 'The yard goes fully to chaos before anyone regains it — thralls scatter for the treeline in the confusion, and the guards who tried to stop them paid for it.',
            outcomes: [
              { type: 'loseResidents', role: 'guards', count: 2 },
              { type: 'loseThralls', count: 6 },
              { type: 'thrallRestiveness', delta: -3 },
              { type: 'contentment', delta: -2 },
              { type: 'stress', delta: 2 },
            ],
          },
          critFailure: {
            text: 'Whatever {hero} meant to do, it is the wrong thing said at the wrong second — the yard erupts, half the thralls the post held are simply gone by morning, and the guards who stood their ground paid the worst of it.',
            outcomes: [
              { type: 'loseResidents', role: 'guards', count: 3 },
              { type: 'loseThralls', count: 10 },
              { type: 'contentment', delta: -2 },
              { type: 'stress', delta: 3 },
              { type: 'health', delta: -3 },
            ],
          },
        },
      },
      {
        label: 'Stand the guards down — better a smaller household than a slaughter.',
        outcomes: {
          success: {
            text: '{hero} calls the guards off and lets the standoff simply end — most of the thralls who threw down their tools slip away before the hour is out, and no one who stood in that yard has to carry what would have happened otherwise.',
            outcomes: [
              { type: 'loseThralls', count: 8 },
              { type: 'thrallRestiveness', delta: -7 },
              { type: 'contentment', delta: 1 },
              { type: 'history', text: 'Let a thrall revolt end in flight rather than force.' },
            ],
          },
        },
      },
    ],
  },
];
