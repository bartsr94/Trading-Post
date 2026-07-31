// Recruitment events (CHARACTERS_SPEC.md §6): named characters join through
// event chains, never a menu purchase. Each uses the generic `recruitCharacter`
// outcome against a template id from content/recruits.ts, gated on standing,
// flags, or roster size. `once: true` keeps a template from joining twice.

import type { GameEvent } from '../../engine/events/types';
import { makeChoiceEvent, outcome } from './eventHelpers';

export const RECRUIT_EVENTS: GameEvent[] = [
  makeChoiceEvent({
    id: 'recruit_renowned_trader',
    category: 'post',
    illustration: 'trader_arrives',
    title: 'A Name Comes Upriver',
    text: 'A well-dressed stranger steps off the supply boat as though he owns it, and half of Thornwatch would swear he nearly does. Odren — the trader whose ventures rivals whisper about — has heard of your little post at the edge of the map, and pronounces himself intrigued. He is not offering charity. He wants a share, a free hand at the ledger, and a signing sum that would insult a lesser man to omit.',
    conditions: [
      { type: 'minTurn', value: 4 },
      { type: 'silverAtLeast', value: 60 },
      { type: 'rosterBelow', scope: 'living', value: 9 },
    ],
    weight: 14,
    once: true,
    cooldownTurns: 3,
    binding: { type: 'highestSkill', skill: 'bargain' },
    choices: [
      {
        type: 'flat',
        label: 'Meet his price — a man like this pays for himself.',
        requires: [{ type: 'silverAtLeast', value: 60 }],
        text: 'The sum changes hands and Odren changes hats — from guest to partner in the space of an afternoon. Within a week he has re-sorted your ledger, insulted two suppliers into better terms, and made himself indispensable. Rivals in Thornwatch will hear of it, and doors that were shut will open.',
        outcomes: [
          outcome.silver(-60),
          { type: 'recruitCharacter', templateId: 'renowned_trader' },
          outcome.history('Brought the trader Odren into the company.'),
        ],
      },
      {
        type: 'checked',
        label: 'Talk him down — flatter the vanity, trim the fee.',
        check: { skill: 'diplomacy', stat: 'charm', difficulty: 11, tags: ['strangers'] },
        critSuccess: {
          text: 'You praise his reputation until he cannot bear to seem grasping. He waves the signing sum away entirely — "call it an investment" — and joins on a handshake alone.',
          outcomes: [
            { type: 'recruitCharacter', templateId: 'renowned_trader' },
            outcome.history('Won the trader Odren without paying a copper.'),
          ],
        },
        success: {
          text: 'A long evening of wine and flattery whittles his fee to something the strongbox can bear. He signs, grumbling happily that you are the first here worth dealing with.',
          outcomes: [
            outcome.silver(-30),
            { type: 'recruitCharacter', templateId: 'renowned_trader' },
            outcome.history('Bargained the trader Odren into the company.'),
          ],
        },
        failure: {
          text: 'He hears the haggling for what it is and takes offence. "I misjudged the scale of this operation," he says, already turning for the boat. The door, for now, is closed.',
          outcomes: [],
        },
      },
      {
        type: 'flat',
        label: 'Send him back downriver — you keep your own counsel.',
        text: 'You thank him for the visit and decline the partnership. He seems more amused than wounded, and the boat carries him back toward the money he already has.',
        outcomes: [],
      },
    ],
  }),
  makeChoiceEvent({
    id: 'recruit_river_daughter',
    category: 'post',
    illustration: 'river_envoy',
    title: 'A Daughter of the Towns',
    text: 'She comes to the gate with a clan-mother’s letter and a ledger of her own. Naru of the Tributary Towns learned Ansberrian accounts to keep her people from being cheated, and has decided she can do more good inside your counting house than shouting at it from the wharf. Her kin approve; the arrangement, she makes clear, is a favour to both sides.',
    conditions: [
      { type: 'communityStandingAtLeast', location: 'river_meet', value: 30 },
      { type: 'locationDiscovery', location: 'river_meet', atLeast: 'visited' },
      { type: 'rosterBelow', scope: 'living', value: 9 },
    ],
    weight: 12,
    once: true,
    cooldownTurns: 3,
    binding: { type: 'highestSkill', skill: 'diplomacy' },
    factions: ['RIVER_CLANS'],
    peoples: ['kiswani'],
    loreRef: ['Northern Tributary Settlements.md'],
    choices: [
      {
        type: 'flat',
        label: 'Welcome her — an honest broker between two worlds.',
        text: 'She takes a corner of the trade hall and makes it hers. The river towns deal more easily with a post that keeps one of their daughters at its books, and more than one bad bargain is quietly averted before it is struck.',
        outcomes: [
          { type: 'recruitCharacter', templateId: 'river_daughter' },
          { type: 'communityStanding', location: 'river_meet', delta: 4 },
          outcome.history('Took Naru of the Tributary Towns into the company.'),
        ],
      },
      {
        type: 'flat',
        label: 'Decline gently — you cannot feed another mouth yet.',
        text: 'You explain the strongbox with more honesty than pride. She nods, unsurprised, and folds her letter away. "When you can," she says. The offer, you sense, will not stand forever.',
        outcomes: [{ type: 'communityStanding', location: 'river_meet', delta: -1 }],
      },
    ],
  }),
];
