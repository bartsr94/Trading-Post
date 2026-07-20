// Marriage, partners & children (FAMILY_SPEC.md). Unions ride the generic
// `formUnion` / `addDependant` outcomes; the homeland match is a `courtship`
// expedition (Map "Seek a Match"), so these events cover the two native routes —
// a tribal alliance and an informal hearth-companion — plus a first birth.
// Tone: second person, terse, intentions not mechanics.

import type { GameEvent } from '../../engine/events/types';

export const FAMILY_EVENTS: GameEvent[] = [
  {
    id: 'family_river_alliance',
    category: 'post',
    illustration: 'river_wedding',
    title: 'An Offer of Marriage',
    text: 'A canoe brings a clan-mother of the Tributary Towns and, behind her, a son or daughter dressed for a first meeting. The river towns would bind your post to theirs the old way — a marriage, and with it a standing claim on each other’s loyalty. {hero} is the one they have watched and settled upon. The clan-mother waits, unhurried, for an answer that both peoples will remember.',
    conditions: [
      { type: 'standingAtLeast', faction: 'RIVER_CLANS', value: 30 },
      { type: 'locationDiscovery', location: 'river_meet', atLeast: 'visited' },
      { type: 'heroUnmarried' },
    ],
    weight: 10,
    once: true,
    cooldownTurns: 8,
    binding: { type: 'highestStat', stat: 'charm' },
    choices: [
      {
        label: 'Accept the match — bind the two peoples together.',
        outcomes: {
          success: {
            text: 'The vows are spoken by the water at dawn, in two tongues. {hero} takes a partner of the river towns into the household, and the clan-mother names your post kin. The Company’s factor, when he hears, will purse his lips — a foothold gone a little native — but the river will run friendlier now.',
            outcomes: [
              { type: 'formUnion', source: 'alliance', heritage: 'kiswani' },
              { type: 'standing', faction: 'RIVER_CLANS', delta: 10 },
              { type: 'addTrait', trait: 'wed_river' },
              { type: 'history', text: 'Wed into the Tributary Towns, sealing the river alliance.' },
            ],
          },
        },
      },
      {
        label: 'Decline with all courtesy — you are not ready to be bound.',
        outcomes: {
          success: {
            text: 'You refuse as gently as the thing can be refused, with gifts and long words. The clan-mother hears you out, then leaves without them. A door has not slammed — but it has closed, and both of you know it.',
            outcomes: [{ type: 'standing', faction: 'RIVER_CLANS', delta: -4 }],
          },
        },
      },
    ],
  },
  {
    id: 'family_informal_union',
    category: 'post',
    illustration: 'hearth_evening',
    title: 'A Quiet Arrangement',
    text: 'It has been coming for a season: {hero} and one of the river folk who trades at the gate have grown easy in each other’s company. There is no clan-mother here, no ceremony to arrange — only the frontier custom of a hearth-companion, a household kept by contract and quiet consent. It asks nothing of the towns and offers nothing to the Company. It is simply a life, chosen.',
    conditions: [
      { type: 'locationDiscovery', location: 'river_meet', atLeast: 'visited' },
      { type: 'standingAtLeast', faction: 'RIVER_CLANS', value: -14 },
      { type: 'heroUnmarried' },
    ],
    weight: 8,
    once: true,
    cooldownTurns: 10,
    binding: { type: 'highestStat', stat: 'charm' },
    choices: [
      {
        label: 'Let it be — a household made without asking anyone’s leave.',
        outcomes: {
          success: {
            text: 'No vows, no witnesses that matter to any ledger — only a contract of the frontier’s own making, and a hearth that has two people at it now. The post takes on a little more of the river’s colour. The Company need never approve of what it is not told.',
            outcomes: [
              { type: 'formUnion', source: 'informal', heritage: 'kiswani' },
              { type: 'addTrait', trait: 'informal_household' },
              { type: 'history', text: 'Kept a hearth-companion of the river folk.' },
            ],
          },
        },
      },
      {
        label: 'Keep it to friendship — some doors are better left shut.',
        outcomes: {
          success: {
            text: '{hero} steps back from the thing before it becomes the thing. Whether from duty, or fear of the factor’s eye, or simple prudence, the household stays as it was.',
            outcomes: [],
          },
        },
      },
    ],
  },
  {
    id: 'family_first_child',
    category: 'post',
    illustration: 'newborn',
    title: 'A New Mouth, A New Root',
    text: 'The word goes round the post before anyone announces it: {hero}’s household is to grow. On a Communal post, on a good year, this is how a venture becomes a settlement — not through ledgers but through children, who in a handful of seasons will be hands that work the place, and in a generation, its heirs.',
    conditions: [
      { type: 'heroHasSpouse' },
      { type: 'axisAtLeast', axis: 'communal', value: 3 },
      { type: 'contentmentAtLeast', value: 5 },
    ],
    weight: 8,
    cooldownTurns: 10,
    binding: { type: 'highestStat', stat: 'resolve' },
    choices: [
      {
        label: 'Welcome the child — and the years it promises.',
        outcomes: {
          success: {
            text: 'The child comes in its own time, squalling and whole. The household makes room; the post, a little more of a home. There will be a lean winter or two more for the extra mouth — but a family has put down a root the frontier cannot easily pull up.',
            outcomes: [
              { type: 'addDependant', kind: 'child' },
              { type: 'axis', axis: 'communal', delta: 1 },
              { type: 'history', text: 'A child was born into the household.' },
            ],
          },
        },
      },
    ],
  },
];
