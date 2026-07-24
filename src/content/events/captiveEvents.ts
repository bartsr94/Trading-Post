// Abduction/captivity resolution chain. Queued directly by engine/captivity.ts
// at the moment a hero is taken (not via an authored event's `queueEvent`
// outcome — there's no event context at that call site), so these are pure
// resolution beats: `conditions`/top-level gating is decorative for a queued
// chain event (CHAIN_EVENTS_SPEC.md §3 — never re-checked at fire time), the
// real gates live on individual choices via `requires`.
// Tone per CLAUDE.md: second person, terse, 60–120 words, choices as intentions.

import type { GameEvent } from '../../engine/events/types';

export const CAPTIVE_EVENTS: GameEvent[] = [
  {
    id: 'captive_quick_release',
    category: 'chain',
    illustration: 'captive_release',
    title: 'Back Through the Gate',
    text: '{hero} comes up the road alone, thinner than he left and short on details, but walking under his own power. However it happened — a guard who looked away, a debt called in, simple luck run out — his captors let him go rather than keep feeding a man they had no more use for.',
    conditions: [],
    weight: 0,
    factions: ['RIVER_CLANS', 'BEASTFOLK'],
    // 2026-07-24 lore audit: "no more use for him" runs backward against
    // Sauromatian Clan and Tribal Organization.md ("any loss strikes at a
    // clan's reproductive future, while any gain represents precious
    // opportunity") for the RIVER_CLANS case — a captured man is their most
    // valuable asset, not a burden shed for cost. Sauromatian Youth
    // Acquisition and Integration Practices.md's note that men past their
    // twenties "rarely shed their cultural conditioning" would be a better-
    // grounded reason for a release. Not yet rewritten.
    choices: [
      {
        label: 'Get him inside and fed.',
        outcomes: {
          success: {
            text: 'He eats like someone who has been rationing himself for weeks and says little else that first night. The story, such as it is, can wait.',
            outcomes: [
              { type: 'freeCaptive' },
              { type: 'history', text: 'Returned to the post after being taken captive and released.' },
            ],
          },
        },
      },
    ],
  },
  {
    id: 'captive_check_in',
    category: 'chain',
    illustration: 'captive_warning',
    title: 'No Word Yet',
    text: 'It has been long enough now that "any day" no longer sounds honest. {hero} is still out there somewhere, held by hands that have given no sign of loosening their grip, and the post is left to decide how much longer to simply wait and see.',
    conditions: [],
    weight: 0,
    factions: ['RIVER_CLANS', 'BEASTFOLK'],
    loreRef: ['Sauromatian Clan and Tribal Organization.md'],
    // 2026-07-24 lore audit: the emphasis here is inverted — "Ransom
    // Negotiations: Losing groups will offer substantial compensation to
    // recover captured males, with negotiations potentially spanning years"
    // (Sauromatian Clan and Tribal Organization.md) is written about
    // Sauromatian/Kiswani practice specifically, yet only the BEASTFOLK
    // branch below names ransom explicitly; the Kiswani branch undersells
    // it with a passive "wait and see." The `ransom` diplomacy mission
    // itself works correctly against RIVER_CLANS — this is a flavor-text
    // gap, not a missing mechanic. Not yet rewritten.
    choices: [
      {
        label: "They won't let go on their own — this will take a ransom or a raid.",
        requires: [{ type: 'chainVar', key: 'faction', value: 'BEASTFOLK' }],
        outcomes: {
          success: {
            text: 'No war-band frees a captive out of sentiment. If {hero} is coming home, it will be because someone rides out and makes it happen — silver in hand, or steel.',
            outcomes: [
              {
                type: 'history',
                text: '{hero} remains held by an orc or goblin band, unlikely to be freed without a ransom or a raid.',
              },
            ],
          },
        },
      },
      {
        label: 'Keep an ear on the river towns for word of him.',
        outcomes: {
          success: {
            text: 'The Kiswani have let captives walk home before, in their own time and for their own reasons. Whether {hero} is that lucky is still an open question — but it may yet resolve itself, given a while longer, or sooner with a push from the post.',
            outcomes: [
              {
                type: 'history',
                text: "{hero} remains held, with no word yet of when — or whether — he'll be freed.",
              },
            ],
          },
        },
      },
    ],
  },
  {
    id: 'captive_kin_arrival',
    category: 'chain',
    illustration: 'captive_kin',
    title: 'Someone Followed Him Home',
    text: "A woman arrives at the gate with a child on her hip and no one to vouch for her, and says plainly what she has come to say: the child is {hero}'s, got during his time held captive, and she has walked a long way on the strength of that claim alone. She isn't asking for pity. She's asking to stay.",
    conditions: [{ type: 'heroUnmarried' }],
    weight: 0,
    factions: ['RIVER_CLANS', 'BEASTFOLK'],
    peoples: ['kiswani', 'orc', 'goblin'],
    loreRef: ['Sauromatian Household Composition.md'],
    // 2026-07-24 lore audit: only well-grounded for the kiswani branch if this
    // woman is read as a thrall exercising the free-birth clause ("children
    // born to thralls and freeborn fathers... become full members of the
    // father's household," Sauromatian Household Composition.md) — the text
    // never specifies her status, and read as a free clanswoman this
    // contradicts the matrilineal-clan logic elsewhere in the lore set
    // ("children belong to their mother's clan from birth," Sauromatian Clan
    // and Tribal Organization.md). A one-line specification of her status
    // would resolve the ambiguity. Not yet rewritten.
    choices: [
      {
        label: 'Take them both in.',
        requires: [
          { type: 'heroUnmarried' },
          { type: 'chainVar', key: 'captorHeritage', value: 'kiswani' },
        ],
        outcomes: {
          success: {
            text: "There is no ceremony the Company would recognize, only her word and {hero}'s silence, which she seems to take as answer enough. The household is larger by two before the day is out.",
            outcomes: [
              { type: 'formUnion', source: 'informal', heritage: 'kiswani' },
              { type: 'addDependant', kind: 'kin', heritage: 'kiswani' },
              {
                type: 'history',
                text: 'Took in a woman and child who followed {hero} home from captivity among the river towns.',
              },
            ],
          },
        },
      },
      {
        label: 'Take them both in.',
        requires: [
          { type: 'heroUnmarried' },
          { type: 'chainVar', key: 'captorHeritage', value: 'orc' },
        ],
        outcomes: {
          success: {
            text: "There is no ceremony the Company would recognize, only her word and {hero}'s silence, which she seems to take as answer enough. The household is larger by two before the day is out — and stranger, by the post's usual lights.",
            outcomes: [
              { type: 'formUnion', source: 'informal', heritage: 'orc' },
              { type: 'addDependant', kind: 'kin', heritage: 'orc' },
              {
                type: 'history',
                text: 'Took in an orc woman and child who followed {hero} home from captivity in the wilds.',
              },
            ],
          },
        },
      },
      {
        label: 'Take them both in.',
        requires: [
          { type: 'heroUnmarried' },
          { type: 'chainVar', key: 'captorHeritage', value: 'goblin' },
        ],
        outcomes: {
          success: {
            text: "She has clearly weighed this before knocking — practical to the last, the way her people usually are. There is no ceremony the Company would recognize, only her word and {hero}'s silence, which she takes as settled enough to unpack her bag.",
            outcomes: [
              { type: 'formUnion', source: 'informal', heritage: 'goblin' },
              { type: 'addDependant', kind: 'kin', heritage: 'goblin' },
              {
                type: 'history',
                text: 'Took in a goblin woman and child who followed {hero} home from captivity in the wilds.',
              },
            ],
          },
        },
      },
      {
        label: 'Turn her away — kindly, but firmly.',
        outcomes: {
          success: {
            text: 'She takes the answer the way she seems to take most things — without argument, and without forgetting it. She is gone by morning, the child still on her hip, and no one at the post learns where.',
            outcomes: [
              {
                type: 'history',
                text: 'Turned away a woman and child claiming kinship with {hero} from his time in captivity.',
              },
            ],
          },
        },
      },
    ],
  },
];
