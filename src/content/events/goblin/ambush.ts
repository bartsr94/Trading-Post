// Goblin ambush — a travel encounter gated on a persistent per-hero counter
// (TRAVEL_AMBUSH_SPEC.md) rather than a single event's tiered outcomes: the
// check itself ("Watch the treeline") is identical in all three variants,
// but which of these three mutually-exclusive events is even eligible
// depends on how many times *this specific hero* has already failed it
// (`heroCounterAtMost`/`heroCounterAtLeast` on the counter key
// 'goblin_ambush_fails'). Only the check's failure/critFailure increments
// the counter — taking the no-check "push on" alternative isn't "failing to
// improve," it's not trying, so it never feeds the escalation. See
// ./index.ts for shared context.
//
// GOBLIN_AMBUSH_REACTION_SPEC.md: spotting the ambush (critSuccess/success
// on "Watch the treeline") no longer auto-resolves — it hands off via
// `continueChain` into a `_react` companion (one per escalation tier) where
// the player picks Mean (extort them, own intimidation check, scaling
// silver/goods vs. standing loss by roll), Neutral (today's walk-on
// behavior, unchanged), or Nice (spring the joke back on them, flat
// standing gain, no loot). Only a *failed* spot still feeds
// AMBUSH_COUNTER_KEY — none of the three reactions touch it, since by
// definition you only reach them after succeeding at the spot check.

import type { GameEvent } from '../../../engine/events/types';

const AMBUSH_COUNTER_KEY = 'goblin_ambush_fails';

