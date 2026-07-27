// Beastfolk settlement events — a band asking to join the post outright,
// as guards or as laborers. See ./index.ts for shared context.

import type { GameEvent } from '../../../engine/events/types';

export const ORC_SETTLEMENT_EVENTS: GameEvent[] = [
  {
    id: 'beastfolk_settlement',
    category: 'post',
    illustration: 'beastfolk_settlers',
    title: 'A Band Asks to Stay',
    text: 'A dozen or so orcs and goblins arrive together, travel-worn, and ask through {hero} for a place inside the palisade rather than beyond it — tired, they say, of a life spent taking what a season\'s luck won\'t give freely. They offer their spears for the post\'s defense in exchange for a roof and a stake in what you\'re building. No war-band or clan will vouch for them; they vouch only for themselves.',
    conditions: [
      { type: 'locationDiscoveryAny', locations: ['beast_wilds', 'goblin_wilds'], atLeast: 'visited' },
      { type: 'standingAtLeast', faction: 'BEASTFOLK', value: 25 },
    ],
    weight: 6,
    cooldownTurns: 6,
    binding: { type: 'highestSkill', skill: 'leadership' },
    factions: ['BEASTFOLK'],
    peoples: ['orc', 'goblin'],
    arc: 'beastfolk_settlement',
    choices: [
      {
        label: 'Take them in as guards.',
        outcomes: {
          success: {
            text: 'They settle in along the wall, keeping to themselves at first, then less so. Some of the post\'s own residents are slow to warm to the new neighbors — but the palisade has more spears on it than it did yesterday.',
            outcomes: [
              // Tagged by specific people (not a generic 'beastfolk' label),
              // matching how a Kiswani/Hanjoda hire is tagged 'kiswani'/
              // 'hanjoda' — the Origins breakdown on the People screen reads
              // 'Orc'/'Goblin', not an undifferentiated "Beastfolk Clan".
              { type: 'addResidents', role: 'guards', count: 2, tag: 'orc', group: 'native' },
              { type: 'addResidents', role: 'guards', count: 1, tag: 'goblin', group: 'native' },
              { type: 'standing', faction: 'BEASTFOLK', delta: 4 },
              { type: 'contentment', delta: -1 },
              // A guest under the same roof is not yet a neighbor — settling in
              // is its own slow arc (beastfolk_integration_orc/_goblin), not
              // resolved by this one welcome.
              { type: 'friction', heritage: 'orc', delta: 7 },
              { type: 'friction', heritage: 'goblin', delta: 7 },
              { type: 'history', text: 'A band of orcs and goblins settled at the post as guards.' },
            ],
          },
        },
      },
      {
        label: 'Decline — the post is not ready for that yet.',
        outcomes: {
          success: {
            text: '{hero} turns them away as gently as the thing allows. They take it without rancor, gather what they came with, and move on to try their luck somewhere less crowded with reasons to say no.',
            outcomes: [{ type: 'standing', faction: 'BEASTFOLK', delta: -2 }],
          },
        },
      },
    ],
  },
  {
    id: 'beastfolk_settlement_workers',
    category: 'post',
    illustration: 'beastfolk_settlers',
    title: 'Hands, Not Spears',
    text: 'This time it is not warriors at the gate but a mixed handful of orcs and goblins who point at the storehouse and the half-finished palisade rather than the wall-walk — they have come to work, they say, tired of a life measured in raids that pay less each season. {hero} is the one they wait on for an answer, tools already slung over their shoulders like they expect to be put to use today.',
    conditions: [
      { type: 'locationDiscoveryAny', locations: ['beast_wilds', 'goblin_wilds'], atLeast: 'visited' },
      { type: 'standingAtLeast', faction: 'BEASTFOLK', value: 25 },
    ],
    weight: 5,
    cooldownTurns: 6,
    binding: { type: 'highestSkill', skill: 'leadership' },
    factions: ['BEASTFOLK'],
    peoples: ['orc', 'goblin'],
    arc: 'beastfolk_settlement',
    choices: [
      {
        label: 'Put them to work.',
        outcomes: {
          success: {
            text: 'They settle into the yard and the fields with the same blunt practicality they haggle with — no ceremony, just hands added to the work that needed doing. The post is bigger for it, and no quieter.',
            outcomes: [
              { type: 'addResidents', role: 'craftsfolk', count: 1, tag: 'orc', group: 'native' },
              { type: 'addResidents', role: 'porters', count: 2, tag: 'goblin', group: 'native' },
              { type: 'standing', faction: 'BEASTFOLK', delta: 4 },
              { type: 'contentment', delta: -1 },
              { type: 'friction', heritage: 'orc', delta: 7 },
              { type: 'friction', heritage: 'goblin', delta: 7 },
              { type: 'history', text: 'A band of orcs and goblins settled at the post as laborers.' },
            ],
          },
        },
      },
      {
        label: 'Decline — the post has no place for them yet.',
        outcomes: {
          success: {
            text: '{hero} turns them away as gently as the thing allows. They shoulder their tools and move on without argument, already scanning the treeline for somewhere less crowded with reasons to say no.',
            outcomes: [{ type: 'standing', faction: 'BEASTFOLK', delta: -2 }],
          },
        },
      },
    ],
  },
];
