// Hero-personal events (spec §9) — tied to pool heroes' plot hooks, plus the
// generic quarrel and the stress-breakdown chain event.

import type { GameEvent } from '../../engine/events/types';

export const HERO_EVENTS: GameEvent[] = [
  {
    id: 'hero_p1_debt',
    category: 'hero',
    illustration: 'stranger_scar',
    title: 'The Sergeant’s Debt',
    text: 'The stranger walks in with a soldier’s bearing and asks for Berrin by his old rank. They served together; there was a retreat, a bridge, and money owed to dead men’s widows that Berrin swore to pay. The stranger has spent four years finding him. "Twenty-five silver," he says. "Or I tell the story everywhere between here and home."',
    conditions: [{ type: 'heroInParty', heroId: 'p1' }, { type: 'minTurn', value: 2 }],
    weight: 14,
    once: true,
    binding: { type: 'specific', heroId: 'p1' },
    choices: [
      {
        label: 'Pay it from the company chest. Debts of honor bind the company now.',
        requires: [{ type: 'silverAtLeast', value: 25 }],
        outcomes: {
          success: {
            text: 'Berrin watches the silver counted out and ages five years in relief. "I’ll earn it back," he says, and means it. The stranger leaves a receipt, of all things — widows’ marks on cheap paper.',
            outcomes: [
              { type: 'silver', delta: -25 },
              { type: 'stress', delta: -3 },
              { type: 'removeTrait', trait: 'grieving' },
              { type: 'history', text: 'The widows’ debt was paid at last.' },
            ],
          },
        },
      },
      {
        label: 'Let Berrin face him down. The past has no jurisdiction here.',
        check: { skill: 'combat', stat: 'resolve', difficulty: 10, tags: ['intimidation'] },
        outcomes: {
          success: {
            text: 'Berrin rises to his full old height and says one quiet sentence you don’t catch. The stranger looks at him a long moment, spits, and goes. The story will travel anyway — but so will how it ended.',
            outcomes: [{ type: 'stress', delta: 2 }],
          },
          failure: {
            text: 'The stranger doesn’t flinch: he recites names — the widows’ names — until Berrin’s shoulders drop. He leaves unpaid, telling the story to everyone downriver. Berrin doesn’t speak for two days.',
            outcomes: [
              { type: 'stress', delta: 4 },
              { type: 'addTrait', trait: 'shaken' },
              { type: 'standing', faction: 'CHARTER_COMPANY', delta: -4 },
            ],
          },
        },
      },
    ],
  },
  {
    id: 'hero_p3_letters',
    category: 'hero',
    illustration: 'letters_lamp',
    title: 'Letters by Lamplight',
    text: 'Tobin has written eleven letters home and sent none, because reading them back makes him weep and start over. Tonight {hero} finds him at the lamp with all eleven spread out — and notices something Tobin hasn’t: between the homesickness, his margin-notes map every plant, ford, and native word the company has met. It is the best survey of this country anyone has made.',
    conditions: [{ type: 'heroInParty', heroId: 'p3' }],
    weight: 10,
    once: true,
    binding: { type: 'specific', heroId: 'p3' },
    choices: [
      {
        label: 'Set him to turn the letters into a proper survey for the Company.',
        check: { skill: 'lore', stat: 'wits', difficulty: 9 },
        outcomes: {
          success: {
            text: 'Given a purpose, Tobin stops weeping and starts working. The finished survey is genuinely valuable — the Directors will see the country, and Tobin, clearly for the first time.',
            outcomes: [
              { type: 'standing', faction: 'CHARTER_COMPANY', delta: 6 },
              { type: 'stress', delta: -2 },
              { type: 'removeTrait', trait: 'homesick' },
              { type: 'history', text: 'His letters home became the first survey of the territory.' },
            ],
          },
          failure: {
            text: 'The survey defeats him — too big, too formal, too far from the sister he was actually writing to. He abandons it and the letters both, which is somehow the saddest outcome available.',
            outcomes: [{ type: 'stress', delta: 2 }],
          },
        },
      },
      {
        label: 'Just make him send the letters. Homesickness festers unsent.',
        outcomes: {
          success: {
            text: 'The packet-boat takes all eleven. Tobin watches it out of sight and comes back to the fire lighter by some exact amount. Months from now, replies will come.',
            outcomes: [{ type: 'stress', delta: -3 }],
          },
        },
      },
    ],
  },
  {
    id: 'hero_p5_poachers',
    category: 'hero',
    illustration: 'poachers_hills',
    title: 'Snares in the High Country',
    text: 'Dagny comes back from the drylands at a run. She found a poaching camp — homeland men, not natives — working the Dustwalkers’ hunting range with wire snares, the kind that waste half of what they kill. If the Dustwalkers find that camp first, they will not care much about which homeland men set the snares and which ones run a trading post.',
    conditions: [{ type: 'heroInParty', heroId: 'p5' }],
    weight: 12,
    once: true,
    binding: { type: 'specific', heroId: 'p5' },
    choices: [
      {
        label: 'Send Dagny to run them off — her hills, her rules.',
        check: { skill: 'combat', stat: 'agility', difficulty: 10, tags: ['intimidation'] },
        outcomes: {
          success: {
            text: 'Dagny walks into their camp alone, puts an arrow through their stew-pot, and explains the situation. They are gone by morning. Word of it reaches the Tribes, as she intended it to.',
            outcomes: [
              { type: 'standing', faction: 'HILL_TRIBES', delta: 8 },
              { type: 'history', text: 'Cleared the poachers out of the fur grounds alone.' },
            ],
          },
          failure: {
            text: 'The poachers are more numerous than their fires suggested, and they know what an arrow costs. Dagny comes home with a knife-slash and worse news: they’re moving deeper in, not out.',
            outcomes: [
              { type: 'health', delta: -2 },
              { type: 'standing', faction: 'HILL_TRIBES', delta: -4 },
            ],
          },
        },
      },
      {
        label: 'Send word to the Dustwalkers and let them handle their own grounds.',
        outcomes: {
          success: {
            text: 'You send Dagny with the camp’s location and no apology for the men in it. The Dustwalkers handle it in their own way, which you do not ask about. That you told them — and what you didn’t ask — is noted.',
            outcomes: [
              { type: 'standing', faction: 'HILL_TRIBES', delta: 5 },
              { type: 'axis', axis: 'integration', delta: 1 },
              { type: 'stress', delta: 1 },
            ],
          },
        },
      },
      {
        label: 'Quietly buy their furs. Poached pelts weigh the same.',
        outcomes: {
          success: {
            text: 'Cheap furs, no questions, and Dagny’s open disgust. If the Dustwalkers ever trace those pelts to your scales, no palisade will be tall enough.',
            outcomes: [
              { type: 'good', good: 'furs', delta: 5 },
              { type: 'silver', delta: -10 },
              { type: 'setFlag', flag: 'bought_poached_furs' },
              { type: 'stress', delta: 2 },
            ],
          },
        },
      },
    ],
  },
  {
    id: 'hero_p7_game',
    category: 'hero',
    illustration: 'dice_lantern',
    title: 'Jusk Finds a Game',
    text: 'Caravan guards, a lantern, a blanket, bone dice — and Jusk, drawn across the yard like iron to a lodestone. He’s already sitting down. He looks up at {hero} with the particular innocence of a man about to wager the company’s goodwill, and possibly its silver. "Small stakes," he says. It is never small stakes.',
    conditions: [{ type: 'heroInParty', heroId: 'p7' }],
    weight: 9,
    cooldownTurns: 8,
    binding: { type: 'specific', heroId: 'p7' },
    choices: [
      {
        label: 'Let him play. Luck is a skill too.',
        check: { skill: 'bargain', stat: 'agility', difficulty: 10, tags: ['gamble'] },
        outcomes: {
          critSuccess: {
            text: 'Jusk cleans out the whole watch, then — showing rare wisdom — buys every loser a drink with their own money. They part friends, somehow. The purse is heavy.',
            outcomes: [
              { type: 'silver', delta: 30 },
              { type: 'stress', delta: -2 },
            ],
          },
          success: {
            text: 'Jusk wins steadily, folds early, and quits while the guards are still laughing. A tidy sum and no hard feelings — his kind of night.',
            outcomes: [
              { type: 'silver', delta: 12 },
              { type: 'stress', delta: -1 },
            ],
          },
          failure: {
            text: 'The dice go cold and Jusk chases them, as he always chases them. He loses his purse and a measure of the company’s silver he had no business carrying.',
            outcomes: [{ type: 'silver', delta: -15 }, { type: 'stress', delta: 2 }],
          },
          critFailure: {
            text: 'Jusk accuses the biggest guard of loaded dice — one throw too late to be principle. The game ends in a heap. The caravan leaves early, offended, and Jusk eats through a split lip for a week.',
            outcomes: [
              { type: 'silver', delta: -20 },
              { type: 'health', delta: -1 },
              { type: 'stress', delta: 3 },
            ],
          },
        },
      },
      {
        label: 'Haul him out of the circle before the first throw.',
        outcomes: {
          success: {
            text: 'Jusk goes quietly, which is worse than a scene. He spends the evening flipping a coin by himself at the fire, catching it without looking, saying nothing.',
            outcomes: [{ type: 'stress', delta: 2 }],
          },
        },
      },
    ],
  },
  {
    id: 'hero_quarrel',
    category: 'hero',
    illustration: 'quarrel_fire',
    title: 'Bad Blood at the Fire',
    text: 'It has been building for weeks — the frontier grinds everyone’s edges against everyone else’s. Tonight it breaks: {hero} and another of the company, on their feet across the fire, voices carrying to the treeline. The rest of the company is carefully looking elsewhere. Somebody needs to end this before it becomes a habit, or a knife.',
    conditions: [{ type: 'anyHeroStressAtLeast', value: 5 }, { type: 'partySizeAtLeast', value: 2 }],
    weight: 9,
    cooldownTurns: 6,
    binding: { type: 'highestStress' },
    choices: [
      {
        label: 'Step between them and settle it as their leader.',
        check: { skill: 'leadership', stat: 'resolve', difficulty: 10 },
        outcomes: {
          success: {
            text: 'Hard words, fair hearing, and a division of grievances so even-handed that both parties end up grumbling about you instead — together. By breakfast it’s a story, not a wound.',
            outcomes: [{ type: 'stress', delta: -2, allHeroes: true }],
          },
          failure: {
            text: 'Your intervention makes it formal, and formal grievances put down roots. The fire circle now has two sides, and everyone knows which side they sit on.',
            outcomes: [{ type: 'stress', delta: 1, allHeroes: true }],
          },
        },
      },
      {
        label: 'Let them shout it out. Storms clear the air.',
        outcomes: {
          success: {
            text: 'It burns loud and burns out. An hour later they are splitting wood on opposite sides of the yard, in the vast wordless sulk of people who will be sharing a blanket-tent all winter regardless.',
            outcomes: [{ type: 'stress', delta: 1 }],
          },
        },
      },
    ],
  },
  {
    id: 'hero_breakdown',
    category: 'chain',
    illustration: 'breakdown_dark',
    title: 'The Breaking Point',
    text: 'It happens over nothing — a dropped bowl, a wrong word — and then {hero} is somewhere else entirely: white-faced, shaking, or terribly, terribly still. The frontier has been collecting its debt in small coins for months and has now called in the whole sum. The company stands helpless around someone who has simply run out.',
    conditions: [],
    weight: 0,
    binding: { type: 'random' },
    choices: [
      {
        label: 'Take everything off their shoulders. Weeks of rest, no argument.',
        outcomes: {
          success: {
            text: 'No duties, no questions, meals brought to the tent. {hero} sleeps for most of a week and comes back slowly, from a long way away. Something is mended; something is changed.',
            outcomes: [
              { type: 'stress', delta: -6 },
              { type: 'addTrait', trait: 'shaken' },
              { type: 'history', text: 'Broke under the frontier’s weight, and was given time to mend.' },
            ],
          },
        },
      },
      {
        label: 'Ask them to hold together. The post needs every pair of hands.',
        check: { skill: 'leadership', stat: 'resolve', difficulty: 12 },
        outcomes: {
          success: {
            text: '{hero} looks at you for a long time, then nods once and picks the work back up. It is either the bravest thing you’ve seen or the cruelest thing you’ve done. Perhaps both.',
            outcomes: [
              { type: 'stress', delta: -4 },
              { type: 'history', text: 'Held together through the worst of it, because they were asked to.' },
            ],
          },
          failure: {
            text: '{hero} hears the words from very far away and shakes their head — not refusal, incapacity. In the morning their bedroll is empty and their pack is gone. The road home is long, and they took it alone.',
            outcomes: [
              { type: 'heroDeparts' },
              { type: 'stress', delta: 2, allHeroes: true },
            ],
          },
        },
      },
    ],
  },
];
