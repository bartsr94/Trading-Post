// Beastfolk settlement events — a band asking to join the post outright,
// as guards or as laborers. See ./index.ts for shared context.
//
// `beastfolk_settlement` (guards) now opens a 2-stage chain: taking the band
// in queues `beastfolk_settlement_claim` a few turns later, giving the
// original "no war-band will vouch for them" line an actual payoff — they're
// deserters, and the band they deserted comes to collect. Reworked
// 2026-07-28.
//
// `beastfolk_settlement_workers` (laborers) got its own 2-stage follow-up the
// same day, deliberately a different shape than the guards arc: rather than
// their old life reclaiming them by force, it tempts them — an old contact
// tries to talk a worker into smuggling goods out through routes only they
// know. Purely internal to the post (friction/contentment/residents), no
// `standing` swing, unlike the guards claim event's faction-facing stakes.

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
              { type: 'queueEvent', eventId: 'beastfolk_settlement_claim', delayTurns: 4 },
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
    id: 'beastfolk_settlement_claim',
    category: 'chain',
    illustration: 'beastfolk_reckoning',
    title: 'The Ones Who Came Looking',
    text: 'It was only a matter of time before someone came asking. A rival band pulls up short of the wall, and its leader doesn\'t waste breath on courtesy — the orcs and goblins the post took in weren\'t ownerless wanderers, they\'re deserters, and this band has come to collect what they\'re owed for the desertion. She names her price plainly: the guards themselves, or something dear enough to make losing them not worth the trouble. {hero} is the one who has to answer her, with the newcomers watching from the wall to see whether the post keeps what it takes in.',
    conditions: [],
    weight: 0,
    binding: { type: 'highestSkill', skill: 'leadership' },
    factions: ['BEASTFOLK'],
    peoples: ['orc', 'goblin'],
    arc: 'beastfolk_settlement',
    choices: [
      {
        label: 'Stand between them and your own.',
        check: { skill: 'leadership', stat: 'resolve', difficulty: 12, tags: ['BEASTFOLK', 'intimidation'] },
        outcomes: {
          critSuccess: {
            text: '{hero} doesn\'t raise a weapon, just makes the position plain: the post\'s people are the post\'s people, full stop. Something in that certainty gets through where a threat wouldn\'t have — the rival band breaks camp before dusk, and word of it reaches the guards on the wall before {hero} even gets back. Whatever they were before, they\'re something closer to home now.',
            outcomes: [
              { type: 'friction', heritage: 'orc', delta: -4 },
              { type: 'friction', heritage: 'goblin', delta: -4 },
              { type: 'standing', faction: 'BEASTFOLK', delta: 4 },
              { type: 'contentment', delta: 1 },
              { type: 'history', text: 'Stood down a rival band that came to reclaim the post\'s beastfolk guards.' },
            ],
          },
          success: {
            text: 'It\'s a tense hour more than a fight, but {hero} holds the line and the rival band decides the price of pushing further isn\'t worth it. They leave grumbling, not satisfied, but gone.',
            outcomes: [
              { type: 'friction', heritage: 'orc', delta: -2 },
              { type: 'friction', heritage: 'goblin', delta: -2 },
              { type: 'standing', faction: 'BEASTFOLK', delta: 1 },
            ],
          },
          failure: {
            text: 'It goes further than words before it\'s done — nothing fatal, but {hero} comes away bruised, and so does the standoff\'s ending: the rival band leaves only because pressing further would cost them too, not because {hero} won anything outright.',
            outcomes: [
              { type: 'health', delta: -3 },
              { type: 'stress', delta: 1 },
            ],
          },
          critFailure: {
            text: 'The standoff breaks the wrong way. {hero} is put down hard before the rival band finally has enough and withdraws — and one of the guards {hero} was defending doesn\'t wait to see how it ends, slipping off in the confusion rather than risk being the reason for the next visit.',
            outcomes: [
              { type: 'health', delta: -5 },
              { type: 'loseResidents', role: 'guards', count: 1, group: 'native' },
              { type: 'stress', delta: 2 },
            ],
          },
        },
      },
      {
        label: 'Pay their price and let them leave satisfied.',
        outcomes: {
          success: {
            text: '{hero} counts it out without argument — better a season\'s silver than a fight over people who\'ve already chosen a side. The rival band takes it and takes its leave, apparently satisfied the debt\'s been settled the old way.',
            outcomes: [
              { type: 'silver', delta: -24 },
              { type: 'good', good: 'hides', delta: -4 },
              { type: 'standing', faction: 'BEASTFOLK', delta: 1 },
              { type: 'history', text: 'Paid off a rival band that came to reclaim the post\'s beastfolk guards.' },
            ],
          },
        },
      },
      {
        label: 'Hand them back — they should have told you the truth.',
        outcomes: {
          success: {
            text: '{hero} decides a lie by omission is still a lie, and the newcomers go back the way they came, disarmed of whatever they thought they\'d found here. The rest of the post takes the lesson quietly: what the post takes in, it can just as easily give back up.',
            outcomes: [
              { type: 'loseResidents', role: 'guards', count: 3, group: 'native' },
              { type: 'standing', faction: 'BEASTFOLK', delta: -4 },
              { type: 'contentment', delta: -1 },
              { type: 'history', text: 'Handed the post\'s beastfolk guards back to the rival band that came for them.' },
            ],
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
              { type: 'queueEvent', eventId: 'beastfolk_settlement_temptation', delayTurns: 4 },
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
  {
    id: 'beastfolk_settlement_temptation',
    category: 'chain',
    illustration: 'beastfolk_temptation',
    title: 'Someone They Used to Know',
    text: '{hero} catches it almost by accident — a goblin trader lingering too long near the storehouse after hours, speaking low to one of the post\'s own workers in a tongue half the guards don\'t bother learning. It isn\'t a threat, not exactly: an old debt, a favor for kin still out in the wilds, goods slipped out the back in exchange for silver or a name cleared. The worker hasn\'t said yes yet. Whether they ever get the chance depends on what {hero} does about it right now.',
    conditions: [],
    weight: 0,
    binding: { type: 'highestSkill', skill: 'stealth' },
    factions: ['BEASTFOLK'],
    peoples: ['orc', 'goblin'],
    arc: 'beastfolk_settlement',
    choices: [
      {
        label: 'Confront them both, plainly.',
        check: { skill: 'leadership', stat: 'resolve', difficulty: 11, tags: ['BEASTFOLK', 'diplomacy'] },
        outcomes: {
          critSuccess: {
            text: '{hero} doesn\'t raise a voice, just states what was seen and waits. The worker refuses the offer on the spot, plainly relieved to have it out in the open, and the trader melts back toward the treeline with nothing to show for the trip.',
            outcomes: [
              { type: 'friction', heritage: 'orc', delta: -3 },
              { type: 'friction', heritage: 'goblin', delta: -3 },
              { type: 'contentment', delta: 1 },
              { type: 'history', text: 'Talked a settled laborer out of smuggling for an old contact from the wilds.' },
            ],
          },
          success: {
            text: 'It\'s an uncomfortable conversation, but it lands — the worker sends the trader off empty-handed, if a little shamefaced about how close it came.',
            outcomes: [
              { type: 'friction', heritage: 'orc', delta: -1 },
              { type: 'friction', heritage: 'goblin', delta: -1 },
            ],
          },
          failure: {
            text: 'The confrontation reads as an accusation more than a warning, and the worker takes it that way — nothing is admitted, nothing resolved, and the air between them stays sour long after the trader\'s gone.',
            outcomes: [
              { type: 'friction', heritage: 'orc', delta: 2 },
              { type: 'friction', heritage: 'goblin', delta: 2 },
              { type: 'stress', delta: 1 },
            ],
          },
          critFailure: {
            text: 'It goes worse than silence would have — stung by being accused outright, the worker packs up before dawn and leaves with the trader after all, taking a little of the storehouse with them on the way out.',
            outcomes: [
              { type: 'loseResidents', count: 1, group: 'native' },
              { type: 'good', good: 'tools', delta: -3 },
              { type: 'friction', heritage: 'orc', delta: 3 },
              { type: 'friction', heritage: 'goblin', delta: 3 },
            ],
          },
        },
      },
      {
        label: 'Say nothing — let them make their own choice.',
        outcomes: {
          success: {
            text: '{hero} decides this isn\'t a decision to make for someone else, and steps back without a word. Whatever passes between the worker and the trader after that, it happens unwatched.',
            outcomes: [
              { type: 'friction', heritage: 'orc', delta: -1 },
              { type: 'friction', heritage: 'goblin', delta: -1 },
              { type: 'history', text: 'Let a settled laborer decide alone whether to deal with an old contact from the wilds.' },
            ],
          },
        },
      },
      {
        label: 'Report it and have the worker watched.',
        outcomes: {
          success: {
            text: 'Nothing is said to the worker directly, but a quieter watch goes up around the storehouse from that night on. No goods go missing — but word gets around all the same that trust here only runs so deep.',
            outcomes: [
              { type: 'friction', heritage: 'orc', delta: 3 },
              { type: 'friction', heritage: 'goblin', delta: 3 },
              { type: 'contentment', delta: -1 },
            ],
          },
        },
      },
    ],
  },
];
