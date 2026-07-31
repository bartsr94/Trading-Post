// Goblin ambush: per-hero 'goblin_ambush_fails' counter 
// (only failed "Watch the treeline" increments) gates 3 exclusive tiers. 
// Success chains to _react (Mean/Neutral/Nice). Uses eventHelpers (text inline). 
// Opposite win counter ("Turn the tables") enables party-wide AMBUSH_TRUCE_FLAG 
// (disables ambushes, enables trade). _react share skeleton; entries unfactored 
// (tired critFail special).

import type { GameEvent, Outcome } from '../../../engine/events/types';
import { exclusiveTrait, makeChoiceEvent, outcome } from '../eventHelpers';

const AMBUSH_COUNTER_KEY = 'goblin_ambush_fails';
const AMBUSH_WINS_KEY = 'goblin_ambush_wins';
const AMBUSH_WINS_THRESHOLD = 4;
const AMBUSH_TRUCE_FLAG = 'goblin_ambush_truce';

// Goblin reputation axis (REPUTATION_TRAITS_SPEC.md) — three mutually
// exclusive traits earned off the same fails/wins counters above plus one
// new counter for the "spring it back"/Nice pick. `easy_target` reuses the
// existing fails>=4 tier below; the other two poles get their own
// low-weight travel events gated on their own threshold, same idiom as the
// tiers themselves.
const AMBUSH_KINDNESS_KEY = 'goblin_ambush_kindness';
const AMBUSH_FEARED_THRESHOLD = 3;
const AMBUSH_KINDNESS_THRESHOLD = 3;
const GOBLIN_REPUTATION_TRAITS = ['easy_target', 'goblin_shakedown_artist', 'friend_of_goblins'] as const;
const otherReputationTraits = (grant: (typeof GOBLIN_REPUTATION_TRAITS)[number]) =>
  GOBLIN_REPUTATION_TRAITS.filter((t) => t !== grant);

const AMBUSH_CONDITIONS = [{ type: 'destinationTag', tag: 'goblin' }, { type: 'notFlag', flag: AMBUSH_TRUCE_FLAG }] as const;

interface AmbushToll {
  text: string;
  silver: number;
  cloth: number;
  tools?: number;
  standing: number;
}
interface AmbushRebuff {
  text: string;
  standing: number;
  stress: number;
}

function makeAmbushReactionEvent(config: {
  id: string;
  illustration: string;
  title: string;
  text: string;
  turnTables: { critSuccess: AmbushToll; success: AmbushToll; failure: AmbushRebuff; critFailure: AmbushRebuff };
  leaveIt: { text: string; historyText: string };
  /** illustration defaults to 'goblin_tumble' — override once repeat
   *  encounters warrant their own art (e.g. the "_again_react" tier). */
  springBack: { text: string; standing: number; illustration?: string };
}): GameEvent {
  const tollOutcomes = (tier: AmbushToll): Outcome[] => {
    const outcomes: Outcome[] = [outcome.expeditionSilver(tier.silver), outcome.cargo('cloth', tier.cloth)];
    if (tier.tools) outcomes.push(outcome.cargo('tools', tier.tools));
    outcomes.push(outcome.standing('BEASTFOLK', tier.standing), outcome.heroCounter(AMBUSH_WINS_KEY, 1));
    return outcomes;
  };
  const rebuffOutcomes = (tier: AmbushRebuff): Outcome[] => [
    outcome.standing('BEASTFOLK', tier.standing),
    outcome.stress(tier.stress),
  ];

  return makeChoiceEvent({
    id: config.id,
    illustration: config.illustration,
    title: config.title,
    text: config.text,
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    arc: 'goblin_ambush',
    choices: [
      {
        type: 'checked',
        label: 'Turn the tables — demand a toll of your own.',
        check: { skill: 'combat', stat: 'might', difficulty: 9, tags: ['intimidation', 'BEASTFOLK'] },
        illustration: 'goblin_shakedown',
        critSuccess: { text: config.turnTables.critSuccess.text, outcomes: tollOutcomes(config.turnTables.critSuccess) },
        success: { text: config.turnTables.success.text, outcomes: tollOutcomes(config.turnTables.success) },
        failure: { text: config.turnTables.failure.text, outcomes: rebuffOutcomes(config.turnTables.failure) },
        critFailure: { text: config.turnTables.critFailure.text, outcomes: rebuffOutcomes(config.turnTables.critFailure) },
      },
      {
        type: 'flat',
        label: 'Leave them to it and walk on.',
        text: config.leaveIt.text,
        illustration: 'goblin_standoff',
        outcomes: [outcome.stress(-1), outcome.history(config.leaveIt.historyText)],
      },
      {
        type: 'flat',
        label: 'Spring it back on them — let them have the joke.',
        text: config.springBack.text,
        illustration: config.springBack.illustration ?? 'goblin_tumble',
        outcomes: [
          outcome.standing('BEASTFOLK', config.springBack.standing),
          outcome.heroCounter(AMBUSH_KINDNESS_KEY, 1),
        ],
      },
    ],
  });
}

