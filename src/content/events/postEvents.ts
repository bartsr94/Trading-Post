// Post & economy events (spec §9). Second person, terse, concrete.
// Choices are intentions, not mechanics.

import type { GameEvent } from '../../engine/events/types';

export const POST_EVENTS: GameEvent[] = [
  {
    id: 'post_raise_palisade',
    category: 'post',
    illustration: 'palisade_raising',
    title: 'Raising the Palisade',
    text: 'The timber is cut and stacked, the storehouse holds, and there is coin enough in the strongbox at last. What stands now is a clearing with walls half-imagined; what could stand by first frost is a Post — gated, named, marked on the maps that matter. {hero} paces the line where the wall will run, and the work wants a hand that knows how timber and tired people are made to hold together.',
    conditions: [{ type: 'canAdvanceTier' }],
    weight: 40,
    cooldownTurns: 4,
    binding: { type: 'highestSkill', skill: 'leadership' },
    choices: [
      {
        label: 'Drive the work yourself — every hand on the wall until it stands.',
        check: { skill: 'leadership', stat: 'resolve', difficulty: 10, tags: ['build'] },
        outcomes: {
          critSuccess: {
            text: 'The whole company and every hired hand turn out. The posts go up straight and deep, the gate swings true on its first hanging, and someone scratches a name into the lintel. By dusk you are no longer a camp. You are a Post.',
            outcomes: [
              { type: 'advanceTier' },
              { type: 'history', text: 'Raised the palisade and named the Post.' },
            ],
          },
          success: {
            text: 'A hard fortnight of raw hands and short tempers, but the wall stands and the gate bars. The frontier can no longer simply wander in at night. The camp has become a Post.',
            outcomes: [
              { type: 'advanceTier' },
              { type: 'history', text: 'Saw the palisade raised.' },
            ],
          },
          failure: {
            text: 'Half-set posts lean in the churned mud and a whole section sags overnight. The wall will stand — but not this fortnight, and not without another push. Tempers fray all round.',
            outcomes: [{ type: 'stress', delta: 1, allHeroes: true }],
          },
          critFailure: {
            text: 'A run of posts pulls loose in the wet and comes down, nearly taking a labourer with it. The work is set back to bare ground, and the company grumbles at the wasted sweat.',
            outcomes: [{ type: 'stress', delta: 2, allHeroes: true }],
          },
        },
      },
      {
        label: 'Leave it to the hired hands — pay them to raise it at their own pace.',
        outcomes: {
          success: {
            text: 'You keep the company at its trades and let the labourers raise the wall. It goes up slower, and a little crooked — but it goes up, and the gate bars at the end of it. The extra hands cost you.',
            outcomes: [
              { type: 'advanceTier' },
              { type: 'silver', delta: -20 },
            ],
          },
        },
      },
    ],
  },
  {
    id: 'post_leaky_stores',
    category: 'post',
    illustration: 'rain_stores',
    title: 'Rain in the Stores',
    text: 'Three days of rain, and on the fourth {hero} finds water running under the stockpile tarps. The grain sacks on the bottom are darkening. Everything you own sits under canvas and prayer — and the sky has more to give.',
    conditions: [{ type: 'goodAtLeast', good: 'grain', qty: 5 }],
    weight: 10,
    cooldownTurns: 8,
    binding: { type: 'highestSkill', skill: 'craft' },
    choices: [
      {
        label: 'Set {hero} to rebuild the stack — drainage, staging, proper cover.',
        check: { skill: 'craft', stat: 'wits', difficulty: 9 },
        outcomes: {
          critSuccess: {
            text: 'By nightfall the goods sit on raised staging under taut hide. {hero} even rigs a rain-catch; clean water, saved grain, and a thing done properly.',
            outcomes: [{ type: 'history', text: 'Saved the stores from the long rain.' }],
          },
          success: {
            text: '{hero} works through the wet and gets the stock up off the ground. You lose a little to rot, no more.',
            outcomes: [{ type: 'good', good: 'grain', delta: -2 }],
          },
          failure: {
            text: 'The staging collapses in the mud and the rain finds every seam. You dig sodden sacks out by lantern light.',
            outcomes: [
              { type: 'good', good: 'grain', delta: -6 },
              { type: 'stress', delta: 1 },
            ],
          },
          critFailure: {
            text: 'A support beam slips and comes down on {hero}. The stores drown; the company carries {hero} to a cot.',
            outcomes: [
              { type: 'good', good: 'grain', delta: -8 },
              { type: 'health', delta: -2 },
              { type: 'stress', delta: 2 },
            ],
          },
        },
      },
      {
        label: 'Let it rain. Sell off the wet grain cheap before it turns.',
        outcomes: {
          success: {
            text: 'You move the damp sacks at a humiliating price to anyone who will smoke or brew it. Silver in hand, pride somewhere in the mud.',
            outcomes: [
              { type: 'good', good: 'grain', delta: -8 },
              { type: 'silver', delta: 12 },
            ],
          },
        },
      },
    ],
  },
  {
    id: 'post_river_traders',
    category: 'faction',
    illustration: 'river_canoes',
    title: 'Canoes at Dawn',
    text: 'Four canoes ground on the mud below the post, low in the water with bales of winter furs. Njaro-Matu has decided you are worth a look. Their trade-speaker waits at the fire, studying your tents, your goods, your faces — pricing all of it.',
    conditions: [{ type: 'standingAtMost', faction: 'RIVER_CLANS', value: 80 }],
    weight: 12,
    cooldownTurns: 5,
    binding: { type: 'highestSkill', skill: 'bargain' },
    choices: [
      {
        label: 'Send {hero} to haggle hard for the furs.',
        check: { skill: 'bargain', stat: 'charm', difficulty: 10, tags: ['RIVER_CLANS', 'trade'] },
        outcomes: {
          critSuccess: {
            text: 'The trade-speaker laughs aloud at {hero}’s final offer and takes it for the sheer nerve. Furs change hands at a price you’ll not see again.',
            outcomes: [
              { type: 'good', good: 'furs', delta: 6 },
              { type: 'silver', delta: -20 },
              { type: 'standing', faction: 'RIVER_CLANS', delta: 5 },
            ],
          },
          success: {
            text: 'An hour of tea, insult, and counter-offer. The bales come ashore at a fair price, and the speaker marks your post on his mental map of places worth a stop.',
            outcomes: [
              { type: 'good', good: 'furs', delta: 4 },
              { type: 'silver', delta: -25 },
              { type: 'standing', faction: 'RIVER_CLANS', delta: 3 },
            ],
          },
          failure: {
            text: '{hero} pushes too hard on the opening price. The speaker’s face closes like a door. They sell you a token bale, for courtesy, and shove off early.',
            outcomes: [
              { type: 'good', good: 'furs', delta: 1 },
              { type: 'silver', delta: -12 },
              { type: 'standing', faction: 'RIVER_CLANS', delta: -2 },
            ],
          },
        },
      },
      {
        label: 'Host them properly first — food, fire, gifts. Trade after.',
        outcomes: {
          success: {
            text: 'You feed them from your own stores and give tools as guest-gifts. The trading that follows is modest, but names are exchanged, and children stare at your strange boots. They will be back.',
            outcomes: [
              { type: 'good', good: 'grain', delta: -3 },
              { type: 'good', good: 'tools', delta: -1 },
              { type: 'good', good: 'furs', delta: 2 },
              { type: 'standing', faction: 'RIVER_CLANS', delta: 8 },
              { type: 'axis', axis: 'integration', delta: 1 },
            ],
          },
        },
      },
      {
        label: 'Keep them at the waterline. Trade brisk and armed.',
        outcomes: {
          success: {
            text: 'Business is done on the mud with spears visible on both sides. Fair prices, no warmth. The canoes push off without a backward glance.',
            outcomes: [
              { type: 'good', good: 'furs', delta: 2 },
              { type: 'silver', delta: -14 },
              { type: 'standing', faction: 'RIVER_CLANS', delta: -3 },
              { type: 'axis', axis: 'integration', delta: -1 },
            ],
          },
        },
      },
    ],
  },
  {
    id: 'post_wolves',
    category: 'post',
    illustration: 'wolves_dark',
    title: 'Eyes Beyond the Fire',
    text: 'The dogs will not settle. Out past the woodpile, green eyes catch the firelight — a wolf pack, bold with hunger, drawn by your smokehouse and your horses. Tonight they watch. Tomorrow they will try something. {hero} already has a spear in hand.',
    conditions: [],
    weight: 8,
    cooldownTurns: 8,
    binding: { type: 'highestSkill', skill: 'combat' },
    choices: [
      {
        label: 'Take torches and drive the pack off now.',
        check: { skill: 'combat', stat: 'might', difficulty: 9 },
        outcomes: {
          critSuccess: {
            text: '{hero} kills the lead wolf with one cast and the pack scatters into the dark. The pelt is a fine one, and the story is better.',
            outcomes: [
              { type: 'good', good: 'furs', delta: 1 },
              { type: 'history', text: 'Killed the pack-leader by torchlight.' },
            ],
          },
          success: {
            text: 'Noise, fire, and cold iron. The pack breaks and flows away between the trees. The night is yours again.',
            outcomes: [{ type: 'stress', delta: -1 }],
          },
          failure: {
            text: 'The wolves are faster than the torchlight. One gets past {hero} into the smokehouse and drags off a season’s hides before the shouting ends.',
            outcomes: [{ type: 'good', good: 'hides', delta: -3 }],
          },
          critFailure: {
            text: 'In the dark and the mud a wolf finds {hero}’s arm. The pack takes what it wants from the stores while the company fights to pull it off.',
            outcomes: [
              { type: 'health', delta: -3 },
              { type: 'good', good: 'hides', delta: -2 },
              { type: 'good', good: 'grain', delta: -2 },
            ],
          },
        },
      },
      {
        label: 'Set snares and poisoned bait along the treeline instead.',
        check: { skill: 'survival', stat: 'wits', difficulty: 10, tags: ['hunting'] },
        outcomes: {
          success: {
            text: 'Two mornings later there are three stiff grey shapes at the treeline and no more eyes at night. The pelts are payment for lost sleep.',
            outcomes: [{ type: 'good', good: 'furs', delta: 2 }],
          },
          failure: {
            text: 'The pack is too canny for bait. They take a dog instead, three nights running, until they finally drift off to easier hunting. The company sleeps badly.',
            outcomes: [{ type: 'stress', delta: 2, allHeroes: true }],
          },
        },
      },
    ],
  },
  {
    id: 'post_charter_letter',
    category: 'faction',
    illustration: 'wax_seal',
    title: 'A Letter Under Seal',
    text: 'A boat up from Thornwatch leaves mail: one letter, heavy paper, the Ansberry Company’s seal in blue wax. The Directors "note with interest" your establishment and "anticipate the first remittance of proceeds." Between the courtesies sits a blade: they are counting weeks. {hero} reads it twice and sets it down carefully.',
    conditions: [{ type: 'minTurn', value: 3 }],
    weight: 10,
    cooldownTurns: 7,
    binding: { type: 'highestSkill', skill: 'diplomacy' },
    choices: [
      {
        label: 'Send silver with the returning boat — an early token of profits.',
        requires: [{ type: 'silverAtLeast', value: 40 }],
        outcomes: {
          success: {
            text: 'Forty pieces, counted and sealed, with a letter of confident projections. Money speaks the Directors’ own tongue; the reply, months from now, will be warmer.',
            outcomes: [
              { type: 'silver', delta: -40 },
              { type: 'standing', faction: 'CHARTER_COMPANY', delta: 10 },
            ],
          },
        },
      },
      {
        label: 'Have {hero} draft a masterful report — progress, promise, no silver.',
        check: { skill: 'diplomacy', stat: 'charm', difficulty: 11 },
        outcomes: {
          critSuccess: {
            text: '{hero} writes of fur routes secured and native partnerships ripening — every word true, arranged like a shop window. A Director quotes it at the quarterly meeting.',
            outcomes: [{ type: 'standing', faction: 'CHARTER_COMPANY', delta: 8 }],
          },
          success: {
            text: 'Honest difficulties, honest progress, and a request for patience phrased as opportunity. It will hold them. For now.',
            outcomes: [{ type: 'standing', faction: 'CHARTER_COMPANY', delta: 3 }],
          },
          failure: {
            text: 'The report reads as excuses because, in fairness, it is excuses. You can almost hear the Directors’ pens scratching notes in the margin.',
            outcomes: [{ type: 'standing', faction: 'CHARTER_COMPANY', delta: -6 }],
          },
        },
      },
      {
        label: 'No reply. Let the ledgers speak when they’re ready.',
        outcomes: {
          success: {
            text: 'The packet-boat leaves empty-handed. Silence is an answer too, and the Company keeps a file of answers.',
            outcomes: [{ type: 'standing', faction: 'CHARTER_COMPANY', delta: -8 }],
          },
        },
      },
    ],
  },
  {
    id: 'post_drifter',
    category: 'post',
    illustration: 'drifter_gate',
    title: 'The Man at the Woodpile',
    text: 'He is simply there one morning, splitting your firewood, a bundle of everything he owns at his feet. Homeland face, frontier hands, a soldier’s boots worn to nothing. "Heard there was work," he says to {hero}, not stopping. He has split half the pile already.',
    conditions: [{ type: 'notFlag', flag: 'drifter_resolved' }],
    weight: 8,
    once: true,
    binding: { type: 'random' },
    choices: [
      {
        label: 'Feed him and take him on for wages.',
        outcomes: {
          success: {
            text: 'He gives the name Odd, eats like a stove, and works like two men. He asks no questions about the post and answers none about himself. It seems a fair trade.',
            outcomes: [
              { type: 'setFlag', flag: 'drifter_resolved' },
              { type: 'setFlag', flag: 'odd_hired' },
              { type: 'silver', delta: -10 },
              { type: 'axis', axis: 'communal', delta: 1 },
            ],
          },
        },
      },
      {
        label: 'Have {hero} question him properly first.',
        check: { skill: 'lore', stat: 'wits', difficulty: 9, tags: ['strangers'] },
        outcomes: {
          success: {
            text: '{hero} reads the tattoos, the accent, the way he flinches at the Company name: a deserter, but from a garrison famous for cruelty. He confesses readily. You hire him at half-wage and both parties are satisfied.',
            outcomes: [
              { type: 'setFlag', flag: 'drifter_resolved' },
              { type: 'setFlag', flag: 'odd_hired' },
              { type: 'silver', delta: -5 },
            ],
          },
          failure: {
            text: 'His answers are smooth and his eyes are elsewhere. {hero} learns nothing, and by morning the man is gone — with an axe and a sack of grain for his trouble.',
            outcomes: [
              { type: 'setFlag', flag: 'drifter_resolved' },
              { type: 'good', good: 'grain', delta: -3 },
            ],
          },
        },
      },
      {
        label: 'Send him down the road. The post feeds enough mouths.',
        outcomes: {
          success: {
            text: 'He nods as if he expected nothing else, shoulders his bundle, and walks north. He leaves the wood split and stacked. Somehow that makes it worse.',
            outcomes: [
              { type: 'setFlag', flag: 'drifter_resolved' },
              { type: 'axis', axis: 'communal', delta: -1 },
              { type: 'stress', delta: 1 },
            ],
          },
        },
      },
    ],
  },
  {
    id: 'post_amber_rumor',
    category: 'post',
    illustration: 'amber_map',
    title: 'The Amber Seller’s Map',
    text: 'A toothless trapper trades at your fire and pays for his salt with talk: a stream-cut in the eastern woods where amber washes out after hard rain, marked on a scrap of hide he’ll part with — for silver. The Bejasi Hills folk, he says, don’t go there anymore. He doesn’t say why. {hero} turns the hide scrap over, weighing it.',
    conditions: [{ type: 'silverAtLeast', value: 20 }],
    weight: 8,
    once: true,
    binding: { type: 'highestSkill', skill: 'lore' },
    choices: [
      {
        label: 'Buy the map.',
        outcomes: {
          success: {
            text: 'Twenty silver for a scrap of greasy hide and an X. The trapper leaves grinning, which is either a good sign or a very bad one. An expedition can go when the rains come.',
            outcomes: [
              { type: 'silver', delta: -20 },
              { type: 'queueEvent', eventId: 'post_amber_find', delayTurns: 2 },
            ],
          },
        },
      },
      {
        label: 'Decline. Amber stories are how trappers buy salt.',
        outcomes: {
          success: {
            text: 'He shrugs, pockets the hide, and finishes his tea. "Suit yourselves. Somebody richer will." The fire pops. You do wonder, later.',
            outcomes: [],
          },
        },
      },
    ],
  },
  {
    id: 'post_amber_find',
    category: 'chain',
    illustration: 'amber_stream',
    title: 'The Stream-Cut',
    text: 'The map is honest after all: a raw gully in the eastern woods, banks slumping after rain, and in the gravel — a gleam like trapped sunlight. But the trees here are hung with knotted cords, old and new, and small bones. The Bejasi Hills folk marked this place. {hero} crouches at the water’s edge, deciding how far to press this.',
    conditions: [],
    weight: 0,
    once: true,
    binding: { type: 'highestSkill', skill: 'lore' },
    choices: [
      {
        label: 'Read the cords before touching anything.',
        check: { skill: 'lore', stat: 'wits', difficulty: 11, tags: ['ritual'] },
        outcomes: {
          critSuccess: {
            text: 'The knots are a grave-warning — and a boundary. {hero} works only the gravel outside the marked line, taking what the water already carried out. Amber in hand, taboo unbroken, and knowledge of the Bejasi Hills folk’s marks that few strangers hold.',
            outcomes: [
              { type: 'good', good: 'amber', delta: 4 },
              { type: 'standing', faction: 'OLD_PEOPLE', delta: 3 },
              { type: 'history', text: 'Read the boundary-cords at the amber stream.' },
            ],
          },
          success: {
            text: '{hero} can’t read every knot, but enough: this ground is claimed by the dead. The company gathers quickly from the streambed only, and leaves an offering of salt.',
            outcomes: [
              { type: 'good', good: 'amber', delta: 2 },
              { type: 'good', good: 'salt', delta: -1 },
            ],
          },
          failure: {
            text: 'The cords keep their meaning. You dig, fill a pouch — and find, on leaving, that every cord along your path has been freshly cut. Someone watched the whole time.',
            outcomes: [
              { type: 'good', good: 'amber', delta: 2 },
              { type: 'standing', faction: 'OLD_PEOPLE', delta: -8 },
              { type: 'stress', delta: 2 },
            ],
          },
        },
      },
      {
        label: 'Dig fast, load up, and be gone by dark.',
        check: { skill: 'survival', stat: 'agility', difficulty: 9 },
        outcomes: {
          success: {
            text: 'No reading, no offerings — shovels. The company strips the gravel bed by dusk and marches out with full pouches and the small conviction of being watched all the way home.',
            outcomes: [
              { type: 'good', good: 'amber', delta: 3 },
              { type: 'standing', faction: 'OLD_PEOPLE', delta: -5 },
            ],
          },
          failure: {
            text: 'The slumped bank gives way under the digging. {hero} is pulled out coughing mud, and half the gathered amber goes back into the earth that clearly wants to keep it.',
            outcomes: [
              { type: 'good', good: 'amber', delta: 1 },
              { type: 'health', delta: -2 },
              { type: 'standing', faction: 'OLD_PEOPLE', delta: -5 },
            ],
          },
        },
      },
    ],
  },
  {
    id: 'post_fever',
    category: 'post',
    illustration: 'sickbed',
    title: 'Marsh Fever',
    text: 'It starts with the youngest laborer shivering at midday, and by week’s end half the post moves like sleepwalkers — the sweating sickness the rivermen warned about. The homeland remedies do nothing. {hero} has the best chance of finding what will.',
    conditions: [{ type: 'minTurn', value: 2 }],
    weight: 7,
    cooldownTurns: 10,
    binding: { type: 'highestSkill', skill: 'lore' },
    choices: [
      {
        label: 'Send {hero} to the marsh for the herb the rivermen chew.',
        check: { skill: 'lore', stat: 'wits', difficulty: 10 },
        outcomes: {
          critSuccess: {
            text: '{hero} returns with armfuls of grey-green leaf and the knowledge of where it grows thick. The fever breaks in days; the surplus is worth silver in its own right.',
            outcomes: [
              { type: 'good', good: 'herbs', delta: 2 },
              { type: 'history', text: 'Broke the marsh fever with greyleaf.' },
            ],
          },
          success: {
            text: 'Bitter leaf, foul tea, blessed sweat. The sick sit up inside a week, hollow but living.',
            outcomes: [{ type: 'stress', delta: 1, allHeroes: true }],
          },
          failure: {
            text: 'Wrong leaf, wasted days. The fever burns through the post on its own schedule and takes its toll in flesh before it goes.',
            outcomes: [
              { type: 'stress', delta: 2, allHeroes: true },
              { type: 'health', delta: -2 },
            ],
          },
          critFailure: {
            text: 'The gathered leaf is a purgative. {hero}, dosing the sick and themselves, makes everything worse — the post is a groaning misery for two full weeks.',
            outcomes: [
              { type: 'stress', delta: 3, allHeroes: true },
              { type: 'health', delta: -3 },
            ],
          },
        },
      },
      {
        label: 'Pay a healer from Njaro-Matu to come. Swallow the pride.',
        requires: [{ type: 'silverAtLeast', value: 25 }],
        outcomes: {
          success: {
            text: 'She arrives in her own canoe, charges like a duchess, and cures the post in four days of smoke and scalding tea. She leaves with your silver and, oddly, a higher opinion of you for asking.',
            outcomes: [
              { type: 'silver', delta: -25 },
              { type: 'standing', faction: 'RIVER_CLANS', delta: 4 },
              { type: 'axis', axis: 'integration', delta: 1 },
            ],
          },
        },
      },
    ],
  },
  {
    id: 'post_fire',
    category: 'post',
    illustration: 'night_fire',
    title: 'Fire in the Night',
    text: 'A shout, then the bell. A cook-fire ember has found the woodpile, and the woodpile leans against the store tent. Flame climbs faster than thought. The whole post is a ring of running shadows and thrown water, and {hero} is closest to the burning canvas.',
    conditions: [{ type: 'minTurn', value: 2 }],
    weight: 6,
    cooldownTurns: 10,
    binding: { type: 'highestStat', stat: 'might' },
    choices: [
      {
        label: '{hero} tears the burning section away bare-handed.',
        check: { skill: 'combat', stat: 'might', difficulty: 10 },
        outcomes: {
          success: {
            text: '{hero} rips the flaming canvas free and hurls it clear; the bucket-line kills the rest. Scorched hands, saved stores, and a story the laborers will tell all winter.',
            outcomes: [
              { type: 'health', delta: -1 },
              { type: 'good', good: 'timber', delta: -2 },
              { type: 'history', text: 'Pulled the burning canvas off the stores bare-handed.' },
            ],
          },
          failure: {
            text: 'The flames beat {hero} back twice, and by the time the buckets win, the store tent is half gone and the goods with it.',
            outcomes: [
              { type: 'health', delta: -2 },
              { type: 'good', good: 'timber', delta: -4 },
              { type: 'good', good: 'cloth', delta: -2 },
              { type: 'good', good: 'grain', delta: -4 },
            ],
          },
        },
      },
      {
        label: 'Sacrifice the woodpile — pull the tents back and let it burn out.',
        outcomes: {
          success: {
            text: 'You give the fire its meal and save everything else. The timber is a glowing ruin by dawn, but nobody is burned and nothing else is lost. Cold arithmetic; correct arithmetic.',
            outcomes: [{ type: 'good', good: 'timber', delta: -6 }],
          },
        },
      },
    ],
  },
];
