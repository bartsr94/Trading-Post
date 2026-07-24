// Beastfolk — Orcs & Goblins (BEASTFOLK_SPEC.md). Two arcs on the BEASTFOLK
// standing track: low standing brings demand/tribute pressure (never a raid —
// that stays a deliberately separate, not-yet-built system, spec §1); high
// standing opens a voluntary path, since neither people has a chief who can be
// courted the traditional way — individuals approach the post themselves.
// Tone per CLAUDE.md: second person, terse, 60–120 words, choices as intentions.
//
// Orc/goblin peoples are new, game-specific lore being actively built out —
// not yet consolidated into docs/lore/, so these events intentionally carry
// no `loreRef` (nothing to point at yet). Confirmed with Bartosz 2026-07-24:
// the naming overlap with docs/lore/World of Palusteria.md's unrelated
// "Beastfolk" (the Al'Rakasha hybrid races) is fine as-is, and beast_wilds
// sitting inside the Ashmark.md/Western Nomadic Tribes.md Hanjoda/Cult
// region is not a conflict to resolve. Add a `loreRef` here once this
// worldbuilding gets written down properly.

import type { GameEvent } from '../../engine/events/types';

export const BEASTFOLK_EVENTS: GameEvent[] = [
  {
    id: 'beastfolk_orc_tribute',
    category: 'post',
    illustration: 'orc_demand',
    title: 'A Price for Peace',
    text: 'An orc war-band camps in plain sight beyond bowshot — not hiding, not attacking, just waiting to be noticed. Their spokeswoman walks in alone at midday and names a price: grain and silver, paid now, for a season left in peace. {hero} is the one who has to answer her, with the whole camp watching to see whether the post pays like it understands the wilds, or has to be taught.',
    conditions: [
      { type: 'locationDiscovery', location: 'beast_wilds', atLeast: 'visited' },
      { type: 'standingAtMost', faction: 'BEASTFOLK', value: -20 },
    ],
    weight: 10,
    cooldownTurns: 6,
    binding: { type: 'highestStat', stat: 'resolve' },
    factions: ['BEASTFOLK'],
    peoples: ['orc'],
    choices: [
      {
        label: 'Pay what she asks — buy this season\'s quiet.',
        outcomes: {
          success: {
            text: 'You count it out yourself, in the open, and make the bargain plain: this season’s due in exchange for a season’s peace. She takes it without thanks, but with understanding. So long as the due keeps coming, her band will leave the post alone.',
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
        label: 'Send {hero} to face her down and refuse.',
        check: { skill: 'leadership', stat: 'resolve', difficulty: 11, tags: ['BEASTFOLK'] },
        outcomes: {
          critSuccess: {
            text: '{hero} doesn\'t flinch, doesn\'t reach for a weapon, simply says no in a voice that ends the conversation. The spokeswoman studies {hero} a long moment — then laughs, once, and walks her band off without a backward look. That kind of nerve, it turns out, is its own currency here.',
            outcomes: [
              { type: 'standing', faction: 'BEASTFOLK', delta: 3 },
              { type: 'history', text: 'Refused an orc war-band\'s demand and won their grudging respect.' },
            ],
          },
          success: {
            text: '{hero} holds the line. The spokeswoman spits, mutters something uncomplimentary, and the camp breaks by evening — nothing taken, nothing given.',
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
      { type: 'locationDiscovery', location: 'goblin_wilds', atLeast: 'visited' },
      { type: 'standingAtMost', faction: 'BEASTFOLK', value: -20 },
    ],
    weight: 10,
    cooldownTurns: 6,
    binding: { type: 'highestSkill', skill: 'bargain' },
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
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
    text: 'She walks in alone, unarmed, and asks for {hero} by the reputation the wilds have given {him} — steady, fair, worth the risk. No war-band sent her and no elder blessed the errand; among her own kind there is no one left to spare, and she has decided the post is a better wager than waiting. She will not ask twice, and she will not be talked into leaving disappointed without an answer either way.',
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
    factions: ['BEASTFOLK'],
    peoples: ['orc'],
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
      { type: 'locationDiscovery', location: 'goblin_wilds', atLeast: 'visited' },
      { type: 'standingAtLeast', faction: 'BEASTFOLK', value: 10 },
      { type: 'heroUnmarried' },
      { type: 'heroGender', gender: 'male' },
    ],
    weight: 8,
    once: true,
    cooldownTurns: 8,
    binding: { type: 'lowestSkill', skill: 'diplomacy' },
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
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
      { type: 'locationDiscoveryAny', locations: ['beast_wilds', 'goblin_wilds'], atLeast: 'visited' },
      { type: 'standingAtLeast', faction: 'BEASTFOLK', value: 25 },
    ],
    weight: 6,
    cooldownTurns: 12,
    binding: { type: 'highestSkill', skill: 'leadership' },
    factions: ['BEASTFOLK'],
    peoples: ['orc', 'goblin'],
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
    cooldownTurns: 12,
    binding: { type: 'highestSkill', skill: 'leadership' },
    factions: ['BEASTFOLK'],
    peoples: ['orc', 'goblin'],
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
    conditions: [
      { type: 'locationDiscoveryAny', locations: ['beast_wilds', 'goblin_wilds'], atLeast: 'visited' },
    ],
    weight: 7,
    once: true,
    binding: { type: 'highestStat', stat: 'resolve' },
    factions: ['BEASTFOLK'],
    peoples: ['orc', 'goblin'],
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
            text: 'Something in {hero}\'s tone or timing goes wrong, and the goodwill drains out of the moment fast. The patrol closes ranks, spears no longer quite so low — but they still, grudgingly, lead {hero} toward the camp instead of driving {him} off.',
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
            text: '{hero} holds ground and holds it well. The patrol studies {him} a long moment, weighing the risk of a fight against whatever they came here to do — then falls back half a step and gestures {him} toward the camp.',
            outcomes: [
              { type: 'setChainVar', key: 'approach', value: 'force' },
              { type: 'continueChain', eventId: 'beastfolk_first_encounter_talks' },
            ],
          },
          failure: {
            text: 'The standoff runs longer than it should, and it\'s {hero} who breaks first, not by choice — a shoved shoulder, a scraped forearm, nothing worse. The patrol seems almost amused. They lead {him} on anyway.',
            outcomes: [
              { type: 'setChainVar', key: 'approach', value: 'force' },
              { type: 'health', delta: -2 },
              { type: 'continueChain', eventId: 'beastfolk_first_encounter_talks' },
            ],
          },
          critFailure: {
            text: 'It goes physical fast, and badly — {hero} comes out of it bruised and short of breath, and the lesson the patrol takes isn\'t the one intended. They march {him} toward the camp less as an equal than as a catch.',
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
            text: '{hero} backs away slow and empty-handed, and the patrol lets {him} go without a word — watching until the treeline swallows {him} again. Whatever this was, it\'s over before it started.',
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
    factions: ['BEASTFOLK'],
    peoples: ['orc', 'goblin'],
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
            text: '{hero} offers what little {he}\'s carrying — not much, but freely given — and says nothing more. She turns it over in her hands, unreadable, and finally sets it aside. "Go on, then. We\'ll remember the gesture, at least."',
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
    factions: ['BEASTFOLK'],
    peoples: ['orc', 'goblin'],
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
            text: 'The parting was cold and it stays cold. No violence comes of it, but no warmth either — the wilds will remember {hero}\'s tone longer than they remember {his} words.',
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
  // --- Integration friction: settling under the same roof doesn't end the
  // arc beastfolk_settlement/_workers starts, it opens one (see
  // ResidentState.friction, TUNING.residents.friction). Mirrored per
  // heritage rather than an OR-condition, matching the existing
  // orc/goblin-pair convention above.
  {
    id: 'beastfolk_integration_orc',
    category: 'post',
    illustration: 'beastfolk_friction',
    title: 'Not Yet One of Us',
    text: 'The orcs who took the post\'s roof over their heads are pulling their weight well enough, but the grumbling hasn\'t stopped — a missing tool blamed on them before it turns up misplaced, a joke that lands wrong, old residents who still cross the yard to avoid walking past them. {hero} keeps hearing about it secondhand, which usually means it\'s worse than what gets said aloud.',
    conditions: [
      { type: 'residentTagAtLeast', tag: 'orc', value: 1 },
      { type: 'frictionAtLeast', heritage: 'orc', value: 4 },
    ],
    weight: 8,
    cooldownTurns: 5,
    binding: { type: 'highestSkill', skill: 'leadership' },
    factions: ['BEASTFOLK'],
    peoples: ['orc'],
    choices: [
      {
        label: 'Sit both sides down and clear the air.',
        check: { skill: 'leadership', stat: 'resolve', difficulty: 10, tags: ['BEASTFOLK', 'diplomacy'] },
        outcomes: {
          critSuccess: {
            text: '{hero} doesn\'t lecture anyone — just makes both sides say their piece in front of each other, then makes them agree on one thing before they leave. It\'s a small thing, but it\'s the first small thing that\'s gone right between them.',
            outcomes: [
              { type: 'friction', heritage: 'orc', delta: -5 },
              { type: 'contentment', delta: 1 },
              { type: 'history', text: 'Talked down a flare-up between residents and the post\'s orcs.' },
            ],
          },
          success: {
            text: 'It\'s an awkward hour, but {hero} keeps both sides talking instead of stewing, and something eases, a little.',
            outcomes: [{ type: 'friction', heritage: 'orc', delta: -3 }],
          },
          failure: {
            text: 'The conversation goes nowhere — both sides say their piece and neither one hears it. If anything, saying it out loud made the grudge more official.',
            outcomes: [
              { type: 'friction', heritage: 'orc', delta: 1 },
              { type: 'stress', delta: 1 },
            ],
          },
          critFailure: {
            text: '{hero} says the wrong thing to the wrong person, and what was grumbling becomes a shouting match half the post overhears. Nobody comes out of this looking reasonable.',
            outcomes: [
              { type: 'friction', heritage: 'orc', delta: 2 },
              { type: 'contentment', delta: -1 },
            ],
          },
        },
      },
      {
        label: 'Let them work it out themselves.',
        outcomes: {
          success: {
            text: '{hero} decides this isn\'t worth spending authority on yet. Whether that\'s wisdom or just avoidance, the grumbling doesn\'t go anywhere on its own.',
            outcomes: [{ type: 'friction', heritage: 'orc', delta: 1 }],
          },
        },
      },
    ],
  },
  {
    id: 'beastfolk_integration_goblin',
    category: 'post',
    illustration: 'beastfolk_friction',
    title: 'Sticky Fingers, Sharp Tongues',
    text: 'The goblins who took the post up on its offer are quick, useful, and a little too quick with their hands for some residents\' comfort — a coin gone missing here, a joke made at someone\'s expense there, nothing anyone can prove and everyone half-believes anyway. {hero} is starting to hear "you can\'t trust them" more than the goblins\' actual work deserves.',
    conditions: [
      { type: 'residentTagAtLeast', tag: 'goblin', value: 1 },
      { type: 'frictionAtLeast', heritage: 'goblin', value: 4 },
    ],
    weight: 8,
    cooldownTurns: 5,
    binding: { type: 'highestSkill', skill: 'diplomacy' },
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    choices: [
      {
        label: 'Get ahead of the rumors and set the record straight.',
        check: { skill: 'diplomacy', stat: 'charm', difficulty: 10, tags: ['BEASTFOLK', 'diplomacy'] },
        outcomes: {
          critSuccess: {
            text: '{hero} runs down what actually happened in each case — mostly nothing, once — and says so plainly enough that even the sourest gossip has to concede the point. It doesn\'t make anyone friends, but it starves the rumor mill for a while.',
            outcomes: [
              { type: 'friction', heritage: 'goblin', delta: -5 },
              { type: 'contentment', delta: 1 },
              { type: 'history', text: 'Talked down suspicion between residents and the post\'s goblins.' },
            ],
          },
          success: {
            text: '{hero} makes the rounds and pours a little cold water on the loudest complaints. Not everyone\'s convinced, but the grumbling quiets some.',
            outcomes: [{ type: 'friction', heritage: 'goblin', delta: -3 }],
          },
          failure: {
            text: 'The rounds don\'t land — half the post hears "the goblins again" and decides {hero} is just making excuses for them.',
            outcomes: [
              { type: 'friction', heritage: 'goblin', delta: 1 },
              { type: 'stress', delta: 1 },
            ],
          },
          critFailure: {
            text: 'Somehow defending them makes it worse — now it looks like {hero} is covering for them, and the whispering picks up rather than stops.',
            outcomes: [
              { type: 'friction', heritage: 'goblin', delta: 2 },
              { type: 'contentment', delta: -1 },
            ],
          },
        },
      },
      {
        label: 'Ignore it — gossip burns itself out eventually.',
        outcomes: {
          success: {
            text: 'Maybe it does, someday. Today it just keeps smoldering, unaddressed.',
            outcomes: [{ type: 'friction', heritage: 'goblin', delta: 1 }],
          },
        },
      },
    ],
  },
  {
    id: 'beastfolk_integration_settled_orc',
    category: 'post',
    illustration: 'beastfolk_settled',
    title: 'One of the Wall, Now',
    text: 'Nobody announces it. It just becomes true one ordinary evening: an orc guardswoman passes a joke to a homeland-born farmer at the well, and it lands the way jokes are supposed to — nobody flinches, nobody watches to see how it\'s taken. Whatever the post was arguing about before, it has quietly stopped.',
    conditions: [
      { type: 'residentTagAtLeast', tag: 'orc', value: 1 },
      { type: 'frictionAtMost', heritage: 'orc', value: 2 },
    ],
    weight: 6,
    once: true,
    binding: { type: 'highestStat', stat: 'charm' },
    factions: ['BEASTFOLK'],
    peoples: ['orc'],
    choices: [
      {
        label: 'Good. Let it stand.',
        outcomes: {
          success: {
            text: 'The post is a little more itself for it — one less line dividing who belongs and who\'s merely tolerated.',
            outcomes: [
              { type: 'standing', faction: 'BEASTFOLK', delta: 2 },
              { type: 'contentment', delta: 1 },
              { type: 'history', text: 'The post\'s orc residents finished settling in, grudge-free.' },
            ],
          },
        },
      },
    ],
  },
  {
    id: 'beastfolk_integration_settled_goblin',
    category: 'post',
    illustration: 'beastfolk_settled',
    title: 'Counted Among the Post\'s Own',
    text: 'It happens without ceremony, the way these things do: someone leaves a goblin porter in charge of the storeroom key overnight, and nobody thinks twice about it until afterward, when {hero} realizes that a season ago that would have been unthinkable. The suspicion has simply worn away.',
    conditions: [
      { type: 'residentTagAtLeast', tag: 'goblin', value: 1 },
      { type: 'frictionAtMost', heritage: 'goblin', value: 2 },
    ],
    weight: 6,
    once: true,
    binding: { type: 'highestStat', stat: 'charm' },
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    choices: [
      {
        label: 'Good. Let it stand.',
        outcomes: {
          success: {
            text: 'The post is a little more itself for it — one less line dividing who belongs and who\'s merely tolerated.',
            outcomes: [
              { type: 'standing', faction: 'BEASTFOLK', delta: 2 },
              { type: 'contentment', delta: 1 },
              { type: 'history', text: 'The post\'s goblin residents finished settling in, grudge-free.' },
            ],
          },
        },
      },
    ],
  },
  // --- General mischief: a lower-stakes, more frequent tier of friction than
  // the standing-gated tribute events above — the wilds testing the post
  // whether or not there's an active grievance to justify it.
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
    cooldownTurns: 5,
    binding: { type: 'highestSkill', skill: 'survival' },
    factions: ['BEASTFOLK'],
    peoples: ['orc', 'goblin'],
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
    cooldownTurns: 4,
    binding: { type: 'highestSkill', skill: 'stealth' },
    factions: ['BEASTFOLK'],
    peoples: ['orc', 'goblin'],
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
    text: 'A young orc plants herself just outside bowshot and shouts a challenge across the open ground — a wrestle, a footrace, whatever passes for sport out here — naming {hero} by whatever name the wilds have given {him}. It\'s bravado more than threat, the kind of thing her own people will talk about for a season regardless of who wins. Ignoring her is an option. Staying ignored is not, for her.',
    conditions: [{ type: 'locationDiscovery', location: 'beast_wilds', atLeast: 'visited' }],
    weight: 6,
    cooldownTurns: 6,
    binding: { type: 'highestStat', stat: 'might' },
    factions: ['BEASTFOLK'],
    peoples: ['orc'],
    choices: [
      {
        label: 'Take the dare.',
        check: { skill: 'combat', stat: 'might', difficulty: 10, tags: ['BEASTFOLK'] },
        outcomes: {
          critSuccess: {
            text: '{hero} puts her down hard enough to draw a laugh out of her own war-band, and the story that travels back to the wilds does the post more good than a season of careful diplomacy.',
            outcomes: [
              { type: 'standing', faction: 'BEASTFOLK', delta: 3 },
              { type: 'history', text: 'Won a shouted challenge from an orc youth and earned the wilds\' attention.' },
            ],
          },
          success: {
            text: 'It\'s close and it\'s ugly and {hero} wins anyway, which is apparently all that matters. The orc claps {him} on the shoulder like they\'re old friends and wanders off satisfied.',
            outcomes: [{ type: 'standing', faction: 'BEASTFOLK', delta: 1 }],
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
    cooldownTurns: 10,
    binding: { type: 'highestStat', stat: 'charm' },
    factions: ['BEASTFOLK'],
    peoples: ['orc', 'goblin'],
    choices: [
      {
        label: 'Let them look — a post with nothing to hide has nothing to fear.',
        outcomes: {
          success: {
            text: '{hero} tells the guards to stand easy and let the visitors wander. Whatever they came here to decide, they\'ll decide it with better information than rumor gives them.',
            outcomes: [
              { type: 'addTransient', kind: 'beastfolkVisitors', count: 4, turns: 6 },
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