export const GOBLIN_AMBUSH_EVENTS: GameEvent[] = [
  {
    id: 'travel_goblin_ambush',
    category: 'travel',
    illustration: 'goblin_mischief',
    title: 'Something in the Brush',
    text: 'The scrub goes quiet in a way that live scrub never quite manages, and a snare-line of braided vine sags across the trail just ahead — new, and badly hidden. Goblins, going by the giggling nobody has quite suppressed. {hero} slows, the way you do when the ground itself seems to be waiting for something.',
    conditions: [
      { type: 'destinationTag', tag: 'goblin' },
      { type: 'heroCounterAtMost', key: AMBUSH_COUNTER_KEY, value: 0 },
    ],
    weight: 10,
    cooldownTurns: 4,
    binding: { type: 'random' },
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    arc: 'goblin_ambush',
    choices: [
      {
        label: 'Watch the treeline as you walk.',
        check: { skill: 'survival', stat: 'wits', difficulty: 9, tags: ['BEASTFOLK'] },
        outcomes: {
          critSuccess: {
            text: '{hero} clocks the snare, the lookout, and the second lookout pretending to be a stump, all before the trap is even sprung. The giggling stops dead — whatever happens to this ambush now is entirely {hero}\'s call.',
            outcomes: [{ type: 'continueChain', eventId: 'travel_goblin_ambush_react' }],
          },
          success: {
            text: '{hero} sidesteps the snare a stride before it matters, and the goblins who meant to rush out of the brush instead have to stand up out of it, caught looking foolish rather than fearsome. Beaten at their own game, they wait to see what {hero} does about it.',
            outcomes: [{ type: 'continueChain', eventId: 'travel_goblin_ambush_react' }],
          },
          failure: {
            text: 'The snare finds a foot after all. By the time {hero} is back upright, small quick hands have already been through pockets, under clothes, and everywhere else they could reach. The goblins vanish into the scrub hooting, leaving {him} lighter in coin, cloth, and dignity.',
            outcomes: [
              { type: 'expeditionSilver', delta: -12 },
              { type: 'cargo', good: 'cloth', delta: -2 },
              { type: 'stress', delta: 1 },
              { type: 'heroCounter', key: AMBUSH_COUNTER_KEY, delta: 1 },
            ],
          },
          critFailure: {
            text: 'The snare drops {hero} flat. What follows is less a robbery than a thorough, gleeful ransacking — cargo, coin, and a great deal of personal attention from eager little hands and mouths while {hero} is still working out which way is up. They finally scramble off into the brush, giggling and satisfied.',
            outcomes: [
              { type: 'expeditionSilver', delta: -20 },
              { type: 'cargo', good: 'cloth', delta: -4 },
              { type: 'health', delta: -1 },
              { type: 'stress', delta: 2 },
              { type: 'heroCounter', key: AMBUSH_COUNTER_KEY, delta: 1 },
            ],
          },
        },
      },
      {
        label: 'Push on and pretend not to notice.',
        outcomes: {
          success: {
            text: 'Not noticing turns out to be exactly what the snare was counting on. The toll is quick — a few coins, a bit of cloth, and a couple of bold gropes — almost polite by goblin standards, and the party is moving again before the giggling even properly starts.',
            outcomes: [
              { type: 'expeditionSilver', delta: -8 },
              { type: 'cargo', good: 'cloth', delta: -1 },
            ],
          },
        },
      },
    ],
  },
  {
    id: 'travel_goblin_ambush_again',
    category: 'travel',
    illustration: 'goblin_encounter_01',
    title: 'The Same Trick Twice',
    text: 'Same stretch of scrub, same badly-hidden snare — and this time the giggling has names in it. "{hero}! {hero} again!" A goblin is actually keeping score on a stick. Whatever dignity survived the first time is not going to survive this one; they are delighted to see {hero}, and delight is not a good sign here.',
    conditions: [
      { type: 'destinationTag', tag: 'goblin' },
      { type: 'heroCounterAtLeast', key: AMBUSH_COUNTER_KEY, value: 1 },
      { type: 'heroCounterAtMost', key: AMBUSH_COUNTER_KEY, value: 3 },
    ],
    weight: 10,
    cooldownTurns: 4,
    binding: { type: 'random' },
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    arc: 'goblin_ambush',
    choices: [
      {
        label: 'Watch the treeline as you walk.',
        check: { skill: 'survival', stat: 'wits', difficulty: 9, tags: ['BEASTFOLK'] },
        outcomes: {
          critSuccess: {
            text: '{hero} finds the snare, the lookout, and the scorekeeper before any of them find {him}, and the look on their faces is worth almost as much as the toll they don\'t get to collect. The scoring-stick stays in a pocket, unmarked — for now, however {hero} decides to play it.',
            outcomes: [{ type: 'continueChain', eventId: 'travel_goblin_ambush_again_react' }],
          },
          success: {
            text: '{hero} spots it in time, barely, and the goblins have to settle for razzing {him} about how close it was. Caught fair and square this time, they wait — with obvious interest — to see how {hero} handles it.',
            outcomes: [{ type: 'continueChain', eventId: 'travel_goblin_ambush_again_react' }],
          },
          failure: {
            text: 'The snare works exactly as well as it did last time, which the goblins find hilarious. "Still doesn\'t look!" one shouts, delighted, while the rest empty pockets and take their time with the rest of {hero} — hands, mouths, and a great deal of enthusiastic commentary — before scrambling off with their prizes.',
            outcomes: [
              { type: 'expeditionSilver', delta: -14 },
              { type: 'cargo', good: 'cloth', delta: -2 },
              { type: 'stress', delta: 2 },
              { type: 'heroCounter', key: AMBUSH_COUNTER_KEY, delta: 1 },
            ],
          },
          critFailure: {
            text: 'The whole band turns out for this one — word travels fast when there\'s a favorite to enjoy. {hero} goes down hard and stays down while they take everything they want: coin, cargo, and a thorough, cheerful working-over that leaves {him} lighter in every sense, to genuine applause.',
            outcomes: [
              { type: 'expeditionSilver', delta: -22 },
              { type: 'cargo', good: 'cloth', delta: -4 },
              { type: 'health', delta: -1 },
              { type: 'stress', delta: 2 },
              { type: 'heroCounter', key: AMBUSH_COUNTER_KEY, delta: 1 },
            ],
          },
        },
      },
      {
        label: 'Push on and pretend not to notice.',
        outcomes: {
          success: {
            text: '"There {he} goes again," someone says, almost fondly, and the toll comes and goes with the easy familiarity of a running bit both sides know the shape of — a little silver, a little cloth, and a few familiar hands under the clothes before they wave the party on.',
            outcomes: [
              { type: 'expeditionSilver', delta: -8 },
              { type: 'cargo', good: 'cloth', delta: -1 },
            ],
          },
        },
      },
    ],
  },
  {
    id: 'travel_goblin_ambush_tired',
    category: 'travel',
    illustration: 'goblin_arrival',
    title: "Tired of the Game",
    text: 'The snare is barely hidden at all this time — nobody bothered. A dozen goblins sit around it in plain sight, arms crossed, and there is no giggling. "{hero} again," one says flatly, the way you\'d announce a chore that has quietly become a habit. This has stopped being a joke to them. They have decided they like having {him}.',
    conditions: [
      { type: 'destinationTag', tag: 'goblin' },
      { type: 'heroCounterAtLeast', key: AMBUSH_COUNTER_KEY, value: 4 },
    ],
    weight: 10,
    cooldownTurns: 4,
    binding: { type: 'random' },
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    arc: 'goblin_ambush',
    choices: [
      {
        label: 'Watch the treeline as you walk.',
        check: { skill: 'survival', stat: 'wits', difficulty: 9, tags: ['BEASTFOLK'] },
        outcomes: {
          critSuccess: {
            text: '{hero} sees it coming from a hundred paces off and simply walks the party around the whole sorry setup. The dozen goblins watch {him} go in total silence, waiting — like everyone else out here lately — to see what {hero} makes of them.',
            outcomes: [{ type: 'continueChain', eventId: 'travel_goblin_ambush_tired_react' }],
          },
          success: {
            text: '{hero} catches the snare just in time, and the goblins let the party pass without much fuss, a few of them already bracing for whatever {hero} decides to do about it.',
            outcomes: [{ type: 'continueChain', eventId: 'travel_goblin_ambush_tired_react' }],
          },
          failure: {
            text: 'Caught again, same as always — except this time nobody laughs. They take what they came for with brisk, businesslike hands and mouths, and one mutters that they\'re done making a show of it. Next time, they say, {hero} is coming home with them.',
            outcomes: [
              { type: 'expeditionSilver', delta: -16 },
              { type: 'cargo', good: 'cloth', delta: -2 },
              { type: 'stress', delta: 2 },
              { type: 'heroCounter', key: AMBUSH_COUNTER_KEY, delta: 1 },
            ],
          },
          critFailure: {
            text: '"Enough," someone says, and it isn\'t a joke anymore. This isn\'t a robbery. The goblins bind {hero}, unhurried and entirely serious, and carry {him} into the deep scrub before the rest of the party can do much more than shout. They\'ve grown to enjoy having their way with {him} regularly; now they\'re taking {him} home so they can do it every day.',
            outcomes: [
              { type: 'captureHero', faction: 'BEASTFOLK' },
              { type: 'heroCounter', key: AMBUSH_COUNTER_KEY, delta: 1 },
              {
                type: 'history',
                text: 'Fell for the same goblin ambush one time too many, and was carried off for it.',
              },
            ],
          },
        },
      },
      {
        label: 'Push on and pretend not to notice.',
        outcomes: {
          success: {
            text: 'Nobody so much as raises a voice this time. The toll is taken in near-total silence — silver, cloth, and a few last, lingering hands — businesslike and almost proprietary, and the party is waved on like a chore that\'s been dealt with for now.',
            outcomes: [
              { type: 'expeditionSilver', delta: -10 },
              { type: 'cargo', good: 'cloth', delta: -1 },
            ],
          },
        },
      },
    ],
  },
  {
    id: 'travel_goblin_ambush_react',
    category: 'chain',
    illustration: 'goblin_mischief',
    title: 'Your Move',
    text: 'The ambush lies in ruins around a handful of goblins who clearly hadn\'t planned past "spring the trap." {hero} has the upper hand entirely — the only question left is what to do with it.',
    conditions: [],
    weight: 0,
    binding: { type: 'random' },
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    arc: 'goblin_ambush',
    choices: [
      {
        label: 'Turn the tables — demand a toll of your own.',
        check: { skill: 'combat', stat: 'might', difficulty: 9, tags: ['intimidation', 'BEASTFOLK'] },
        outcomes: {
          critSuccess: {
            text: 'One hard look from {hero} and the fight goes out of them entirely — they empty their own pockets before {he}\'s even finished asking, eager to be anywhere else.',
            outcomes: [
              { type: 'expeditionSilver', delta: 10 },
              { type: 'cargo', good: 'cloth', delta: 2 },
              { type: 'standing', faction: 'BEASTFOLK', delta: -1 },
            ],
          },
          success: {
            text: '{hero} makes it plain who sprung whose trap. Grumbling, the goblins hand over a share of their own take rather than push their luck any further.',
            outcomes: [
              { type: 'expeditionSilver', delta: 6 },
              { type: 'cargo', good: 'cloth', delta: 1 },
              { type: 'standing', faction: 'BEASTFOLK', delta: -2 },
            ],
          },
          failure: {
            text: 'The goblins call {hero}\'s bluff and mean it, backing away with empty hands but full sneers. {hero} gets nothing for the trouble but their opinion of {him}, freely given.',
            outcomes: [
              { type: 'standing', faction: 'BEASTFOLK', delta: -3 },
              { type: 'stress', delta: 1 },
            ],
          },
          critFailure: {
            text: 'It lands as posturing, not threat, and the goblins know the difference — they scatter laughing, already turning the failed shakedown into a better story than the ambush ever was.',
            outcomes: [
              { type: 'standing', faction: 'BEASTFOLK', delta: -4 },
              { type: 'stress', delta: 1 },
            ],
          },
        },
      },
      {
        label: 'Leave them to it and walk on.',
        outcomes: {
          success: {
            text: 'Not worth the trouble. {hero} leaves them to untangle their own snare, and the party is well down the road before the goblins even finish arguing about whose fault it was.',
            outcomes: [
              { type: 'stress', delta: -1 },
              { type: 'history', text: 'Spotted a goblin ambush before it could spring.' },
            ],
          },
        },
      },
      {
        label: 'Spring it back on them — let them have the joke.',
        outcomes: {
          success: {
            text: '{hero} makes a show of "falling" for the snare anyway, tumbling theatrically into the very trap meant for {him}. The goblins, delighted past all reason, pile in to "finish the job" — only this time {hero} is very much in on it. What starts as a joke turns into a messy, enthusiastic tangle of limbs in the brush, the goblins taking turns and sharing {him} with the kind of greedy cheer they usually reserve for loot. By the time they scramble off, still giggling, both sides are thoroughly satisfied.',
            outcomes: [{ type: 'standing', faction: 'BEASTFOLK', delta: 2 }],
          },
        },
      },
    ],
  },
  {
    id: 'travel_goblin_ambush_again_react',
    category: 'chain',
    illustration: 'goblin_encounter_01',
    title: 'Your Move, Again',
    text: 'Caught fair and square for once, the scorekeeper and the rest of the band look almost giddy at the novelty of it — {hero} beating the game they thought they had figured out. They wait, delighted, to see what {he} does with the win.',
    conditions: [],
    weight: 0,
    binding: { type: 'random' },
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    arc: 'goblin_ambush',
    choices: [
      {
        label: 'Turn the tables — demand a toll of your own.',
        check: { skill: 'combat', stat: 'might', difficulty: 9, tags: ['intimidation', 'BEASTFOLK'] },
        outcomes: {
          critSuccess: {
            text: '{hero} doesn\'t even have to raise a voice — the band that knows {him} by name knows better than to test this. The scoring-stick and a fair bit besides changes hands without a fight.',
            outcomes: [
              { type: 'expeditionSilver', delta: 14 },
              { type: 'cargo', good: 'cloth', delta: 2 },
              { type: 'cargo', good: 'tools', delta: 1 },
              { type: 'standing', faction: 'BEASTFOLK', delta: -2 },
            ],
          },
          success: {
            text: 'Familiarity cuts both ways — the goblins know {hero} well enough by now to know when {he}\'s serious, and pay out grumbling but unresisting.',
            outcomes: [
              { type: 'expeditionSilver', delta: 9 },
              { type: 'cargo', good: 'cloth', delta: 1 },
              { type: 'standing', faction: 'BEASTFOLK', delta: -3 },
            ],
          },
          failure: {
            text: '"{hero}\'s bluffing," one of them announces to the rest, with the confidence of long acquaintance — and they\'re right. {he} gets nothing but a reputation for trying.',
            outcomes: [
              { type: 'standing', faction: 'BEASTFOLK', delta: -4 },
              { type: 'stress', delta: 1 },
            ],
          },
          critFailure: {
            text: 'They\'ve seen {hero} do everything else out here by now, and this doesn\'t impress them either — the whole band is laughing before {he}\'s even finished the demand.',
            outcomes: [
              { type: 'standing', faction: 'BEASTFOLK', delta: -5 },
              { type: 'stress', delta: 2 },
            ],
          },
        },
      },
      {
        label: 'Leave them to it and walk on.',
        outcomes: {
          success: {
            text: '{hero} doesn\'t dignify the rematch with a response, and walks on. Behind {him}, the argument over what went wrong starts before the party is even out of earshot.',
            outcomes: [
              { type: 'stress', delta: -1 },
              { type: 'history', text: 'Beat the goblins at their own repeat trick.' },
            ],
          },
        },
      },
      {
        label: 'Spring it back on them — let them have the joke.',
        outcomes: {
          success: {
            text: '{hero} plays the mark on purpose this time, and the band howls with laughter at getting to run their own trick after all. They don\'t just "collect the toll" — they take their time with {him}, hands and mouths and eager little bodies pressing in, treating the whole thing like a reunion they\'ve been looking forward to. {hero} gives as good as {he} gets, and by the end the scorekeeper is making a very different kind of mark on that stick. The goblins leave grinning, already talking about next time.',
            outcomes: [{ type: 'standing', faction: 'BEASTFOLK', delta: 3 }],
          },
        },
      },
    ],
  },
  {
    id: 'travel_goblin_ambush_tired_react',
    category: 'chain',
    illustration: 'goblin_arrival',
    title: 'Your Move, Once More',
    text: 'Caught at their own dead-serious version of the game, the whole band goes quiet — not sullen, exactly, just watching close. This has stopped being funny to them somewhere along the way, which makes whatever {hero} does next matter more than it used to.',
    conditions: [],
    weight: 0,
    binding: { type: 'random' },
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    arc: 'goblin_ambush',
    choices: [
      {
        label: 'Turn the tables — demand a toll of your own.',
        check: { skill: 'combat', stat: 'might', difficulty: 9, tags: ['intimidation', 'BEASTFOLK'] },
        outcomes: {
          critSuccess: {
            text: 'Nobody so much as reaches for a weapon. {hero} has clearly stopped being worth the risk to cross, and the goblins pay out fast and say nothing at all about it afterward.',
            outcomes: [
              { type: 'expeditionSilver', delta: 18 },
              { type: 'cargo', good: 'cloth', delta: 2 },
              { type: 'cargo', good: 'tools', delta: 1 },
              { type: 'standing', faction: 'BEASTFOLK', delta: -3 },
            ],
          },
          success: {
            text: '{hero} presses the advantage and it holds — the band pays out, sour about it, plainly filing the humiliation away for later rather than letting it go.',
            outcomes: [
              { type: 'expeditionSilver', delta: 12 },
              { type: 'cargo', good: 'cloth', delta: 1 },
              { type: 'standing', faction: 'BEASTFOLK', delta: -4 },
            ],
          },
          failure: {
            text: 'This band has stopped bluffing back and forth with {hero} a while ago, and they don\'t start now — they simply hold their ground until {he} runs out of things to threaten them with.',
            outcomes: [
              { type: 'standing', faction: 'BEASTFOLK', delta: -5 },
              { type: 'stress', delta: 1 },
            ],
          },
          critFailure: {
            text: 'It doesn\'t land as strength, not with this crowd, not anymore — it lands as exactly the kind of provocation they\'ve been braced for, and the mood curdles fast.',
            outcomes: [
              { type: 'standing', faction: 'BEASTFOLK', delta: -6 },
              { type: 'stress', delta: 2 },
            ],
          },
        },
      },
      {
        label: 'Leave them to it and walk on.',
        outcomes: {
          success: {
            text: '{hero} lets it go, same as the win deserves, and the band watches {him} out of sight in the same close silence they arrived in.',
            outcomes: [
              { type: 'stress', delta: -1 },
              { type: 'history', text: 'Finally outfoxed the goblins who\'d given up on the joke.' },
            ],
          },
        },
      },
      {
        label: 'Spring it back on them — let them have the joke.',
        outcomes: {
          success: {
            text: 'It\'s a risk, playing the fool for a crowd that\'s stopped laughing — but it works, and works better than {hero} expected. The old routine still means something to them. They don\'t just take the joke; they take {hero}, thoroughly and without hurry, the whole band using {him} the way they\'ve clearly been wanting to for a while now. {hero} leans into it, and for once the silence breaks into something almost affectionate. When they finally let {him} go, one of them mutters that maybe they don\'t need to take {him} home after all — not if {he} keeps coming back like this.',
            outcomes: [{ type: 'standing', faction: 'BEASTFOLK', delta: 4 }],
          },
        },
      },
    ],
  },
];