// Orc marriage chain — a courtship earned over three stages rather than
// decided in one roll (ORC_MATCH_CHAIN_SPEC.md). Stage 1 fires from the
// weighted post pool when a male hero eligible to marry works the
// Provisioning task; stages 2 and 3 are pinned, cross-turn `queueEvent`
// follow-ups (category 'chain', weight 0) that only ever fire once that
// same hero is back at the post. `impression` (chainVar) carries the
// verdict from stage 1 through stage 2 into stage 3's branch — 'strong'
// unlocks the marriage choice, anything else leaves only the resident-join
// option. Orcs are polygamous (TUNING.family.maxSpousesPerHero), so
// `heroCanMarry` (spouse-cap check) gates this rather than `heroUnmarried`,
// and the marriage text names which wife she becomes via `{spouseRank}`.
// See ./index.ts for shared context. The goblin counterpart moved to
// ../../goblin/match.ts (2026-07-27).

import type { GameEvent } from '../../../engine/events/types';

export const ORC_MATCH_EVENTS: GameEvent[] = [
  {
    id: 'orc_match_watched',
    category: 'post',
    illustration: 'orc_match_watched',
    title: 'Eyes Among the Stores',
    text: 'The count comes up right, the ledger balances, and still {hero} can\'t shake the feeling of being watched. It takes until dusk to place her — a lone orc woman at the treeline, unarmed, unhurried, watching the way the post\'s stores get counted and kept as if she\'s deciding something about the man doing the counting.',
    conditions: [
      { type: 'locationDiscovery', location: 'beast_wilds', atLeast: 'visited' },
      { type: 'standingAtLeast', faction: 'BEASTFOLK', value: 10 },
      { type: 'heroGender', gender: 'male' },
      { type: 'heroAssignment', activity: 'provision' },
      { type: 'heroCanMarry' },
    ],
    weight: 6,
    once: true,
    cooldownTurns: 4,
    binding: { type: 'weightedStat', stat: 'charm' },
    factions: ['BEASTFOLK'],
    peoples: ['orc'],
    arc: 'orc_match',
    choices: [
      {
        label: 'Meet her eye and speak plainly.',
        check: { skill: 'diplomacy', stat: 'charm', difficulty: 11, tags: ['diplomacy', 'strangers', 'BEASTFOLK'] },
        outcomes: {
          critSuccess: {
            text: 'She doesn\'t look away first, and neither does {hero} — and something in that unhurried exchange seems to settle a question she came here to ask. She gives no name, no reason, just a short nod before she turns back for the trees.',
            outcomes: [
              { type: 'setChainVar', key: 'impression', value: 'strong' },
              { type: 'queueEvent', eventId: 'orc_match_trading', delayTurns: 3, sameHero: true },
            ],
          },
          success: {
            text: '{hero} says enough to be worth answering, and she does — a few plain words back, nothing more. It isn\'t warmth exactly, but it isn\'t nothing either. She\'s gone by the time {he} looks again.',
            outcomes: [
              { type: 'setChainVar', key: 'impression', value: 'strong' },
              { type: 'queueEvent', eventId: 'orc_match_trading', delayTurns: 3, sameHero: true },
            ],
          },
          failure: {
            text: 'Whatever {hero} says lands wrong, or lands as nothing at all — she studies {him} a moment longer, unreadable, then simply isn\'t there anymore. Whatever she was deciding, she seems to have decided it.',
            outcomes: [{ type: 'stress', delta: 1 }],
          },
          critFailure: {
            text: '{hero} fumbles it badly enough that her expression actually changes — something between disappointment and dismissal — before she melts back into the trees without another look.',
            outcomes: [{ type: 'stress', delta: 1 }],
          },
        },
      },
      {
        label: 'Hold steady and let her make the first move.',
        check: { skill: 'combat', stat: 'might', difficulty: 11, tags: ['intimidation', 'BEASTFOLK'] },
        outcomes: {
          critSuccess: {
            text: '{hero} doesn\'t startle and doesn\'t posture either — just keeps working, steady, unbothered by being watched. That, more than anything {he} could have said, seems to be exactly what she came to see.',
            outcomes: [
              { type: 'setChainVar', key: 'impression', value: 'strong' },
              { type: 'queueEvent', eventId: 'orc_match_trading', delayTurns: 3, sameHero: true },
            ],
          },
          success: {
            text: '{hero} carries on with the work, unhurried, and lets her watch as long as she likes. Eventually she does move on — but not before a long last look that isn\'t quite unfriendly.',
            outcomes: [
              { type: 'setChainVar', key: 'impression', value: 'strong' },
              { type: 'queueEvent', eventId: 'orc_match_trading', delayTurns: 3, sameHero: true },
            ],
          },
          failure: {
            text: 'The stillness reads as indifference rather than steadiness, and she seems to take the point — she\'s gone before {hero} thinks to do anything else.',
            outcomes: [{ type: 'stress', delta: 1 }],
          },
          critFailure: {
            text: 'Whatever {hero} means by standing there so pointedly, she clearly reads it as something else entirely, and unflattering — she doesn\'t linger to be misread twice.',
            outcomes: [{ type: 'stress', delta: 1 }],
          },
        },
      },
      {
        label: 'Look away — there\'s work to finish.',
        outcomes: {
          success: {
            text: '{hero} keeps to the count and doesn\'t look up again. When {he} finally does, she\'s gone, and nothing more comes of it.',
            outcomes: [
              {
                type: 'history',
                text: 'Noticed an orc woman watching from the treeline and let the moment pass unanswered.',
              },
            ],
          },
        },
      },
    ],
  },
  {
    id: 'orc_match_trading',
    category: 'chain',
    illustration: 'orc_match_trading',
    title: 'She Comes to Trade',
    text: 'She walks in on an ordinary market day, alone, and trades like anyone else does — goods across the counter, a fair price argued plainly, no mention at all of the last time {hero} saw her. But she doesn\'t only watch the goods. She watches how the post runs, how {he} runs it, the way she watched from the trees before.',
    conditions: [],
    weight: 0,
    factions: ['BEASTFOLK'],
    peoples: ['orc'],
    arc: 'orc_match',
    choices: [
      {
        label: 'Deal with her yourself, and deal fairly.',
        check: { skill: 'bargain', stat: 'charm', difficulty: 11, tags: ['BEASTFOLK'] },
        outcomes: {
          critSuccess: {
            text: 'The trade goes better than either of them expected, and so does the conversation that comes with it — unhurried, easy, the kind that isn\'t really about the goods at all. She leaves with a longer look back than the goods alone would earn.',
            outcomes: [
              { type: 'silver', delta: 10 },
              { type: 'setChainVar', key: 'impression', value: 'strong' },
              { type: 'queueEvent', eventId: 'orc_match_returns', delayTurns: 3, sameHero: true },
            ],
          },
          success: {
            text: 'It\'s a good trade, plainly done, and she seems to take the post\'s measure from it as much as {hero}\'s. She packs up and goes without ceremony, but not without a last, considering glance.',
            outcomes: [
              { type: 'silver', delta: 6 },
              { type: 'setChainVar', key: 'impression', value: 'strong' },
              { type: 'queueEvent', eventId: 'orc_match_returns', delayTurns: 3, sameHero: true },
            ],
          },
          failure: {
            text: 'The trade is fair enough, if a little stiff, and whatever she came here to weigh doesn\'t seem to tip either way. She leaves with her goods and no particular warmth.',
            outcomes: [
              { type: 'silver', delta: 3 },
              { type: 'setChainVar', key: 'impression', value: 'weak' },
              { type: 'queueEvent', eventId: 'orc_match_returns', delayTurns: 3, sameHero: true },
            ],
          },
          critFailure: {
            text: 'The haggling turns sour, and so, plainly, does she — whatever question she came to answer, {hero} has just answered it for her, badly. She takes what she came for and doesn\'t come back.',
            outcomes: [{ type: 'standing', faction: 'BEASTFOLK', delta: -1 }],
          },
        },
      },
    ],
  },
  {
    id: 'orc_match_returns',
    category: 'chain',
    illustration: 'orc_arrival',
    title: 'One Who Chose to Come',
    text: 'She walks in a last time, gear slung and packed, and asks for {hero} by name. No war-band sent her and no elder blessed the errand; among her own kind there is no one left to spare, and she has decided the post is a better wager than waiting. Whatever passed between her and {hero} before, she\'s here now to make it count for something.',
    conditions: [],
    weight: 0,
    factions: ['BEASTFOLK'],
    peoples: ['orc'],
    arc: 'orc_match',
    choices: [
      {
        label: 'Ask her to join your household as your wife.',
        requires: [
          { type: 'chainVar', key: 'impression', value: 'strong' },
          { type: 'heroCanMarry' },
        ],
        check: { skill: 'combat', stat: 'might', difficulty: 12, tags: ['BEASTFOLK'] },
        outcomes: {
          critSuccess: {
            text: 'There is no ceremony the Company would recognize — only her word and {hero}\'s, given plainly and meant. Word of it will reach the war-bands eventually, and reach them as proof the post keeps its bargains and its people both.',
            outcomes: [
              { type: 'formUnion', source: 'alliance', heritage: 'orc' },
              { type: 'standing', faction: 'BEASTFOLK', delta: 8 },
              { type: 'addTrait', trait: 'wed_orc' },
              { type: 'history', text: 'Wed an orc woman who chose the post over her own kind\'s odds, as his {spouseRank}.' },
            ],
          },
          success: {
            text: 'It isn\'t the proof she came expecting, but it\'s proof enough. She accepts {hero} as plainly as she asked, and the household grows by one.',
            outcomes: [
              { type: 'formUnion', source: 'alliance', heritage: 'orc' },
              { type: 'standing', faction: 'BEASTFOLK', delta: 5 },
              { type: 'addTrait', trait: 'wed_orc' },
              { type: 'history', text: 'Wed an orc woman who chose the post over her own kind\'s odds, as his {spouseRank}.' },
            ],
          },
          failure: {
            text: '{hero} doesn\'t prove what she needed proven, and she\'s plainly, quietly disappointed by it — but not enough to walk away from the post entirely. She stays, just not as anyone\'s wife.',
            outcomes: [
              { type: 'addResidents', role: 'idle', count: 1, tag: 'orc', group: 'native' },
              { type: 'standing', faction: 'BEASTFOLK', delta: 2 },
              { type: 'history', text: 'An orc woman who came to test a hero\'s worth settled at the post instead, unmarried.' },
            ],
          },
          critFailure: {
            text: 'Whatever {hero} was meant to show her, {he} shows the opposite of it, and the disappointment on her face is hard to mistake for anything else. She still doesn\'t leave — but she won\'t be asked again.',
            outcomes: [
              { type: 'addResidents', role: 'idle', count: 1, tag: 'orc', group: 'native' },
              { type: 'stress', delta: 1 },
              { type: 'history', text: 'An orc woman who came to test a hero\'s worth settled at the post instead, unmarried.' },
            ],
          },
        },
      },
      {
        label: 'Welcome her as a resident, not a bride.',
        outcomes: {
          success: {
            text: 'She takes the offer for what it is, without complaint — a place inside the wall, nothing more asked or promised. Whatever she came here deciding, she\'s made her peace with the answer.',
            outcomes: [
              { type: 'addResidents', role: 'idle', count: 1, tag: 'orc', group: 'native' },
              { type: 'standing', faction: 'BEASTFOLK', delta: 3 },
              { type: 'history', text: 'An orc woman who came watching a hero chose to settle at the post as a resident.' },
            ],
          },
        },
      },
    ],
  },
];