export const GOBLIN_AMBUSH_EVENTS: GameEvent[] = [
  makeChoiceEvent({
    id: 'travel_goblin_ambush',
    category: 'travel',
    illustration: 'goblin_mischief',
    title: 'Something in the Brush',
    text: 'The scrub goes quiet in a way that live scrub never quite manages, and a snare-line of braided vine sags across the trail just ahead — new, and badly hidden. Goblins, going by the giggling nobody has quite suppressed. {hero} slows, the way you do when the ground itself seems to be waiting for something.',
    conditions: [...AMBUSH_CONDITIONS, { type: 'heroCounterAtMost', key: AMBUSH_COUNTER_KEY, value: 0 }],
    weight: 10,
    cooldownTurns: 4,
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    arc: 'goblin_ambush',
    choices: [
      {
        type: 'checked',
        label: 'Watch the treeline as you walk.',
        check: { skill: 'survival', stat: 'wits', difficulty: 9, tags: ['BEASTFOLK'] },
        critSuccess: {
          text: '{hero} clocks the snare, the lookout, and the second lookout pretending to be a stump, all before the trap is even sprung. The giggling stops dead — whatever happens to this ambush now is entirely {hero}\'s call.',
          outcomes: [outcome.continueChain('travel_goblin_ambush_react')],
        },
        success: {
          text: '{hero} sidesteps the snare a stride before it matters, and the goblins who meant to rush out of the brush instead have to stand up out of it, caught looking foolish rather than fearsome. Beaten at their own game, they wait to see what {hero} does about it.',
          outcomes: [outcome.continueChain('travel_goblin_ambush_react')],
        },
        failure: {
          text: 'The snare finds a foot after all. By the time {hero} is back upright, small quick hands have already been through pockets, under clothes, and everywhere else they could reach. The goblins vanish into the scrub hooting, leaving {him} lighter in coin, cloth, and dignity.',
          illustration: 'goblin_ambush_caught',
          outcomes: [
            outcome.expeditionSilver(-12),
            outcome.cargo('cloth', -2),
            outcome.stress(1),
            outcome.heroCounter(AMBUSH_COUNTER_KEY, 1),
          ],
        },
        critFailure: {
          text: 'The snare drops {hero} flat. What follows is less a robbery than a thorough, gleeful ransacking — cargo, coin, and a great deal of personal attention from eager little hands and mouths while {hero} is still working out which way is up. They finally scramble off into the brush, giggling and satisfied.',
          illustration: 'goblin_ambush_caught',
          outcomes: [
            outcome.expeditionSilver(-20),
            outcome.cargo('cloth', -4),
            outcome.health(-1),
            outcome.stress(2),
            outcome.heroCounter(AMBUSH_COUNTER_KEY, 1),
          ],
        },
      },
      {
        type: 'flat',
        label: 'Push on and pretend not to notice.',
        text: 'Not noticing turns out to be exactly what the snare was counting on. The toll is quick — a few coins, a bit of cloth, and a couple of bold gropes — almost polite by goblin standards, and the party is moving again before the giggling even properly starts.',
        illustration: 'goblin_ambush_caught',
        outcomes: [outcome.expeditionSilver(-8), outcome.cargo('cloth', -1)],
      },
    ],
  }),
  makeChoiceEvent({
    id: 'travel_goblin_ambush_again',
    category: 'travel',
    illustration: 'goblin_ambush_again',
    title: 'The Same Trick Twice',
    text: 'Same stretch of scrub, same badly-hidden snare — and this time the giggling has names in it. "{hero}! {hero} again!" A band this small forgets nothing, and they clearly haven\'t forgotten {hero}. Whatever dignity survived the first time is not going to survive this one; they are delighted to see {hero}, and delight is not a good sign here.',
    conditions: [
      ...AMBUSH_CONDITIONS,
      { type: 'heroCounterAtLeast', key: AMBUSH_COUNTER_KEY, value: 1 },
      { type: 'heroCounterAtMost', key: AMBUSH_COUNTER_KEY, value: 3 },
    ],
    weight: 10,
    cooldownTurns: 4,
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    arc: 'goblin_ambush',
    choices: [
      {
        type: 'checked',
        label: 'Watch the treeline as you walk.',
        check: { skill: 'survival', stat: 'wits', difficulty: 9, tags: ['BEASTFOLK'] },
        critSuccess: {
          text: '{hero} finds the snare and both lookouts before either of them finds {him}, and the look on their faces is worth almost as much as the toll they don\'t get to collect. They clearly expected this to go their way by now — whatever they end up remembering about today is entirely up to {hero}.',
          outcomes: [outcome.continueChain('travel_goblin_ambush_again_react')],
        },
        success: {
          text: '{hero} spots it in time, barely, and the goblins have to settle for razzing {him} about how close it was. Caught fair and square this time, they wait — with obvious interest — to see how {hero} handles it.',
          outcomes: [outcome.continueChain('travel_goblin_ambush_again_react')],
        },
        failure: {
          text: 'The snare works exactly as well as it did last time, which the goblins find hilarious. "Still doesn\'t look!" one shouts, delighted, while the rest empty pockets and take their time with the rest of {hero} — hands, mouths, and a great deal of enthusiastic commentary — before scrambling off with their prizes.',
          illustration: 'goblin_ambush_caught_again',
          outcomes: [
            outcome.expeditionSilver(-14),
            outcome.cargo('cloth', -2),
            outcome.stress(2),
            outcome.heroCounter(AMBUSH_COUNTER_KEY, 1),
          ],
        },
        critFailure: {
          text: 'The whole band turns out for this one — word travels fast when there\'s a favorite to enjoy. {hero} goes down hard and stays down while they take everything they want: coin, cargo, and a thorough, cheerful working-over that leaves {him} lighter in every sense, to genuine applause.',
          illustration: 'goblin_ambush_caught_again',
          outcomes: [
            outcome.expeditionSilver(-22),
            outcome.cargo('cloth', -4),
            outcome.health(-1),
            outcome.stress(2),
            outcome.heroCounter(AMBUSH_COUNTER_KEY, 1),
          ],
        },
      },
      {
        type: 'flat',
        label: 'Push on and pretend not to notice.',
        text: '"There {he} goes again," someone says, almost fondly, and the toll comes and goes with the easy familiarity of a running bit both sides know the shape of — a little silver, a little cloth, and a few familiar hands under the clothes before they wave the party on.',
        illustration: 'goblin_ambush_caught_again',
        outcomes: [outcome.expeditionSilver(-8), outcome.cargo('cloth', -1)],
      },
    ],
  }),
  makeChoiceEvent({
    id: 'travel_goblin_ambush_tired',
    category: 'travel',
    illustration: 'goblin_ambush_tired',
    title: "Tired of the Game",
    text: 'The snare is barely hidden at all this time — nobody bothered. A dozen goblins sit around it in plain sight, arms crossed, and there is no giggling. "{hero} again," one says flatly, the way you\'d announce a chore that has quietly become a habit. This has stopped being a joke to them. They have decided they like having {him}.',
    conditions: [...AMBUSH_CONDITIONS, { type: 'heroCounterAtLeast', key: AMBUSH_COUNTER_KEY, value: 4 }],
    weight: 10,
    cooldownTurns: 4,
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    arc: 'goblin_ambush',
    choices: [
      {
        type: 'checked',
        label: 'Watch the treeline as you walk.',
        check: { skill: 'survival', stat: 'wits', difficulty: 9, tags: ['BEASTFOLK'] },
        critSuccess: {
          text: '{hero} sees it coming from a hundred paces off and simply walks the party around the whole sorry setup. The dozen goblins watch {him} go in total silence, waiting — like everyone else out here lately — to see what {hero} makes of them.',
          outcomes: [outcome.continueChain('travel_goblin_ambush_tired_react')],
        },
        success: {
          text: '{hero} catches the snare just in time, and the goblins let the party pass without much fuss, a few of them already bracing for whatever {hero} decides to do about it.',
          outcomes: [outcome.continueChain('travel_goblin_ambush_tired_react')],
        },
        failure: {
          text: 'Caught again, same as always — except this time nobody laughs. They take what they came for with brisk, businesslike hands and mouths, and one mutters that they\'re done making a show of it. Next time, they say, {hero} is coming home with them.',
          illustration: 'goblin_ambush_caught',
          outcomes: [
            outcome.expeditionSilver(-16),
            outcome.cargo('cloth', -2),
            outcome.stress(2),
            outcome.heroCounter(AMBUSH_COUNTER_KEY, 1),
            ...exclusiveTrait('easy_target', otherReputationTraits('easy_target')),
          ],
        },
        critFailure: {
          text: '"Enough," someone says, and it isn\'t a joke anymore — it isn\'t unkind, either. This isn\'t a robbery. The goblins bind {hero}, careful about it in a way that\'s somehow worse than rough, and carry {him} into the deep scrub before the rest of the party can do much more than shout. Someone this bad at watching {his} own back, they\'ve clearly decided, is safer off the road entirely — better kept close by folk who\'ve grown fond of {him} than left to wander into whoever else {he}\'d find out here next.',
          illustration: 'goblin_ambush_captured',
          outcomes: [
            outcome.captureHero('BEASTFOLK'),
            outcome.heroCounter(AMBUSH_COUNTER_KEY, 1),
            ...exclusiveTrait('easy_target', otherReputationTraits('easy_target')),
            outcome.history('Was judged too hapless to keep wandering, and was carried off by goblins for {his} own good.'),
          ],
        },
      },
      {
        type: 'flat',
        label: 'Push on and pretend not to notice.',
        text: 'Nobody so much as raises a voice this time. The toll is taken in near-total silence — silver, cloth, and a few last, lingering hands — businesslike and almost proprietary, and the party is waved on like a chore that\'s been dealt with for now.',
        illustration: 'goblin_ambush_caught',
        outcomes: [outcome.expeditionSilver(-10), outcome.cargo('cloth', -1)],
      },
    ],
  }),
  makeAmbushReactionEvent({
    id: 'travel_goblin_ambush_react',
    illustration: 'goblin_mischief',
    title: 'Your Move',
    text: 'The ambush lies in ruins around a handful of goblins who clearly hadn\'t planned past "spring the trap." {hero} has the upper hand entirely — the only question left is what to do with it.',
    turnTables: {
      critSuccess: {
        text: 'One hard look from {hero} and the fight goes out of them entirely — they empty their own pockets before {he}\'s even finished asking, eager to be anywhere else.',
        silver: 10,
        cloth: 2,
        standing: -1,
      },
      success: {
        text: '{hero} makes it plain who sprung whose trap. Grumbling, the goblins hand over a share of their own take rather than push their luck any further.',
        silver: 6,
        cloth: 1,
        standing: -2,
      },
      failure: {
        text: 'The goblins call {hero}\'s bluff and mean it, backing away with empty hands but full sneers. {hero} gets nothing for the trouble but their opinion of {him}, freely given.',
        standing: -3,
        stress: 1,
      },
      critFailure: {
        text: 'It lands as posturing, not threat, and the goblins know the difference — they scatter laughing, already turning the failed shakedown into a better story than the ambush ever was.',
        standing: -4,
        stress: 1,
      },
    },
    leaveIt: {
      text: 'Not worth the trouble. {hero} leaves them to untangle their own snare, and the party is well down the road before the goblins even finish arguing about whose fault it was.',
      historyText: 'Spotted a goblin ambush before it could spring.',
    },
    springBack: {
      text: '{hero} makes a show of "falling" for the snare anyway, tumbling theatrically into the very trap meant for {him}. The goblins, delighted past all reason, pile in to "finish the job" — only this time {hero} is very much in on it. What starts as a joke turns into a messy, enthusiastic tangle of limbs in the brush, the goblins taking turns and sharing {him} with the kind of greedy cheer they usually reserve for loot. By the time they scramble off, still giggling, both sides are thoroughly satisfied.',
      standing: 2,
    },
  }),
  makeAmbushReactionEvent({
    id: 'travel_goblin_ambush_again_react',
    illustration: 'goblin_encounter_01',
    title: 'Your Move, Again',
    text: 'Caught fair and square for once, the whole band looks almost giddy at the novelty of it — {hero} beating a game they thought they\'d long since figured out. They wait, delighted, to see what {he} does with the win.',
    turnTables: {
      critSuccess: {
        text: '{hero} doesn\'t even have to raise a voice — the band that knows {him} by name knows better than to test this. A generous share of their own take changes hands without a fight.',
        silver: 14,
        cloth: 2,
        tools: 1,
        standing: -2,
      },
      success: {
        text: 'Familiarity cuts both ways — the goblins know {hero} well enough by now to know when {he}\'s serious, and pay out grumbling but unresisting.',
        silver: 9,
        cloth: 1,
        standing: -3,
      },
      failure: {
        text: '"{hero}\'s bluffing," one of them announces to the rest, with the confidence of long acquaintance — and they\'re right. {he} gets nothing but a reputation for trying.',
        standing: -4,
        stress: 1,
      },
      critFailure: {
        text: 'They\'ve seen {hero} do everything else out here by now, and this doesn\'t impress them either — the whole band is laughing before {he}\'s even finished the demand.',
        standing: -5,
        stress: 2,
      },
    },
    leaveIt: {
      text: '{hero} doesn\'t dignify the rematch with a response, and walks on. Behind {him}, the argument over what went wrong starts before the party is even out of earshot.',
      historyText: 'Beat the goblins at their own repeat trick.',
    },
    springBack: {
      text: '{hero} plays the mark on purpose this time, and the band howls with laughter at getting to run their own trick after all. They don\'t just "collect the toll" — they take their time with {him}, hands and mouths and eager little bodies pressing in, treating the whole thing like a reunion they\'ve been looking forward to. {hero} gives as good as {he} gets, and by the end even the ones sourest about losing are laughing along with the rest. The goblins leave grinning, already talking about next time.',
      standing: 3,
      illustration: 'goblin_tumble_again',
    },
  }),
  makeAmbushReactionEvent({
    id: 'travel_goblin_ambush_tired_react',
    illustration: 'goblin_arrival',
    title: 'Your Move, Once More',
    text: 'Caught at their own dead-serious version of the game, the whole band goes quiet — not sullen, exactly, just watching close. This has stopped being funny to them somewhere along the way, which makes whatever {hero} does next matter more than it used to.',
    turnTables: {
      critSuccess: {
        text: 'Nobody so much as reaches for a weapon. {hero} has clearly stopped being worth the risk to cross, and the goblins pay out fast and say nothing at all about it afterward.',
        silver: 18,
        cloth: 2,
        tools: 1,
        standing: -3,
      },
      success: {
        text: '{hero} presses the advantage and it holds — the band pays out, sour about it, plainly filing the humiliation away for later rather than letting it go.',
        silver: 12,
        cloth: 1,
        standing: -4,
      },
      failure: {
        text: 'This band has stopped bluffing back and forth with {hero} a while ago, and they don\'t start now — they simply hold their ground until {he} runs out of things to threaten them with.',
        standing: -5,
        stress: 1,
      },
      critFailure: {
        text: 'It doesn\'t land as strength, not with this crowd, not anymore — it lands as exactly the kind of provocation they\'ve been braced for, and the mood curdles fast.',
        standing: -6,
        stress: 2,
      },
    },
    leaveIt: {
      text: '{hero} lets it go, same as the win deserves, and the band watches {him} out of sight in the same close silence they arrived in.',
      historyText: 'Finally outfoxed the goblins who\'d given up on the joke.',
    },
    springBack: {
      text: 'It\'s a risk, playing the fool for a crowd that\'s stopped laughing — but it works, and works better than {hero} expected. The old routine still means something to them. They don\'t just take the joke; they take {hero}, thoroughly and without hurry, the whole band using {him} the way they\'ve clearly been wanting to for a while now. {hero} leans into it, and for once the silence breaks into something almost affectionate. When they finally let {him} go, one of them mutters that maybe they don\'t need to take {him} home after all — not if {he} keeps coming back like this.',
      standing: 4,
    },
  }),
  makeChoiceEvent({
    id: 'travel_goblin_ambush_feared',
    category: 'travel',
    illustration: 'goblin_shakedown',
    title: 'A Name to Reckon With',
    text: 'The scrub goes quiet on this stretch again — but no snare drops, and no giggling starts. A single goblin steps out instead, empty-handed and visibly nervous, holding out a fistful of coin before {hero} can so much as slow down. "Word gets around," is all he offers. Word, apparently, has gotten all the way around.',
    conditions: [...AMBUSH_CONDITIONS, { type: 'heroCounterAtLeast', key: AMBUSH_WINS_KEY, value: AMBUSH_FEARED_THRESHOLD }],
    weight: 6,
    cooldownTurns: 5,
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    arc: 'goblin_ambush',
    choices: [
      {
        type: 'flat',
        label: 'Take what\'s offered and let the reputation stand.',
        text: '{hero} pockets the coin without comment, and the goblin scrambles off looking relieved rather than resentful — being feared, it turns out, pays better than being clever ever did.',
        outcomes: [
          outcome.expeditionSilver(6),
          ...exclusiveTrait('goblin_shakedown_artist', otherReputationTraits('goblin_shakedown_artist')),
          outcome.history('Goblins started paying a toll upfront rather than risk another shakedown from {hero}.'),
        ],
      },
      {
        type: 'flat',
        label: 'Wave him off — you didn\'t come here to collect coin from a coward.',
        text: 'The goblin practically trips over himself getting out of {hero}\'s way, coin and all, clearly more relieved than insulted. Whatever {hero}\'s name means out here now, it\'s not a name anyone wants to test twice.',
        outcomes: [
          outcome.standing('BEASTFOLK', 1),
          ...exclusiveTrait('goblin_shakedown_artist', otherReputationTraits('goblin_shakedown_artist')),
          outcome.history('Goblins started paying a toll upfront rather than risk another shakedown from {hero}.'),
        ],
      },
    ],
  }),
  makeChoiceEvent({
    id: 'travel_goblin_ambush_bond',
    category: 'travel',
    illustration: 'goblin_encounter_01',
    title: 'One of Their Own, More or Less',
    text: 'The same stretch of scrub, but the goblins waiting in it aren\'t hiding this time — they wave {hero} down like an old friend passing through, one of them already offering to trade jokes instead of blows. Whatever the ambush used to be between them, it\'s turned into something closer to a running visit.',
    conditions: [...AMBUSH_CONDITIONS, { type: 'heroCounterAtLeast', key: AMBUSH_KINDNESS_KEY, value: AMBUSH_KINDNESS_THRESHOLD }],
    weight: 6,
    cooldownTurns: 5,
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    arc: 'goblin_ambush',
    choices: [
      {
        type: 'flat',
        label: 'Stop and trade a joke or two before moving on.',
        text: '{hero} plays along, and the goblins send the party off with a round of terrible puns and no toll at all — the ambush routine has quietly become something {hero} looks forward to as much as they do.',
        outcomes: [
          outcome.stress(-1),
          ...exclusiveTrait('friend_of_goblins', otherReputationTraits('friend_of_goblins')),
          outcome.history('Goblins along the road started treating {hero} like one of their own.'),
        ],
      },
      {
        type: 'flat',
        label: 'Wave back and keep moving — there\'s still ground to cover.',
        text: 'No time today, but the goblins take the wave for what it is and let the party through without so much as a token toll, already shouting after {hero} to come back and visit properly next time.',
        outcomes: [
          ...exclusiveTrait('friend_of_goblins', otherReputationTraits('friend_of_goblins')),
          outcome.history('Goblins along the road started treating {hero} like one of their own.'),
        ],
      },
    ],
  }),
  makeChoiceEvent({
    id: 'travel_goblin_ambush_surrender',
    category: 'travel',
    illustration: 'goblin_arrival',
    title: 'They\'ve Had Enough',
    text: 'No snare this time — just the same dozen goblins standing in plain sight on the trail, hands empty and raised, and none of the usual giggling. Nobody\'s smiling, either. "{hero} again," one says, and it doesn\'t sound delighted anymore — it sounds like something they\'ve been dreading. They\'re done testing {hero}. What they want now, plainly, is for this to stop costing them anything at all.',
    conditions: [...AMBUSH_CONDITIONS, { type: 'heroCounterAtLeast', key: AMBUSH_WINS_KEY, value: AMBUSH_WINS_THRESHOLD }],
    weight: 10,
    once: true,
    binding: { type: 'random' },
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    arc: 'goblin_ambush',
    choices: [
      {
        type: 'flat',
        label: 'Accept the truce — let this be over.',
        text: '{hero} takes the offer, and the relief on their faces is almost insulting — like {he}\'d been some looming disaster they\'d finally talked their way out of. A little silver and a lot of nodding later, it\'s settled: {hero} leaves them be, and in exchange, they never have to work up the nerve to cross {him} again.',
        outcomes: [
          outcome.standing('BEASTFOLK', 5),
          outcome.setFlag(AMBUSH_TRUCE_FLAG),
          outcome.history('Frightened the goblin ambushers badly enough that they offered silver just to be left alone.'),
        ],
      },
      {
        type: 'flat',
        label: 'Wave them off — the game\'s too good to give up.',
        text: '{hero} isn\'t ready to let it end on their terms, and waves the offer off. The goblins take it about as well as {he}\'d expect from something already afraid of {him} — a lot of nervous glancing, no argument at all, and clearly already dreading the next time.',
        outcomes: [outcome.history('Turned down a fearful truce offer from the goblin ambushers, content to let them keep dreading the next encounter.')],
      },
    ],
  }),
  makeChoiceEvent({
    id: 'travel_goblin_trade',
    category: 'travel',
    illustration: 'goblin_encounter_01',
    title: 'An Honest Toll',
    text: 'The same stretch of scrub, and the same goblins — but the wariness that used to hang over these meetings is long gone, worn away into something like real fondness. A blanket\'s spread with dried herbs, odd little carvings, and whatever else the band has scavenged since the truce, and {hero} gets a proper greeting rather than a snare. Someone always repeats the standing invitation to come sit at their fires sometime — they\'d clearly love to have {him}. Old habits die hard in one way, at least: they still drive a hard bargain.',
    conditions: [{ type: 'destinationTag', tag: 'goblin' }, { type: 'flag', flag: AMBUSH_TRUCE_FLAG }],
    weight: 10,
    cooldownTurns: 4,
    factions: ['BEASTFOLK'],
    peoples: ['goblin'],
    arc: 'goblin_ambush',
    choices: [
      {
        type: 'checked',
        label: 'Trade fairly with them.',
        check: { skill: 'bargain', stat: 'wits', difficulty: 8, tags: ['BEASTFOLK'] },
        critSuccess: {
          text: '{hero} haggles them down to something close to a giveaway, and they take it with real good humor rather than grumbling — happy just to have {him} lingering a while longer.',
          outcomes: [outcome.cargo('herbs', 3), outcome.expeditionSilver(-5), outcome.standing('BEASTFOLK', 2)],
        },
        success: {
          text: 'It\'s a fair trade, haggled out with more theater than it strictly needs — mostly because they enjoy the back-and-forth with {hero} almost as much as the goods themselves.',
          outcomes: [outcome.cargo('herbs', 2), outcome.expeditionSilver(-8), outcome.standing('BEASTFOLK', 1)],
        },
        failure: {
          text: '{hero} comes out slightly on the losing end of the haggling, but not by much, and not by anything worth making an issue of.',
          outcomes: [outcome.cargo('herbs', 1), outcome.expeditionSilver(-10)],
        },
        critFailure: {
          text: 'Whatever {hero} tries lands wrong, and the goblins just shake their heads and pack the blanket back up rather than deal further today.',
          outcomes: [outcome.expeditionSilver(-4), outcome.stress(1)],
        },
      },
      {
        type: 'flat',
        label: 'Keep it brief — a quick trade and move on.',
        text: '{hero} doesn\'t linger over it this time, and neither do they, though someone still calls after {him} to remember the invitation. A quick exchange, no haggling, and the party is back on the road before the blanket\'s even folded up again.',
        outcomes: [outcome.cargo('herbs', 1), outcome.expeditionSilver(-6)],
      },
    ],
  }),
];
