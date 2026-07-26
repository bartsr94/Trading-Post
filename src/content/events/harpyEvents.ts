// Harpies (TERRITORY_DISCOVERY_SPEC.md §6) — the Ashmark's winged people of the
// high Stormwall crags. A full settleable people, seatless like the Beastfolk:
// no aerie speaks for the rest, so standing moves only through events, and the
// same low→high arc applies — tribute pressure at hostile standing, a voluntary
// union as trust rises, settlement at the top, then the slow work of settling
// in. Gated on the Windward Crags (harpy_eyrie) being discovered; content
// mirrors the Beastfolk set beat-for-beat (see beastfolkEvents.ts).
//
// Harpy lore is game-specific and not yet written down in docs/lore/, so these
// events carry no `loreRef` (nothing to point at yet) — add one once it lands.

import type { GameEvent } from '../../engine/events/types';

export const HARPY_EVENTS: GameEvent[] = [
  {
    id: 'harpy_tribute',
    category: 'post',
    illustration: 'harpy_demand',
    title: 'A Shadow on the Wall',
    text: 'They come down out of a grey morning without a sound until the last moment — three harpies, wings folded, perched along the palisade top where no ladder stands. Their eldest does not climb down. She names a price from up there, in trade-tongue worn smooth by use: grain and bright metal, left on the north stones each new moon, and the crags will let the post keep its roofs. {hero} has to answer her craning {his} neck, the whole yard watching.',
    conditions: [
      { type: 'locationDiscovery', location: 'harpy_eyrie', atLeast: 'visited' },
      { type: 'standingAtMost', faction: 'HARPY', value: -20 },
    ],
    weight: 10,
    cooldownTurns: 3,
    binding: { type: 'highestStat', stat: 'resolve' },
    factions: ['HARPY'],
    peoples: ['harpy'],
    choices: [
      {
        label: 'Leave the tribute on the north stones.',
        outcomes: {
          success: {
            text: 'You set it out yourself, in the open, and say the terms back to her plainly: this much each moon, for a season left in peace. She takes it without thanks and drops off the wall backward into the wind. So long as the stones are not bare, the crags will keep their distance.',
            outcomes: [
              { type: 'silver', delta: -20 },
              { type: 'good', good: 'grain', delta: -5 },
              { type: 'tribute', faction: 'HARPY', direction: 'pay', silver: 10, goods: { grain: 3 } },
              { type: 'standing', faction: 'HARPY', delta: 2 },
              { type: 'history', text: 'Bought peace from the crags with a moon-tribute.' },
            ],
          },
        },
      },
      {
        label: 'Send {hero} to refuse them to their faces.',
        check: { skill: 'leadership', stat: 'resolve', difficulty: 11, tags: ['HARPY', 'intimidation'] },
        outcomes: {
          critSuccess: {
            text: '{hero} climbs the wall-walk to stand level with the eldest and says no without a tremor, close enough to feel the down-draft of her wings. She studies {him} a long moment — then laughs, a harsh gull-cry of a sound, and the three of them lift off empty-handed. Nerve, it turns out, reads the same at any altitude.',
            outcomes: [
              { type: 'standing', faction: 'HARPY', delta: 3 },
              { type: 'history', text: 'Refused the crags\' tribute to their faces and won their regard.' },
            ],
          },
          success: {
            text: '{hero} holds the line and does not look away. The eldest hisses something in her own tongue and drops off the wall — nothing taken this time, nothing given.',
            outcomes: [{ type: 'standing', faction: 'HARPY', delta: 1 }],
          },
          failure: {
            text: 'The refusal comes out thinner than {hero} meant it to. Over the next nights the storehouse loses more to sharp claws in the dark than the tribute would ever have cost, and the lesson lands the hard way.',
            outcomes: [
              { type: 'good', good: 'grain', delta: -10 },
              { type: 'silver', delta: -12 },
              { type: 'standing', faction: 'HARPY', delta: -3 },
              { type: 'stress', delta: 1 },
            ],
          },
          critFailure: {
            text: 'Refusing was exactly the wrong read. What the crags take on their way to reminding the post of its place costs far more than the price {hero} would not pay, and they leave certain the roofs are theirs to lift whenever they like.',
            outcomes: [
              { type: 'good', good: 'grain', delta: -16 },
              { type: 'silver', delta: -25 },
              { type: 'standing', faction: 'HARPY', delta: -6 },
              { type: 'stress', delta: 2 },
            ],
          },
        },
      },
    ],
  },
  {
    id: 'harpy_match',
    category: 'post',
    illustration: 'harpy_arrival',
    title: 'One Who Came Down',
    text: 'She lands in the yard at dusk, alone, wings still half-spread as if she has not decided to stay — and asks for {hero} by the name the crags have given {him}. No aerie sent her; among her own kind a daughter who leaves is a daughter counted lost, and she has weighed the post against that and chosen it anyway. She will not ask twice, and she will not be talked into leaving with a soft answer instead of a true one.',
    conditions: [
      { type: 'locationDiscovery', location: 'harpy_eyrie', atLeast: 'visited' },
      { type: 'standingAtLeast', faction: 'HARPY', value: 10 },
      { type: 'heroUnmarried' },
      { type: 'heroGender', gender: 'male' },
    ],
    weight: 8,
    once: true,
    cooldownTurns: 4,
    binding: { type: 'highestStat', stat: 'charm' },
    factions: ['HARPY'],
    peoples: ['harpy'],
    choices: [
      {
        label: 'Welcome her into the household.',
        outcomes: {
          success: {
            text: 'There is no rite the Company would name a marriage — only her word and {hero}\'s, and a roof that now shelters one of the crag-born. Word of it will reach the aeries on the wind, and reach them as proof the post keeps faith with those who come down to it.',
            outcomes: [
              { type: 'formUnion', source: 'alliance', heritage: 'harpy' },
              { type: 'standing', faction: 'HARPY', delta: 8 },
              { type: 'addTrait', trait: 'wed_harpy' },
              { type: 'history', text: 'Wed a harpy who came down from the crags and chose the post.' },
            ],
          },
        },
      },
      {
        label: 'Send her back to the wind — this is not a bond you are ready to make.',
        outcomes: {
          success: {
            text: 'She hears the refusal out, unblinking, and takes it the way the crag-born take most things — without argument and without forgetting. She is airborne before {hero} finishes speaking, and does not come down again.',
            outcomes: [{ type: 'standing', faction: 'HARPY', delta: -3 }],
          },
        },
      },
    ],
  },
  {
    id: 'harpy_settlement',
    category: 'post',
    illustration: 'harpy_settlers',
    title: 'A Flight Asks to Roost',
    text: 'Half a dozen harpies put down on the palisade at first light and, for once, none of them names a price. They are tired, their spokeswoman says — tired of a life spent quarreling over thin hunting on the high crags — and they would sooner keep watch over the post\'s walls and hunt its country than raid it. They offer sharp eyes and sharper talons for a place to roost. No aerie will vouch for them; they vouch for themselves.',
    conditions: [
      { type: 'locationDiscovery', location: 'harpy_eyrie', atLeast: 'visited' },
      { type: 'standingAtLeast', faction: 'HARPY', value: 25 },
    ],
    weight: 6,
    cooldownTurns: 6,
    binding: { type: 'highestSkill', skill: 'leadership' },
    factions: ['HARPY'],
    peoples: ['harpy'],
    choices: [
      {
        label: 'Give them the wall and the hunting grounds.',
        outcomes: {
          success: {
            text: 'They roost along the highest points of the palisade and take to the sky at dawn and dusk, and nothing crosses the open ground for a mile without the watch knowing. Some of the post\'s own are slow to sleep easy under that shadow — but the walls have keener eyes on them than they have ever had.',
            outcomes: [
              { type: 'addResidents', role: 'guards', count: 2, tag: 'harpy', group: 'native' },
              { type: 'addResidents', role: 'hunters', count: 1, tag: 'harpy', group: 'native' },
              { type: 'standing', faction: 'HARPY', delta: 4 },
              { type: 'contentment', delta: -1 },
              // A roost is not yet a welcome — settling in is its own slow arc
              // (harpy_integration), not resolved by this one yes.
              { type: 'friction', heritage: 'harpy', delta: 7 },
              { type: 'history', text: 'A flight of harpies settled at the post as watch and hunters.' },
            ],
          },
        },
      },
      {
        label: 'Decline — the post is not ready to sleep under their wings.',
        outcomes: {
          success: {
            text: '{hero} turns them away as gently as the thing allows. They take it without rancor, spread their wings, and are gone on the next gust to try their luck over country less crowded with reasons to say no.',
            outcomes: [{ type: 'standing', faction: 'HARPY', delta: -2 }],
          },
        },
      },
    ],
  },
  {
    id: 'harpy_integration',
    category: 'post',
    illustration: 'harpy_friction',
    title: 'Under Their Shadow',
    text: 'The harpies who took the post up on its offer keep the watch better than any wall of men — but the grumbling has not stopped. A hen gone missing blamed on them before a fox turns up in the coop; children hurried indoors when a shadow crosses the yard; old hands who will not stand a watch alongside them. {hero} keeps hearing it secondhand, which usually means it runs deeper than what gets said aloud.',
    conditions: [
      { type: 'residentTagAtLeast', tag: 'harpy', value: 1 },
      { type: 'frictionAtLeast', heritage: 'harpy', value: 4 },
    ],
    weight: 8,
    cooldownTurns: 3,
    binding: { type: 'highestSkill', skill: 'leadership' },
    factions: ['HARPY'],
    peoples: ['harpy'],
    choices: [
      {
        label: 'Make both sides share a watch and a fire.',
        check: { skill: 'leadership', stat: 'resolve', difficulty: 10, tags: ['HARPY', 'diplomacy'] },
        outcomes: {
          critSuccess: {
            text: '{hero} does not lecture anyone — just pairs a crag-born to a homeland watch and makes them get through one cold night together. By dawn they are trading the flask and complaining about the same officer. It is a small thing, and it is the first small thing that has gone right between them.',
            outcomes: [
              { type: 'friction', heritage: 'harpy', delta: -5 },
              { type: 'contentment', delta: 1 },
              { type: 'history', text: 'Thawed the standoff between the post and its harpy watch.' },
            ],
          },
          success: {
            text: 'It is an awkward few nights, but {hero} keeps them working the same wall instead of avoiding it, and something eases, a little.',
            outcomes: [{ type: 'friction', heritage: 'harpy', delta: -3 }],
          },
          failure: {
            text: 'The pairing goes nowhere — both sides do the work and neither says a word to the other, and the silence sets harder than before.',
            outcomes: [
              { type: 'friction', heritage: 'harpy', delta: 1 },
              { type: 'stress', delta: 1 },
            ],
          },
          critFailure: {
            text: '{hero} pushes the wrong pair together on the wrong night, and a shouted quarrel on the wall-walk wakes half the post. Nobody comes out of it looking reasonable, least of all {him}.',
            outcomes: [
              { type: 'friction', heritage: 'harpy', delta: 2 },
              { type: 'contentment', delta: -1 },
            ],
          },
        },
      },
      {
        label: 'Let them find their own footing.',
        outcomes: {
          success: {
            text: '{hero} decides this is not worth spending authority on yet. Whether that is patience or avoidance, the muttering does not fade on its own.',
            outcomes: [{ type: 'friction', heritage: 'harpy', delta: 1 }],
          },
        },
      },
    ],
  },
  {
    id: 'harpy_integration_settled',
    category: 'post',
    illustration: 'harpy_settled',
    title: 'Part of the Watch, Now',
    text: 'Nobody announces it. It just becomes true one ordinary night: a homeland-born sentry calls up to the harpy on the high post to ask if she can see the road, and she calls back that it is clear, and neither of them thinks twice about it. Whatever the post was uneasy about before has quietly stopped being a question.',
    conditions: [
      { type: 'residentTagAtLeast', tag: 'harpy', value: 1 },
      { type: 'frictionAtMost', heritage: 'harpy', value: 2 },
    ],
    weight: 6,
    once: true,
    binding: { type: 'highestStat', stat: 'charm' },
    factions: ['HARPY'],
    peoples: ['harpy'],
    choices: [
      {
        label: 'Good. Let it stand.',
        outcomes: {
          success: {
            text: 'The post is a little more itself for it — one less line dividing who belongs and who is only tolerated, and a watch that now trusts its own eyes in the sky.',
            outcomes: [
              { type: 'standing', faction: 'HARPY', delta: 2 },
              { type: 'contentment', delta: 1 },
              { type: 'history', text: 'The post\'s harpy watch finished settling in, grudge-free.' },
            ],
          },
        },
      },
    ],
  },
];
