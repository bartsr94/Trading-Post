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
    conditions: [
      { type: 'locationDiscovery', location: 'beast_wilds', atLeast: 'visited' },
      { type: 'standingAtMost', faction: 'BEASTFOLK', value: -20 },
    ],
    weight: 10,
    cooldownTurns: 6,
    binding: { type: 'highestStat', stat: 'resolve' },
    choices: [
      {
        label: 'Pay what he asks — buy this season\'s quiet.',
        outcomes: {
          success: {
            text: 'You count it out yourself, in the open, and make the bargain plain: this season’s due in exchange for a season’s peace. He takes it without thanks, but with understanding. So long as the due keeps coming, his band will leave the post alone.',
            outcomes: [
              { type: 'silver', delta: -25 },
              { type: 'good', good: 'grain', delta: -5 },
              { type: 'tribute', faction: 'BEASTFOLK', direction: 'pay', silver: 12, goods: { grain: 3 } },
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
    conditions: [
      { type: 'locationDiscovery', location: 'beast_wilds', atLeast: 'visited' },
      { type: 'standingAtMost', faction: 'BEASTFOLK', value: -20 },
    ],
    weight: 10,
    cooldownTurns: 6,
    binding: { type: 'highestSkill', skill: 'bargain' },
    choices: [
      {
        label: 'Fill the wagon — it is cheaper than a grudge.',
        outcomes: {
          success: {
            text: '{hero} loads the wagon without ceremony, and makes the understanding explicit: the wagon now, and a smaller due each season after, so long as the clan keeps its word. The clan-mother counts the goods with a practiced eye and agrees.',
            outcomes: [
              { type: 'good', good: 'cloth', delta: -6 },
              { type: 'good', good: 'tools', delta: -3 },
              { type: 'tribute', faction: 'BEASTFOLK', direction: 'pay', goods: { cloth: 2, tools: 1 } },
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
      { type: 'locationDiscovery', location: 'beast_wilds', atLeast: 'visited' },
      { type: 'standingAtLeast', faction: 'BEASTFOLK', value: 10 },
      { type: 'heroUnmarried' },
      { type: 'heroGender', gender: 'male' },
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
      { type: 'locationDiscovery', location: 'beast_wilds', atLeast: 'visited' },
      { type: 'standingAtLeast', faction: 'BEASTFOLK', value: 10 },
      { type: 'heroUnmarried' },
      { type: 'heroGender', gender: 'male' },
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
    conditions: [
      { type: 'locationDiscovery', location: 'beast_wilds', atLeast: 'visited' },
      { type: 'standingAtLeast', faction: 'BEASTFOLK', value: 25 },
    ],
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
  // "A Patrol at the Treeline" — a 3-stage same-sitting chain
  // (CHAIN_EVENTS_SPEC.md §5), the showcase for continueChain/chainVar.
  // Stage 1 is the only one drawn by the weighted pool; stages 2-3 are
  // category 'chain' (weight 0) and are only ever reached via continueChain,
  // so their own `conditions` are decorative (never re-checked at fire time
  // — same convention as the existing post_amber_find chain stage).
  {
    id: 'beastfolk_first_encounter',
    category: 'post',
    illustration: 'beastfolk_patrol',
    title: 'Eyes at the Treeline',
    text: 'The treeline breaks without warning: a mixed patrol, orc and goblin both, spears low but not raised, watching from twenty paces like they\'ve been watching longer than that. No war-band flag, no clan token — just eyes on {hero}, waiting to see what the post\'s people do with a moment like this. Whatever happens next, they\'ll carry the telling of it home.',
    conditions: [{ type: 'locationDiscovery', location: 'beast_wilds', atLeast: 'visited' }],
    weight: 7,
    once: true,
    binding: { type: 'highestStat', stat: 'resolve' },
    choices: [
      {
        label: 'Speak first — offer words, not weapons.',
        check: { skill: 'diplomacy', stat: 'charm', difficulty: 10, tags: ['diplomacy', 'strangers', 'BEASTFOLK'] },
        outcomes: {
          critSuccess: {
            text: '{hero} opens both hands and speaks slow, plain, unhurried — the oldest of the patrol lowers her spear first, and the rest follow half a beat later. It isn\'t trust yet, but it\'s the shape trust could take.',
            outcomes: [
              { type: 'setChainVar', key: 'approach', value: 'peace' },
              { type: 'standing', faction: 'BEASTFOLK', delta: 1 },
              { type: 'continueChain', eventId: 'beastfolk_first_encounter_talks' },
            ],
          },
          success: {
            text: '{hero}\'s words land somewhere short of welcome and short of trouble. The patrol doesn\'t lower its guard, but it doesn\'t press either — they gesture {hero} to follow, toward whoever back at the camp actually decides things.',
            outcomes: [
              { type: 'setChainVar', key: 'approach', value: 'peace' },
              { type: 'continueChain', eventId: 'beastfolk_first_encounter_talks' },
            ],
          },
          failure: {
            text: '{hero} talks, and the patrol listens with the particular patience of people who\'ve heard promises before. No blood spilled, but no ground gained either — they wave {hero} on toward the camp anyway, unconvinced.',
            outcomes: [
              { type: 'setChainVar', key: 'approach', value: 'peace' },
              { type: 'stress', delta: 1 },
              { type: 'continueChain', eventId: 'beastfolk_first_encounter_talks' },
            ],
          },
          critFailure: {
            text: 'Something in {hero}\'s tone or timing goes wrong, and the goodwill drains out of the moment fast. The patrol closes ranks, spears no longer quite so low — but they still, grudgingly, lead {hero} toward the camp instead of driving him off.',
            outcomes: [
              { type: 'setChainVar', key: 'approach', value: 'peace' },
              { type: 'standing', faction: 'BEASTFOLK', delta: -1 },
              { type: 'stress', delta: 1 },
              { type: 'continueChain', eventId: 'beastfolk_first_encounter_talks' },
            ],
          },
        },
      },
      {
        label: 'Show strength — plant your feet and don\'t move.',
        check: { skill: 'combat', stat: 'might', difficulty: 10, tags: ['intimidation', 'BEASTFOLK'] },
        outcomes: {
          critSuccess: {
            text: '{hero} doesn\'t reach for a weapon — doesn\'t need to. Something in the stillness reads as its own kind of threat, and the patrol\'s spears come up a fraction, then, unmistakably, ease back down. Respect, of a wary kind.',
            outcomes: [
              { type: 'setChainVar', key: 'approach', value: 'force' },
              { type: 'standing', faction: 'BEASTFOLK', delta: 1 },
              { type: 'continueChain', eventId: 'beastfolk_first_encounter_talks' },
            ],
          },
          success: {
            text: '{hero} holds ground and holds it well. The patrol studies him a long moment, weighing the risk of a fight against whatever they came here to do — then falls back half a step and gestures him toward the camp.',
            outcomes: [
              { type: 'setChainVar', key: 'approach', value: 'force' },
              { type: 'continueChain', eventId: 'beastfolk_first_encounter_talks' },
            ],
          },
          failure: {
            text: 'The standoff runs longer than it should, and it\'s {hero} who breaks first, not by choice — a shoved shoulder, a scraped forearm, nothing worse. The patrol seems almost amused. They lead him on anyway.',
            outcomes: [
              { type: 'setChainVar', key: 'approach', value: 'force' },
              { type: 'health', delta: -2 },
              { type: 'continueChain', eventId: 'beastfolk_first_encounter_talks' },
            ],
          },
          critFailure: {
            text: 'It goes physical fast, and badly — {hero} comes out of it bruised and short of breath, and the lesson the patrol takes isn\'t the one intended. They march him toward the camp less as an equal than as a catch.',
            outcomes: [
              { type: 'setChainVar', key: 'approach', value: 'force' },
              { type: 'health', delta: -4 },
              { type: 'stress', delta: 1 },
              { type: 'continueChain', eventId: 'beastfolk_first_encounter_talks' },
            ],
          },
        },
      },
      {
        label: 'Withdraw quietly — this isn\'t a fight worth having.',
        outcomes: {
          success: {
            text: '{hero} backs away slow and empty-handed, and the patrol lets him go without a word — watching until the treeline swallows him again. Whatever this was, it\'s over before it started.',
            outcomes: [
              {
                type: 'history',
                text: 'Backed away from an orc/goblin patrol at the treeline rather than risk a first meeting.',
              },
            ],
          },
        },
      },
    ],
  },
  {
    id: 'beastfolk_first_encounter_talks',
    category: 'chain',
    illustration: 'beastfolk_camp',
    title: 'Whoever Speaks for Them',
    text: 'The patrol brings {hero} in past the cook-fires to someone who wears no obvious mark of rank but is plainly the one they answer to. She doesn\'t waste time on ceremony. "You\'re here," she says. "So — why."',
    conditions: [],
    weight: 0,
    choices: [
      {
        label: 'Press for a lasting truce.',
        requires: [{ type: 'chainVar', key: 'approach', value: 'peace' }],
        check: { skill: 'diplomacy', stat: 'charm', difficulty: 12, tags: ['diplomacy', 'BEASTFOLK'] },
        outcomes: {
          success: {
            text: 'She hears {hero} out fully, weighing every word, and when she finally nods it\'s with the air of someone who has decided something larger than one conversation warranted. "Then we\'ll see if your post keeps its word better than the last one did."',
            outcomes: [
              { type: 'setChainVar', key: 'outcome', value: 'alliance' },
              { type: 'continueChain', eventId: 'beastfolk_first_encounter_close' },
            ],
          },
          failure: {
            text: 'She listens, but the offer doesn\'t move her the way {hero} hoped — too soon, too easy, too much like every other stranger who\'s promised more than they meant. "Words are cheap," she says. "Bring me something else next time."',
            outcomes: [
              { type: 'setChainVar', key: 'outcome', value: 'token' },
              { type: 'continueChain', eventId: 'beastfolk_first_encounter_close' },
            ],
          },
        },
      },
      {
        label: 'Demand they keep clear of the post\'s ground.',
        requires: [{ type: 'chainVar', key: 'approach', value: 'force' }],
        check: { skill: 'leadership', stat: 'resolve', difficulty: 12, tags: ['intimidation', 'BEASTFOLK'] },
        outcomes: {
          success: {
            text: '{hero} states the terms plainly and doesn\'t soften them. She weighs the demand against the patrol\'s report of what happened at the treeline, and something in her expression settles — not friendship, but a kind of respect for someone who doesn\'t waste her time.',
            outcomes: [
              { type: 'setChainVar', key: 'outcome', value: 'respect' },
              { type: 'continueChain', eventId: 'beastfolk_first_encounter_close' },
            ],
          },
          failure: {
            text: 'The demand doesn\'t land as strength — it lands as posturing, and she\'s clearly heard enough of that from enough people. "Careful," she says, not raising her voice at all, which is somehow worse. "That tone gets remembered."',
            outcomes: [
              { type: 'setChainVar', key: 'outcome', value: 'grudge' },
              { type: 'continueChain', eventId: 'beastfolk_first_encounter_close' },
            ],
          },
        },
      },
      {
        label: 'Leave a token of goodwill and go.',
        outcomes: {
          success: {
            text: '{hero} offers what little he\'s carrying — not much, but freely given — and says nothing more. She turns it over in her hands, unreadable, and finally sets it aside. "Go on, then. We\'ll remember the gesture, at least."',
            outcomes: [
              { type: 'setChainVar', key: 'outcome', value: 'token' },
              { type: 'continueChain', eventId: 'beastfolk_first_encounter_close' },
            ],
          },
        },
      },
    ],
  },
  {
    id: 'beastfolk_first_encounter_close',
    category: 'chain',
    illustration: 'beastfolk_parting',
    title: 'What Comes of It',
    text: '{hero} makes it back to the post with the whole conversation still turning over — the kind of first meeting that will color everything the wilds and the post are to each other from here.',
    conditions: [],
    weight: 0,
    choices: [
      {
        label: 'Seal it — send word back confirming the terms.',
        requires: [{ type: 'chainVar', key: 'outcome', value: 'alliance' }],
        outcomes: {
          success: {
            text: 'The messenger returns before the season\'s out: the terms hold, and with them a small gift, wrapped in leaf and cord, sent as much to test the post\'s manners as to please it.',
            outcomes: [
              { type: 'standing', faction: 'BEASTFOLK', delta: 6 },
              { type: 'tribute', faction: 'BEASTFOLK', direction: 'receive', goods: { hides: 2 } },
              {
                type: 'history',
                text: 'Struck a lasting understanding with an orc/goblin patrol at the treeline.',
              },
            ],
          },
        },
      },
      {
        label: 'Let the terms stand as given.',
        requires: [{ type: 'chainVar', key: 'outcome', value: 'respect' }],
        outcomes: {
          success: {
            text: 'Nothing more is said, and nothing more needs to be. The wilds hold to the line {hero} drew, and the post holds to its own — a cold sort of peace, but peace.',
            outcomes: [
              { type: 'standing', faction: 'BEASTFOLK', delta: 4 },
              {
                type: 'history',
                text: 'Won a wary respect from an orc/goblin patrol without striking a bargain.',
              },
            ],
          },
        },
      },
      {
        label: 'Let it lie — pressing further would only make it worse.',
        requires: [{ type: 'chainVar', key: 'outcome', value: 'grudge' }],
        outcomes: {
          success: {
            text: 'The parting was cold and it stays cold. No violence comes of it, but no warmth either — the wilds will remember {hero}\'s tone longer than they remember his words.',
            outcomes: [
              { type: 'standing', faction: 'BEASTFOLK', delta: -2 },
              {
                type: 'history',
                text: 'Left an orc/goblin patrol with a grudge after a tense first meeting.',
              },
            ],
          },
        },
      },
      {
        label: 'Consider the exchange complete.',
        requires: [{ type: 'chainVar', key: 'outcome', value: 'token' }],
        outcomes: {
          success: {
            text: 'The gift changes hands and the moment closes itself out — no promises made, none broken, just a small debt of courtesy paid in full.',
            outcomes: [
              { type: 'good', good: 'grain', delta: -3 },
              { type: 'standing', faction: 'BEASTFOLK', delta: 2 },
              { type: 'history', text: 'Traded a token gift with an orc/goblin patrol at first meeting.' },
            ],
          },
        },
      },
      {
        label: 'Let the whole thing end here.',
        outcomes: {
          success: {
            text: 'Whatever the wilds make of the encounter, the post hears nothing further of it — for now.',
            outcomes: [
              { type: 'standing', faction: 'BEASTFOLK', delta: 1 },
              {
                type: 'history',
                text: 'A first encounter with an orc/goblin patrol ended without further word either way.',
              },
            ],
          },
        },
      },
    ],
  },
];
