// Beastfolk — Orcs & Goblins (BEASTFOLK_SPEC.md). Two arcs on the BEASTFOLK
// standing track: low standing brings demand/tribute pressure (never a raid —
// that stays a deliberately separate, not-yet-built system, spec §1); high
// standing opens a voluntary path, since neither people has a chief who can be
// courted the traditional way — individuals approach the post themselves.
// Tone per CLAUDE.md: second person, terse, 60–120 words, choices as intentions.

import type { GameEvent } from '../../engine/events/types';

export const BEASTFOLK_EVENTS: GameEvent[] = [
  {
    id: 'beastfolk_orc_tribute',
    category: 'post',
    illustration: 'orc_demand',
    title: 'A Price for Peace',
    text: 'An orc war-band camps in plain sight beyond bowshot — not hiding, not attacking, just waiting to be noticed. Their spokesman walks in alone at midday and names a price: grain and silver, paid now, for a season left in peace. {hero} is the one who has to answer him, with the whole camp watching to see whether the post pays like it understands the wilds, or has to be taught.',
    conditions: [{ type: 'standingAtMost', faction: 'BEASTFOLK', value: -20 }],
    weight: 10,
    cooldownTurns: 6,
    binding: { type: 'highestStat', stat: 'resolve' },
    choices: [
      {
        label: 'Pay what he asks — buy this season\'s quiet.',
        outcomes: {
          success: {
            text: 'You count it out yourself, in the open, so there is no mistaking it for weakness — a price paid, not a tribute owed. He takes it without thanks and without trouble, and the camp is gone by morning.',
            outcomes: [
              { type: 'silver', delta: -25 },
              { type: 'good', good: 'grain', delta: -5 },
              { type: 'standing', faction: 'BEASTFOLK', delta: 2 },
              { type: 'history', text: 'Paid an orc war-band to leave the post in peace.' },
            ],
          },
        },
      },
      {
        label: 'Send {hero} to face him down and refuse.',
        check: { skill: 'leadership', stat: 'resolve', difficulty: 11, tags: ['BEASTFOLK'] },
        outcomes: {
          critSuccess: {
            text: '{hero} doesn\'t flinch, doesn\'t reach for a weapon, simply says no in a voice that ends the conversation. The spokesman studies {hero} a long moment — then laughs, once, and walks his band off without a backward look. That kind of nerve, it turns out, is its own currency here.',
            outcomes: [
              { type: 'standing', faction: 'BEASTFOLK', delta: 3 },
              { type: 'history', text: 'Refused an orc war-band\'s demand and won their grudging respect.' },
            ],
          },
          success: {
            text: '{hero} holds the line. The spokesman spits, mutters something uncomplimentary, and the camp breaks by evening — nothing taken, nothing given.',
            outcomes: [{ type: 'standing', faction: 'BEASTFOLK', delta: 1 }],
          },
          failure: {
            text: 'The refusal doesn\'t land the way {hero} meant it to. By the time the war-band moves on, the storehouse is short more than they ever asked for, and the point has been made the hard way.',
            outcomes: [
              { type: 'good', good: 'grain', delta: -10 },
              { type: 'silver', delta: -15 },
              { type: 'standing', faction: 'BEASTFOLK', delta: -3 },
              { type: 'stress', delta: 1 },
            ],
          },
          critFailure: {
            text: 'Refusing turns out to have been exactly the wrong read. What the war-band takes on the way out costs far more than the price {hero} wouldn\'t pay, and they leave certain the post is theirs to lean on whenever they like.',
            outcomes: [
              { type: 'good', good: 'grain', delta: -18 },
              { type: 'silver', delta: -30 },
              { type: 'standing', faction: 'BEASTFOLK', delta: -6 },
              { type: 'stress', delta: 2 },
            ],
          },
        },
      },
    ],
  },
  {
    id: 'beastfolk_goblin_tribute',
    category: 'post',
    illustration: 'goblin_demand',
    title: 'The Clan at the Gate',
    text: 'A goblin clan-mother arrives with a handful of her sisters and a wagon to fill — cloth, tools, salt, whatever the post can spare, in exchange for a promise to trouble you no further this year. She is patient, businesslike, and utterly unbothered by the guards watching her from the wall. {hero} is left to haggle over what "no further trouble" is actually worth.',
    conditions: [{ type: 'standingAtMost', faction: 'BEASTFOLK', value: -20 }],
    weight: 10,
    cooldownTurns: 6,
    binding: { type: 'highestSkill', skill: 'bargain' },
    choices: [
      {
        label: 'Fill the wagon — it is cheaper than a grudge.',
        outcomes: {
          success: {
            text: '{hero} loads the wagon without ceremony. The clan-mother counts the goods with a practiced eye, nods once, and leads her sisters off satisfied. It costs, but it costs less than finding out what "further trouble" means.',
            outcomes: [
              { type: 'good', good: 'cloth', delta: -6 },
              { type: 'good', good: 'tools', delta: -3 },
              { type: 'standing', faction: 'BEASTFOLK', delta: 2 },
              { type: 'history', text: 'Paid a goblin clan to keep the peace.' },
            ],
          },
        },
      },
      {
        label: 'Haggle her down to a fraction of what she asked.',
        check: { skill: 'bargain', stat: 'charm', difficulty: 10, tags: ['BEASTFOLK'] },
        outcomes: {
          critSuccess: {
            text: 'The clan-mother laughs outright at {hero}\'s counter-offer — and then, to everyone\'s surprise, accepts something close to it. "You bargain like one of us," she says, which is either a compliment or a warning. Possibly both.',
            outcomes: [
              { type: 'good', good: 'cloth', delta: -1 },
              { type: 'standing', faction: 'BEASTFOLK', delta: 3 },
              { type: 'history', text: 'Out-haggled a goblin clan-mother and earned her respect.' },
            ],
          },
          success: {
            text: '{hero} talks the price down to something the storehouse won\'t miss. The clan-mother grumbles but takes the deal — a fair trade, by her own lights.',
            outcomes: [
              { type: 'good', good: 'cloth', delta: -2 },
              { type: 'standing', faction: 'BEASTFOLK', delta: 1 },
            ],
          },
          failure: {
            text: 'She doesn\'t bargain so much as wait {hero} out, and it works. The wagon leaves fuller than it needed to, and the lesson — that this post can be talked into more than it meant to give — is the real price paid.',
            outcomes: [
              { type: 'good', good: 'cloth', delta: -9 },
              { type: 'good', good: 'tools', delta: -4 },
              { type: 'standing', faction: 'BEASTFOLK', delta: -2 },
            ],
          },
          critFailure: {
            text: 'The haggling turns sour; the clan-mother decides {hero} has been wasting her time and helps herself to a good deal more on the way out, calling it interest.',
            outcomes: [
              { type: 'good', good: 'cloth', delta: -14 },
              { type: 'good', good: 'tools', delta: -6 },
              { type: 'silver', delta: -10 },
              { type: 'standing', faction: 'BEASTFOLK', delta: -4 },
            ],
          },
        },
      },
    ],
  },
  {
    id: 'beastfolk_orc_match',
    category: 'post',
    illustration: 'orc_arrival',
    title: 'One Who Chose to Come',
    text: 'She walks in alone, unarmed, and asks for {hero} by the reputation the wilds have given him — steady, fair, worth the risk. No war-band sent her and no elder blessed the errand; among her own kind there is no one left to spare, and she has decided the post is a better wager than waiting. She will not ask twice, and she will not be talked into leaving disappointed without an answer either way.',
    conditions: [
      { type: 'standingAtLeast', faction: 'BEASTFOLK', value: 10 },
      { type: 'heroUnmarried' },
    ],
    weight: 8,
    once: true,
    cooldownTurns: 8,
    binding: { type: 'highestStat', stat: 'charm' },
    choices: [
      {
        label: 'Welcome her into the household.',
        outcomes: {
          success: {
            text: 'There is no ceremony the Company would recognize — only her word and {hero}\'s, and a household that has grown by one. Word of it will reach the war-bands eventually, and reach them as proof the post keeps its bargains.',
            outcomes: [
              { type: 'formUnion', source: 'alliance', heritage: 'orc' },
              { type: 'standing', faction: 'BEASTFOLK', delta: 8 },
              { type: 'addTrait', trait: 'wed_orc' },
              { type: 'history', text: 'Wed an orc woman who chose the post over her own kind\'s odds.' },
            ],
          },
        },
      },
      {
        label: 'Turn her away — this is not a bond you are ready to make.',
        outcomes: {
          success: {
            text: 'She takes the refusal the way she takes most things — without argument, and without forgetting it. She leaves the way she came, and does not come back.',
            outcomes: [{ type: 'standing', faction: 'BEASTFOLK', delta: -3 }],
          },
        },
      },
    ],
  },
  {
    id: 'beastfolk_goblin_match',
    category: 'post',
    illustration: 'goblin_arrival',
    title: 'A Bargain of Her Own Making',
    text: 'She has clearly rehearsed this — a goblin, young by the look of her, who has slipped away from her clan on the strength of a rumor that {hero} is unwed and worth the gamble. She names no price and no clan; this errand is entirely her own, and if it fails she will simply go home and say nothing happened. She is watching {hero} more closely than she is letting on.',
    conditions: [
      { type: 'standingAtLeast', faction: 'BEASTFOLK', value: 10 },
      { type: 'heroUnmarried' },
    ],
    weight: 8,
    once: true,
    cooldownTurns: 8,
    binding: { type: 'lowestSkill', skill: 'diplomacy' },
    choices: [
      {
        label: 'Take the wager she is offering.',
        outcomes: {
          success: {
            text: 'It is a quiet thing, decided over an evening rather than declared — but decided all the same. She settles into the household like someone who has been planning this longer than {hero} has been aware of her.',
            outcomes: [
              { type: 'formUnion', source: 'alliance', heritage: 'goblin' },
              { type: 'standing', faction: 'BEASTFOLK', delta: 8 },
              { type: 'addTrait', trait: 'wed_goblin' },
              { type: 'history', text: 'Wed a goblin who slipped her clan on a rumor and a gamble.' },
            ],
          },
        },
      },
      {
        label: 'Send her home — kindly, but plainly.',
        outcomes: {
          success: {
            text: '{hero} says no as gently as it can be said. She takes it better than expected, shrugs, and disappears back the way she came before anyone else at the post even notices she was here.',
            outcomes: [{ type: 'standing', faction: 'BEASTFOLK', delta: -3 }],
          },
        },
      },
    ],
  },
  {
    id: 'beastfolk_settlement',
    category: 'post',
    illustration: 'beastfolk_settlers',
    title: 'A Band Asks to Stay',
    text: 'A dozen or so orcs and goblins arrive together, travel-worn, and ask through {hero} for a place inside the palisade rather than beyond it — tired, they say, of a life spent taking what a season\'s luck won\'t give freely. They offer their spears for the post\'s defense in exchange for a roof and a stake in what you\'re building. No war-band or clan will vouch for them; they vouch only for themselves.',
    conditions: [{ type: 'standingAtLeast', faction: 'BEASTFOLK', value: 25 }],
    weight: 6,
    cooldownTurns: 12,
    binding: { type: 'highestSkill', skill: 'leadership' },
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
];
