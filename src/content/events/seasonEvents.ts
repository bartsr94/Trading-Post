// Seasonal events (spec §9) — anchors that make the calendar felt.

import type { GameEvent } from '../../engine/events/types';
import { makeChoiceEvent, outcome } from './eventHelpers';

export const SEASON_EVENTS: GameEvent[] = [
  makeChoiceEvent({
    id: 'season_spring_floods',
    category: 'season',
    illustration: 'flood_river',
    title: 'The River Rises',
    text: 'Snowmelt from the Stormwall Mountains arrives all at once. The river climbs its banks overnight, brown and fast and full of whole trees. The lower stores stand a hand-span from the waterline and the water is still coming. The river towns are already gone to high ground — they knew to the day.',
    conditions: [{ type: 'season', value: 'spring' }],
    weight: 10,
    cooldownTurns: 6,
    binding: { type: 'highestSkill', skill: 'craft' },
    choices: [
      {
        type: 'checked',
        label: 'Dike and drain — fight the river for the low ground.',
        check: { skill: 'craft', stat: 'might', difficulty: 10 },
        success: {
          text: 'Two days of mud, timber, and shouting. The dike holds. The company stands on it at the flood’s crest, soaked and absurdly proud, watching whole pines sail past at eye level.',
          outcomes: [outcome.good('timber', -3), outcome.stress(-1, true)],
        },
        failure: {
          text: 'The river takes the dike apart with something like contempt, and the low stores with it. Downstream, some river-town child is about to find a crate of good homeland cloth.',
          outcomes: [outcome.good('timber', -3), outcome.good('cloth', -2), outcome.good('grain', -4)],
        },
      },
      {
        type: 'flat',
        label: 'Carry everything to high ground and let the river have the yard.',
        text: 'A long, aching day of hauling. The flood rolls through the empty yard and leaves a gift of black silt — next year’s garden plot, if you’re still here to plant one.',
        outcomes: [outcome.stress(1, true)],
      },
      {
        type: 'checked',
        label: 'Salvage driftwood from the flood — the river pays timber for those bold enough.',
        check: { skill: 'survival', stat: 'agility', difficulty: 11 },
        success: {
          text: 'Roped and careful, the company fishes a small fortune in cut-ready timber out of the brown water. The river gives with both hands, this once.',
          outcomes: [outcome.good('timber', 8)],
        },
        failure: {
          text: 'A log rolls and {hero} goes under the brown water for three long heartbeats before the rope snaps taut. The timber gained does not feel worth what it nearly cost.',
          outcomes: [outcome.good('timber', 3), outcome.health(-2), outcome.stress(2)],
        },
      },
    ],
  }),
  makeChoiceEvent({
    id: 'season_midsummer_gathering',
    category: 'season',
    illustration: 'midsummer_fires',
    title: 'The Midsummer Gathering',
    text: 'For one week at midsummer, the river meadows fill with boats and tents: the clans gather to marry, feud, race, and trade, as they have since before the homeland had ships. A polite runner brings word that the strangers of the post may attend — as guests, watched but welcome. Everyone hears the invitation is a test.',
    conditions: [{ type: 'season', value: 'summer' }],
    weight: 12,
    cooldownTurns: 6,
    binding: { type: 'highestSkill', skill: 'diplomacy' },
    factions: ['RIVER_CLANS'],
    peoples: ['kiswani'],
    loreRef: ['Sauromatian Clan and Tribal Organization.md'],
    choices: [
      {
        type: 'checked',
        label: 'Go with gifts and open hands. Let {hero} speak for the post.',
        check: { skill: 'diplomacy', stat: 'charm', difficulty: 10, tags: ['RIVER_CLANS', 'natives'] },
        critSuccess: {
          text: '{hero} judges the wrestling, drinks what is offered, and answers the clan-mothers’ questions with exactly the right mixture of honesty and flattery. By week’s end the post has a nickname in Kiswani — an affectionate one, mostly.',
          outcomes: [
            outcome.good('tools', -1),
            outcome.standing('RIVER_CLANS', 12),
            { type: 'axis', axis: 'integration', delta: 2 },
            outcome.history('Earned the post its Kiswani name at the Midsummer Gathering.'),
          ],
        },
        success: {
          text: 'You give well, receive graciously, and commit only two etiquette crimes, both forgiven with laughter. Trade at the meadow is brisk and the watching eyes are warmer by the end.',
          outcomes: [
            outcome.good('tools', -1),
            outcome.good('furs', 3),
            outcome.standing('RIVER_CLANS', 6),
            { type: 'axis', axis: 'integration', delta: 1 },
          ],
        },
        failure: {
          text: 'The third night, {hero} toasts the wrong clan first — an old feud, freshly fed. The company leaves early, escorted, while two clans argue about whose insult you were.',
          outcomes: [outcome.standing('RIVER_CLANS', -5), outcome.stress(2)],
        },
      },
      {
        type: 'flat',
        label: 'Send polite regrets and mind the post. Their feasts, their business.',
        text: 'The runner takes your courteous refusal without expression. The meadow fires burn a week on the horizon. Business, when it resumes, is correct and cool.',
        outcomes: [outcome.standing('RIVER_CLANS', -3), { type: 'axis', axis: 'integration', delta: -1 }],
      },
    ],
  }),
  makeChoiceEvent({
    id: 'season_first_frost',
    category: 'season',
    illustration: 'first_frost',
    title: 'First Frost',
    text: 'It comes early: a hard white morning and the marsh grass standing stiff as spears. Winter has sent its notice. Everyone counts the same things silently — grain sacks, firewood, blankets, the gaps in the tent seams. What the post has when the snow settles is what the post will have until thaw.',
    conditions: [{ type: 'season', value: 'autumn' }],
    weight: 10,
    cooldownTurns: 6,
    binding: { type: 'highestSkill', skill: 'leadership' },
    choices: [
      {
        type: 'checked',
        label: 'A great provisioning drive — everyone hunts, smokes, and stacks for a week.',
        check: { skill: 'leadership', stat: 'resolve', difficulty: 9 },
        success: {
          text: '{hero} turns dread into work-rosters. A week of smoke and sweat later, the racks are full, the wood is stacked to the tent-tops, and winter has lost most of its teeth.',
          outcomes: [outcome.good('grain', 6), outcome.good('timber', 4), outcome.stress(-1, true)],
        },
        failure: {
          text: 'The drive starts strong and dissolves into quarrels about whose job is whose. Half of what’s gathered spoils for want of proper smoking. Winter watches, patient.',
          outcomes: [outcome.good('grain', 2), outcome.stress(1, true)],
        },
      },
      {
        type: 'flat',
        label: 'Buy winter stores outright while the traders still move.',
        requires: [{ type: 'silverAtLeast', value: 30 }],
        text: 'Silver flows out; sacks and cords flow in. The last caravans of the season overcharge cheerfully and you pay cheerfully. Warmth has a price and it is worth it.',
        outcomes: [outcome.silver(-30), outcome.good('grain', 8), outcome.good('timber', 4)],
      },
    ],
  }),
];
