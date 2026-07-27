// General mischief: a lower-stakes, more frequent tier of friction than the
// standing-gated tribute events (./tribute.ts) — the wilds testing the post
// whether or not there's an active grievance to justify it. See ./index.ts
// for shared context.

import type { GameEvent } from '../../../engine/events/types';

export const ORC_FLAVOR_EVENTS: GameEvent[] = [
  {
    id: 'beastfolk_livestock_raid',
    category: 'post',
    illustration: 'beastfolk_livestock',
    title: 'Fewer Than There Should Be',
    text: 'The herders come in short at the morning count — no blood, no broken fence, just quieter tracks than a wolf leaves and the particular smell of a cook-fire that isn\'t yours. Orcs, or goblins, or both; whoever it was knew exactly how many they could take without the loss looking deliberate. {hero} is the one deciding whether that\'s worth chasing.',
    conditions: [
      { type: 'locationDiscoveryAny', locations: ['beast_wilds', 'goblin_wilds'], atLeast: 'visited' },
      { type: 'herdAtLeast', value: 3 },
      { type: 'standingAtMost', faction: 'BEASTFOLK', value: 40 },
    ],
    weight: 7,
    cooldownTurns: 3,
    binding: { type: 'highestSkill', skill: 'survival' },
    factions: ['BEASTFOLK'],
    peoples: ['orc', 'goblin'],
    arc: 'beastfolk_flavor',
    choices: [
      {
        label: 'Track them at first light.',
        check: { skill: 'survival', stat: 'agility', difficulty: 11, tags: ['BEASTFOLK'] },
        outcomes: {
          critSuccess: {
            text: '{hero} reads the ground like a page and runs the thieves down before they\'ve finished skinning what they took. What\'s left of the herd comes home, and the word that goes with it — that this post tracks its losses — is worth more than the meat.',
            outcomes: [
              { type: 'standing', faction: 'BEASTFOLK', delta: 1 },
              { type: 'history', text: 'Ran down livestock thieves from the wilds and recovered the herd.' },
            ],
          },
          success: {
            text: '{hero} finds the trail, finds the camp, and comes back with most of what was lost and a little respect that comes from not making it easy.',
            outcomes: [{ type: 'addHerd', delta: 1 }],
          },
          failure: {
            text: 'The trail runs out on rock and river, the way a trail does when whoever left it knew the ground better than {hero} does.',
            outcomes: [
              { type: 'loseHerd', delta: 1 },
              { type: 'stress', delta: 1 },
            ],
          },
          critFailure: {
            text: '{hero} follows the wrong trail entirely, loses a day, and comes home to find the herd thinner than when {he} left it — someone came back for a second helping while the post\'s best tracker was busy elsewhere.',
            outcomes: [{ type: 'loseHerd', delta: 2 }],
          },
        },
      },
      {
        label: 'Write it off — the wilds always take a little.',
        outcomes: {
          success: {
            text: 'Chasing thieves through unfamiliar country for a handful of head has never been worth the risk, and it isn\'t today either. The herd is smaller by morning\'s count and no further conversation is had about it.',
            outcomes: [{ type: 'loseHerd', delta: 1 }],
          },
        },
      },
    ],
  },
  {
    id: 'beastfolk_pilfering',
    category: 'post',
    illustration: 'beastfolk_pilfering',
    title: 'Light Fingers in the Storehouse',
    text: 'Small things go missing in small amounts — tools, a coil of rope, a sack of salt that was definitely full yesterday — never enough at once to call it a raid, always enough to notice. {hero} has a good guess who: orcs and goblins drift close to the walls at night more than the guards would like, testing what they can get away with as much as what they can carry.',
    conditions: [
      { type: 'locationDiscoveryAny', locations: ['beast_wilds', 'goblin_wilds'], atLeast: 'visited' },
      { type: 'standingAtMost', faction: 'BEASTFOLK', value: 40 },
    ],
    weight: 8,
    cooldownTurns: 2,
    binding: { type: 'highestSkill', skill: 'stealth' },
    factions: ['BEASTFOLK'],
    peoples: ['orc', 'goblin'],
    arc: 'beastfolk_flavor',
    choices: [
      {
        label: 'Set a watch and catch them at it.',
        check: { skill: 'stealth', stat: 'agility', difficulty: 10, tags: ['BEASTFOLK'] },
        outcomes: {
          critSuccess: {
            text: '{hero} waits out three quiet nights and catches a goblin scout with a sack half-full, mid-reach. Rather than raise the alarm, {hero} lets her go empty-handed and makes sure word gets back to her clan of exactly how close she came to being caught. The pilfering stops.',
            outcomes: [
              { type: 'standing', faction: 'BEASTFOLK', delta: 1 },
              { type: 'history', text: 'Caught a beastfolk pilferer in the act and let the lesson do the rest.' },
            ],
          },
          success: {
            text: 'The watch pays off — {hero} spots a shape at the storehouse wall and the shape decides the risk isn\'t worth it anymore, tonight at least.',
            outcomes: [],
          },
          failure: {
            text: 'A long, cold, uneventful watch, and the storehouse is short again by morning anyway — whoever it was simply waited {hero} out.',
            outcomes: [
              { type: 'good', good: 'tools', delta: -2 },
              { type: 'stress', delta: 1 },
            ],
          },
          critFailure: {
            text: 'The watch is a waste twice over: nothing caught, and by the time {hero} gives it up as a bad job, the storehouse has been picked over more thoroughly than usual.',
            outcomes: [
              { type: 'good', good: 'tools', delta: -3 },
              { type: 'silver', delta: -8 },
            ],
          },
        },
      },
      {
        label: 'Let it go — it costs less than the lost sleep chasing it.',
        outcomes: {
          success: {
            text: 'The post absorbs the loss the way it absorbs most frontier costs — quietly, and without much choice in the matter.',
            outcomes: [
              { type: 'good', good: 'tools', delta: -1 },
              { type: 'silver', delta: -4 },
            ],
          },
        },
      },
    ],
  },
  {
    id: 'beastfolk_dare',
    category: 'post',
    illustration: 'beastfolk_dare',
    title: 'A Challenge, Loudly Made',
    text: 'A young orc plants herself just outside bowshot and shouts a challenge across the open ground — a wrestle, a footrace, whatever passes for sport out here — naming {hero} by whatever name the wilds have given {him}. Orcs measure a man by what he can back up, not what he says, and word of who stands and who flinches always makes it home. Ignoring her is an option. Staying ignored is not, for her.',
    conditions: [
      { type: 'locationDiscovery', location: 'beast_wilds', atLeast: 'visited' },
      { type: 'heroGender', gender: 'male' },
    ],
    weight: 6,
    cooldownTurns: 3,
    binding: { type: 'weightedStat', stat: 'might' },
    factions: ['BEASTFOLK'],
    peoples: ['orc'],
    arc: 'beastfolk_flavor',
    choices: [
      {
        label: 'Take the dare.',
        check: { skill: 'combat', stat: 'might', difficulty: 10, tags: ['BEASTFOLK'] },
        outcomes: {
          critSuccess: {
            text: '{hero} puts her down hard enough to draw a laugh out of her own war-band, and the story that travels back to the wilds does the post more good than a season of careful diplomacy — this is exactly the kind of showing orcs remember a man by.',
            outcomes: [
              { type: 'standing', faction: 'BEASTFOLK', delta: 4 },
              { type: 'history', text: 'Won a shouted challenge from an orc youth and earned the wilds\' respect.' },
            ],
          },
          success: {
            text: 'It\'s close and it\'s ugly and {hero} wins anyway, which is apparently all that matters. The orc claps {him} on the shoulder like they\'re old friends and wanders off satisfied.',
            outcomes: [{ type: 'standing', faction: 'BEASTFOLK', delta: 2 }],
          },
          failure: {
            text: 'She\'s stronger than she looked, and {hero} ends up in the dirt for it — bruised more in pride than in body, but bruised.',
            outcomes: [
              { type: 'health', delta: -2 },
              { type: 'stress', delta: 1 },
            ],
          },
          critFailure: {
            text: 'It goes badly enough that {hero} is carried back rather than walking, and the story that travels back to the wilds is not the one the post wanted told.',
            outcomes: [
              { type: 'health', delta: -4 },
              { type: 'standing', faction: 'BEASTFOLK', delta: -1 },
            ],
          },
        },
      },
      {
        label: 'Wave her off — there\'s work to do.',
        outcomes: {
          success: {
            text: '{hero} turns {his} back on the shouting, which is its own kind of answer. The orc calls {him} a coward once, for form\'s sake, and loses interest by midday.',
            outcomes: [{ type: 'standing', faction: 'BEASTFOLK', delta: -1 }],
          },
        },
      },
    ],
  },
  {
    id: 'orc_battle_of_wits',
    category: 'post',
    illustration: 'beastfolk_dare',
    title: 'Sharper Than He Looks',
    text: 'An orc tactician has been watching the post a while now, and she isn\'t interested in another wrestle — she\'s heard enough of those. She lays out a game instead, knucklebones and a wager neither side will call small, and names {hero} her opponent by reputation. Muscle earns a war-band\'s notice for a season; a mind sharp enough to beat her at her own game earns something that lasts longer.',
    conditions: [{ type: 'locationDiscovery', location: 'beast_wilds', atLeast: 'visited' }],
    weight: 6,
    cooldownTurns: 3,
    binding: { type: 'weightedStat', stat: 'wits' },
    factions: ['BEASTFOLK'],
    peoples: ['orc'],
    arc: 'beastfolk_flavor',
    choices: [
      {
        label: 'Play the game.',
        check: { skill: 'lore', stat: 'wits', difficulty: 10, tags: ['BEASTFOLK', 'gamble'] },
        outcomes: {
          critSuccess: {
            text: '{hero} reads her tells three moves before she makes them and takes the wager clean. She doesn\'t look angry about losing — she looks like she\'s already telling the story wrong on purpose, the better version, the one where the post has someone worth reckoning with.',
            outcomes: [
              { type: 'standing', faction: 'BEASTFOLK', delta: 4 },
              { type: 'history', text: 'Out-thought an orc tactician at her own game and earned the wilds\' respect.' },
            ],
          },
          success: {
            text: '{hero} scrapes out a win by a margin neither of them is proud of, and the tactician concedes it with a short, genuine nod — the kind she doesn\'t hand out for free.',
            outcomes: [{ type: 'standing', faction: 'BEASTFOLK', delta: 2 }],
          },
          failure: {
            text: 'She reads {hero} easily and takes the wager without much of a fight. It stings more than losing a wrestle would have.',
            outcomes: [
              { type: 'silver', delta: -6 },
              { type: 'stress', delta: 1 },
            ],
          },
          critFailure: {
            text: '{hero} never sees the trap in the wager until it\'s already sprung, and the tactician collects with the particular satisfaction of someone who expected exactly this.',
            outcomes: [
              { type: 'silver', delta: -14 },
              { type: 'standing', faction: 'BEASTFOLK', delta: -1 },
            ],
          },
        },
      },
      {
        label: 'Decline — it\'s a game built for her to win.',
        outcomes: {
          success: {
            text: '{hero} begs off, and the tactician doesn\'t press it. She simply files the answer away, unimpressed, and turns back to whatever she was doing before {hero} interrupted it.',
            outcomes: [{ type: 'standing', faction: 'BEASTFOLK', delta: -1 }],
          },
        },
      },
    ],
  },
  {
    id: 'beastfolk_visitors',
    category: 'post',
    illustration: 'beastfolk_visitors',
    title: 'Testing the Waters',
    text: 'A handful of orcs and goblins start showing up at the market days, not to trade so much as to look — at the walls, at the residents, at how the post actually runs when no war-band is watching. They don\'t stay past dusk and they don\'t explain themselves, but they keep coming back, like they\'re deciding something none of them have said out loud yet.',
    conditions: [
      { type: 'locationDiscoveryAny', locations: ['beast_wilds', 'goblin_wilds'], atLeast: 'visited' },
      { type: 'standingAtLeast', faction: 'BEASTFOLK', value: 0 },
      { type: 'standingAtMost', faction: 'BEASTFOLK', value: 25 },
    ],
    weight: 6,
    cooldownTurns: 5,
    binding: { type: 'highestStat', stat: 'charm' },
    factions: ['BEASTFOLK'],
    peoples: ['orc', 'goblin'],
    arc: 'beastfolk_flavor',
    choices: [
      {
        label: 'Let them look — a post with nothing to hide has nothing to fear.',
        outcomes: {
          success: {
            text: '{hero} tells the guards to stand easy and let the visitors wander. Whatever they came here to decide, they\'ll decide it with better information than rumor gives them.',
            outcomes: [
              { type: 'addTransient', kind: 'beastfolkVisitors', count: 4, turns: 3 },
              { type: 'history', text: 'Let a handful of orcs and goblins linger at market to size the post up.' },
            ],
          },
        },
      },
      {
        label: 'Keep them at the market gate and no further.',
        outcomes: {
          success: {
            text: '{hero} draws a line they\'re welcome up to and not past. They take the boundary without complaint — maybe that was the actual test.',
            outcomes: [{ type: 'standing', faction: 'BEASTFOLK', delta: 1 }],
          },
        },
      },
    ],
  },
];
