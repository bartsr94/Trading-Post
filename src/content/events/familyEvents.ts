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
      { type: 'communityStandingAtLeast', location: 'river_meet', value: 30 },
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
              { type: 'communityStanding', location: 'river_meet', delta: 10 },
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
            outcomes: [{ type: 'communityStanding', location: 'river_meet', delta: -4 }],
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
      { type: 'communityStandingAtLeast', location: 'river_meet', value: -14 },
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
  // "Two Hearts at the Post" — a 2-stage same-sitting chain
  // (CHAIN_EVENTS_SPEC.md §3), the hero-to-hero counterpart to the outsider
  // marriages above (FAMILY_PHASE_D_SPEC.md §2.4). Stage 1 is the only one
  // drawn by the weighted pool; stage 2 is category 'chain' (weight 0) and is
  // only ever reached via continueChain.
  {
    id: 'family_party_spark',
    category: 'post',
    illustration: 'hearth_evening',
    title: 'Two Hearts at the Post',
    text: 'It has crept up on {hero} the way these things do — some ordinary hour of shared work, and the sudden realization that one particular face in the company has become the one worth watching for. Nothing has been said. Everyone else at the post, of course, has already noticed.',
    conditions: [{ type: 'heroUnmarried' }, { type: 'partnerAvailable' }],
    weight: 6,
    cooldownTurns: 12,
    binding: { type: 'random' },
    choices: [
      {
        label: 'Let it be known.',
        outcomes: {
          success: {
            text: 'There is no clan-mother to ask and no factor to inform — only the two of them, and the question finally spoken aloud.',
            outcomes: [
              { type: 'pickPartner' },
              { type: 'continueChain', eventId: 'family_party_spark_ask' },
            ],
          },
        },
      },
      {
        label: 'Say nothing — not yet.',
        outcomes: {
          success: {
            text: '{hero} keeps it close a while longer. Whatever it is, it can wait for a steadier season.',
            outcomes: [],
          },
        },
      },
    ],
  },
  {
    id: 'family_party_spark_ask',
    category: 'chain',
    illustration: 'hearth_evening',
    title: 'The Question',
    text: '{hero} finds {partner} somewhere the post\'s business won\'t interrupt them and asks, plainly, for the one thing left unsaid between them.',
    conditions: [],
    weight: 0,
    choices: [
      {
        label: 'Ask {partner} to be wed.',
        check: { skill: 'diplomacy', stat: 'charm', difficulty: 8 },
        outcomes: {
          critSuccess: {
            text: '{partner} doesn\'t hesitate — the answer comes back before {hero} has finished asking, and half the post seems to know it within the hour.',
            outcomes: [
              { type: 'formHeroUnion' },
              { type: 'addTrait', trait: 'wed_party' },
              { type: 'history', text: 'Wed {partner}, another of the company\'s own.' },
            ],
          },
          success: {
            text: '{partner} says yes — quietly, and a little disbelieving of the fact, but yes.',
            outcomes: [
              { type: 'formHeroUnion' },
              { type: 'addTrait', trait: 'wed_party' },
              { type: 'history', text: 'Wed {partner}, another of the company\'s own.' },
            ],
          },
          failure: {
            text: '{partner} isn\'t ready — not a no, exactly, but not the yes {hero} was braced for either. It sits awkwardly between them for a while after.',
            outcomes: [{ type: 'stress', delta: 1 }],
          },
          critFailure: {
            text: 'It comes out wrong, or lands wrong, or both — {partner} turns the question aside so fast it barely counts as having been asked. Some things are hard to unspeak.',
            outcomes: [
              { type: 'stress', delta: 2 },
              { type: 'history', text: 'Asked {partner} to be wed, and was refused.' },
            ],
          },
        },
      },
      {
        label: 'Let the moment pass.',
        outcomes: {
          success: {
            text: '{hero} loses the nerve, or the moment, or both, and the question goes back to wherever it had been waiting.',
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
