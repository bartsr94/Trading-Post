// Travel events (spec §9, §10): fired en route, at most one per expedition per
// turn. Bound heroes are always drawn from the travelling party.

import type { GameEvent } from '../../engine/events/types';

export const TRAVEL_EVENTS: GameEvent[] = [
  {
    id: 'travel_ford_washed_out',
    category: 'travel',
    illustration: 'flooded_ford',
    title: 'The Ford Is Gone',
    text: 'The river you crossed dry-shod a season ago is brown and loud, and the ford stones are somewhere under all of it. A drowned birch sweeps past, roots first. {hero} walks the bank, looking for a line across, while the pack straps get double-checked behind you.',
    conditions: [{ type: 'destinationTag', tag: 'river' }],
    weight: 10,
    cooldownTurns: 8,
    binding: { type: 'highestSkill', skill: 'survival' },
    choices: [
      {
        label: 'Let {hero} pick a crossing and take the party through.',
        check: { skill: 'survival', stat: 'wits', difficulty: 10, tags: ['river'] },
        outcomes: {
          critSuccess: {
            text: '{hero} reads the water like a ledger — a gravel bar, a slack seam, and everyone is across with dry cargo before noon. The story will grow in the telling.',
            outcomes: [{ type: 'history', text: 'Led the party across a flooded river.' }],
          },
          success: {
            text: 'Cold to the ribs and swearing, but across. Nothing lost except the feeling in your feet.',
            outcomes: [{ type: 'stress', delta: 1 }],
          },
          failure: {
            text: 'Halfway over, a mule panics and a pack tears loose. You watch a bale spin away downstream, absurdly fast, and haul the beast back to the bank you started from.',
            outcomes: [
              { type: 'cargo', good: 'hides', delta: -3 },
              { type: 'delayExpedition', turns: 1 },
              { type: 'stress', delta: 1 },
            ],
          },
          critFailure: {
            text: 'The line snaps. {hero} goes under, is dragged out fifty yards down with blood in the water, and the crossing is abandoned for a long, wet day.',
            outcomes: [
              { type: 'health', delta: -3 },
              { type: 'delayExpedition', turns: 1 },
              { type: 'stress', delta: 2 },
            ],
          },
        },
      },
      {
        label: 'Go the long way round by the old beaver meadows.',
        outcomes: {
          success: {
            text: 'A day lost to willow thickets and midge clouds. Dull, safe, and nobody drowns — the kind of decision no song ever gets written about.',
            outcomes: [{ type: 'delayExpedition', turns: 1 }],
          },
        },
      },
    ],
  },

  {
    id: 'travel_hill_toll',
    category: 'travel',
    illustration: 'hill_toll',
    title: 'The Price of the Path',
    text: 'They are waiting where the trail narrows between two boulders — five Dustwalkers with spears grounded, not raised. Their leader holds up a flat palm: the old sign for toll. This is their country, the gesture says, and your goods move through it at their pleasure.',
    conditions: [{ type: 'destinationTag', tag: 'hills' }],
    weight: 12,
    cooldownTurns: 8,
    binding: { type: 'highestSkill', skill: 'diplomacy' },
    factions: ['HILL_TRIBES'],
    peoples: ['hanjoda'],
    loreRef: ['Western Nomadic Tribes.md'],
    choices: [
      {
        label: 'Pay what they ask, with good grace.',
        outcomes: {
          success: {
            text: 'You count silver into the leader’s palm and add a twist of salt unasked. He studies you a moment, then names you to his men — a word you don’t know yet. The spears part.',
            outcomes: [
              { type: 'expeditionSilver', delta: -10 },
              { type: 'standing', faction: 'HILL_TRIBES', delta: 2 },
            ],
          },
        },
      },
      {
        label: 'Have {hero} talk the toll down, trader to herdsman.',
        check: { skill: 'diplomacy', stat: 'charm', difficulty: 10, tags: ['HILL_TRIBES', 'natives'] },
        outcomes: {
          success: {
            text: '{hero} admires the leader’s horses, asks after the herds, and somehow the toll becomes a gift of a few coins between almost-friends.',
            outcomes: [
              { type: 'expeditionSilver', delta: -4 },
              { type: 'standing', faction: 'HILL_TRIBES', delta: 1 },
            ],
          },
          failure: {
            text: 'Wrong word, wrong tone. The toll doubles, and the leader watches {hero} count it out coin by coin, unsmiling.',
            outcomes: [
              { type: 'expeditionSilver', delta: -20 },
              { type: 'stress', delta: 1 },
            ],
          },
        },
      },
      {
        label: 'Push through. The frontier belongs to the bold.',
        check: { skill: 'combat', stat: 'might', difficulty: 11, tags: ['intimidation', 'HILL_TRIBES'] },
        outcomes: {
          success: {
            text: 'You walk at them without breaking stride, hand on hilt, and their leader decides today is not worth the price of finding out. Word of it will travel, and not kindly.',
            outcomes: [{ type: 'standing', faction: 'HILL_TRIBES', delta: -5 }],
          },
          failure: {
            text: 'A spear butt takes {hero} across the shoulder and the party is herded back down the trail like strayed goats. You pay the toll anyway. The doubled one.',
            outcomes: [
              { type: 'health', delta: -2 },
              { type: 'expeditionSilver', delta: -20 },
              { type: 'standing', faction: 'HILL_TRIBES', delta: -5 },
            ],
          },
        },
      },
    ],
  },

  {
    id: 'travel_wolves_at_dusk',
    category: 'travel',
    illustration: 'wolf_eyes',
    title: 'Eyes Beyond the Fire',
    text: 'The mules smell them first. Then the firelight finds the eyes — four pairs, five, patient at the edge of the dark. Winter has been long in the high country, and the pack has decided you are worth studying. {hero} slides a hand toward the axe without haste.',
    conditions: [{ type: 'season', value: 'winter' }],
    weight: 10,
    cooldownTurns: 6,
    binding: { type: 'highestSkill', skill: 'combat' },
    choices: [
      {
        label: 'Stand to arms and drive them off.',
        check: { skill: 'combat', stat: 'might', difficulty: 9, tags: ['beasts'] },
        outcomes: {
          critSuccess: {
            text: 'A rush, a shriek, and it is over: one wolf dead in the snow and the rest gone like smoke. {hero} skins it by firelight. A good pelt, honestly earned.',
            outcomes: [
              { type: 'cargo', good: 'furs', delta: 1 },
              { type: 'history', text: 'Killed a winter wolf on the trail.' },
            ],
          },
          success: {
            text: 'Shouts, torches, one wild swing — and the pack thinks better of it. You sleep in shifts and count every mule at dawn.',
            outcomes: [{ type: 'stress', delta: 1 }],
          },
          failure: {
            text: 'They come from two sides at once. When it is done the wolves are gone, and so is a good deal of blood that used to be in {hero}.',
            outcomes: [
              { type: 'health', delta: -2 },
              { type: 'stress', delta: 1 },
            ],
          },
        },
      },
      {
        label: 'Feed the fire, tie the animals close, and outlast them.',
        check: { skill: 'survival', stat: 'resolve', difficulty: 8 },
        outcomes: {
          success: {
            text: 'A long night of thrown embers and no sleep. Toward dawn the eyes blink out, one pair at a time, called away to easier hunting.',
            outcomes: [{ type: 'stress', delta: 1 }],
          },
          failure: {
            text: 'At the grey hour a mule screams. The wolves take it — and the packs it carried — into the treeline, and there is nothing to do but listen.',
            outcomes: [
              { type: 'cargo', good: 'grain', delta: -4 },
              { type: 'stress', delta: 2 },
            ],
          },
        },
      },
    ],
  },

  {
    id: 'travel_quiet_camp',
    category: 'travel',
    illustration: 'camp_dusk',
    title: 'A Good Camp',
    text: 'Once in a while the frontier is kind: dry ground, sweet water, dead pine down and seasoned as if stacked for you. The fire draws well. Supper tastes like more than it is, and for one evening the ledger, the quota, and the road all belong to someone else.',
    conditions: [],
    weight: 5,
    cooldownTurns: 6,
    binding: { type: 'highestStress' },
    choices: [
      {
        label: 'Make an early night of it.',
        outcomes: {
          success: {
            text: 'Boots off, feet to the fire. {hero} hums something from home, badly, and no one minds at all.',
            outcomes: [{ type: 'stress', delta: -2 }],
          },
        },
      },
      {
        label: 'Send {hero} out with a snare line while the light lasts.',
        check: { skill: 'survival', stat: 'agility', difficulty: 9, tags: ['hunting'] },
        outcomes: {
          success: {
            text: 'Three hares and a grouse, cleaned and spitted. The party eats like aldermen and packs the rest.',
            outcomes: [
              { type: 'cargo', good: 'grain', delta: 2 },
              { type: 'stress', delta: -1 },
            ],
          },
          failure: {
            text: 'The snares come back empty and {hero} comes back scratched and short-tempered. The fire is still good.',
            outcomes: [{ type: 'stress', delta: -1 }],
          },
        },
      },
    ],
  },

  {
    id: 'travel_strangers_fire',
    category: 'travel',
    illustration: 'strangers_fire',
    title: 'A Fire on the Ridge',
    text: 'A spark of orange where no camp ought to be. Coming closer: three travellers, native but not of any band you know, with worn packs and a kettle already on. One raises an open hand — peace, or the look of it. On the frontier, every fire is a question.',
    conditions: [],
    weight: 8,
    cooldownTurns: 10,
    binding: { type: 'highestSkill', skill: 'diplomacy' },
    choices: [
      {
        label: 'Share their fire and trade news of the country.',
        check: { skill: 'diplomacy', stat: 'charm', difficulty: 9, tags: ['strangers', 'natives'] },
        outcomes: {
          critSuccess: {
            text: 'The kettle goes round past midnight. They talk of an old dig cut into the jungle rock east of here, amber-veined and vine-choked, and trace the way in the dirt for {hero} twice.',
            outcomes: [
              { type: 'discover', location: 'amber_shore', to: 'rumored' },
              { type: 'stress', delta: -1 },
            ],
          },
          success: {
            text: 'Guarded talk that loosens by degrees. You part at dawn knowing the trails ahead a little better and the country a little less empty.',
            outcomes: [{ type: 'stress', delta: -1 }],
          },
          failure: {
            text: 'The talk never finds its feet. You share tea in a silence with edges, and both camps keep one eye open all night.',
            outcomes: [{ type: 'stress', delta: 1 }],
          },
        },
      },
      {
        label: 'Give the fire a wide berth and walk on in the dark.',
        outcomes: {
          success: {
            text: 'You swing wide through wet bracken and put a ridge between you before making a cold camp. Whatever they were, they are someone else’s story now.',
            outcomes: [{ type: 'stress', delta: 1 }],
          },
        },
      },
    ],
  },

  {
    id: 'travel_broken_axle',
    category: 'travel',
    illustration: 'broken_cart',
    title: 'The Axle',
    text: 'It goes with a crack like green ice, on a slope, in the rain, because of course it does. The cart settles sideways and the load shifts against the lashings. {hero} crouches under it with a torch: the axle is split to the hub, and {destination} is still a long way off.',
    conditions: [
      { type: 'expeditionKind', kind: 'caravan' },
      { type: 'cargoUnitsAtLeast', qty: 5 },
    ],
    weight: 10,
    cooldownTurns: 8,
    binding: { type: 'highestSkill', skill: 'craft' },
    choices: [
      {
        label: 'Camp here and let {hero} shape a new axle from a standing tree.',
        check: { skill: 'craft', stat: 'might', difficulty: 10 },
        outcomes: {
          success: {
            text: 'A day of axe work, adze work, and language unfit for company. The new axle is ugly and true, and the cart rolls at first light.',
            outcomes: [{ type: 'delayExpedition', turns: 1 }],
          },
          failure: {
            text: 'The first attempt splits, the second binds. Two days gone, and the finished thing wobbles enough that some of the load walks the rest of the way on the mules’ backs — the rest stays cached under stones.',
            outcomes: [
              { type: 'delayExpedition', turns: 2 },
              { type: 'cargo', good: 'timber', delta: -2 },
              { type: 'stress', delta: 1 },
            ],
          },
        },
      },
      {
        label: 'Abandon the cart. Repack what the animals can carry and move.',
        outcomes: {
          success: {
            text: 'Cold arithmetic in the rain: what walks, what stays. You heap the remainder under the tipped cart and mark the spot, knowing exactly how such marks are honoured on the frontier.',
            outcomes: [
              { type: 'cargo', good: 'hides', delta: -3 },
              { type: 'cargo', good: 'grain', delta: -2 },
            ],
          },
        },
      },
    ],
  },

  {
    id: 'travel_marsh_lights',
    category: 'travel',
    illustration: 'marsh_lights',
    title: 'Lights Over the Marsh',
    text: 'Past midnight, {hero} shakes you awake without a word and points. Out over the black water, lights — pale green, moving slow and deliberate as lantern-bearers, where no path is. The native hands refuse to look at them. Somewhere far off, a bird calls that neither of you can name.',
    conditions: [{ type: 'destinationTag', tag: 'marsh' }],
    weight: 8,
    cooldownTurns: 12,
    binding: { type: 'highestSkill', skill: 'lore' },
    choices: [
      {
        label: 'Let {hero} read the signs, as the old books taught.',
        check: { skill: 'lore', stat: 'wits', difficulty: 10, tags: ['ritual'] },
        outcomes: {
          critSuccess: {
            text: '{hero} watches until the pattern shows itself: the lights walk the old causeways, sunk since before the Bejasi Hills folk withdrew into their jungle. By morning {hero} has sketched a dry line through the marsh no trader has used in a hundred years.',
            outcomes: [
              { type: 'history', text: 'Read the marsh lights and found the old causeway.' },
              { type: 'stress', delta: -1 },
            ],
          },
          success: {
            text: 'Old signs, half-remembered: the lights mean deep water and old grief, and the wise give both a margin. You move camp a quarter mile back and sleep poorly, but you sleep.',
            outcomes: [],
          },
          failure: {
            text: 'The books say nothing, or say too much. {hero} watches until dawn greys the water, and comes to breakfast with the look of someone who has been counting the lights and getting different answers.',
            outcomes: [{ type: 'stress', delta: 2 }],
          },
        },
      },
      {
        label: 'Wake everyone. Break camp and march away from it now.',
        outcomes: {
          success: {
            text: 'No one argues. You walk an hour in the dark with the lights at your back, and whatever they wanted, they keep it to themselves.',
            outcomes: [
              { type: 'delayExpedition', turns: 1 },
              { type: 'stress', delta: 1 },
            ],
          },
        },
      },
    ],
  },

  {
    id: 'travel_old_stones',
    category: 'travel',
    illustration: 'ruin_stones',
    title: 'The Standing Stones',
    text: 'The trail bends around them as if the ground itself gives way: a ring of grey stones, shoulder-high, older than the trees that lean over them. Something is carved on the leeward faces, worn soft by rain. The Bejasi Hills folk leave offerings at such places. {hero} has already stopped walking.',
    conditions: [{ type: 'destinationTag', tag: 'ruin' }],
    weight: 8,
    cooldownTurns: 12,
    binding: { type: 'highestSkill', skill: 'lore' },
    factions: ['OLD_PEOPLE'],
    peoples: ['kiswani'],
    loreRef: ['Bejasi Hills Settlements.md'],
    choices: [
      {
        label: 'Take an hour. Let {hero} study the carvings.',
        check: { skill: 'lore', stat: 'wits', difficulty: 10, tags: ['ritual'] },
        outcomes: {
          critSuccess: {
            text: 'Under the moss, a map — or a boast. Rivers, hills, and a mark {hero} recognises: the amber sign of the Bejasi Hills folk, set against a vine-choked cut to the east. {hero} copies every line.',
            outcomes: [
              { type: 'discover', location: 'amber_shore', to: 'rumored' },
              { type: 'history', text: 'Copied the carvings of the standing stones.' },
            ],
          },
          success: {
            text: 'Fragments come clear: names of dead bands, a tally of some old grief, a warning about winter. Knowledge with no buyer yet — but knowledge.',
            outcomes: [{ type: 'history', text: 'Studied the standing stones on the trail.' }],
          },
          failure: {
            text: 'The carvings keep their counsel. {hero} leans close for one last look and puts a boot through the offering-shelf below — dried flowers, a child’s bracelet of amber beads, scattered in the mud. You leave quickly.',
            outcomes: [
              { type: 'standing', faction: 'OLD_PEOPLE', delta: -3 },
              { type: 'stress', delta: 1 },
            ],
          },
        },
      },
      {
        label: 'Leave a pinch of salt at the base and pass by respectfully.',
        outcomes: {
          success: {
            text: 'Trade goods for goodwill, in whatever coin the place accepts. The party walks a little easier the rest of the day, which is worth exactly what you paid.',
            outcomes: [
              { type: 'cargo', good: 'salt', delta: -1 },
              { type: 'standing', faction: 'OLD_PEOPLE', delta: 1 },
            ],
          },
        },
      },
    ],
  },

  {
    id: 'travel_road_home',
    category: 'travel',
    illustration: 'road_home',
    title: 'The Last Ridge',
    text: 'From this ridge, on a clear day, you can just make out the smoke of home — a grey thread on the horizon that every eye in the party keeps finding without meaning to. The animals feel it too and lean into the pace. It would be easy to push on into the dark.',
    conditions: [{ type: 'expeditionLeg', leg: 'returning' }],
    weight: 6,
    cooldownTurns: 10,
    binding: { type: 'random' },
    choices: [
      {
        label: 'Push on through the night and be home by morning.',
        check: { skill: 'survival', stat: 'resolve', difficulty: 9 },
        outcomes: {
          success: {
            text: 'A cold march under stars, boots found by feel. When the palisade — such as it is — comes out of the dawn mist, somebody raises a ragged cheer.',
            outcomes: [{ type: 'stress', delta: -1 }],
          },
          failure: {
            text: 'A wrong turn in the dark costs three hours; a turned ankle costs more. You limp in no faster than if you had slept, and considerably worse-tempered.',
            outcomes: [
              { type: 'health', delta: -1 },
              { type: 'stress', delta: 1 },
            ],
          },
        },
      },
      {
        label: 'Make a proper camp. Home will keep one more night.',
        outcomes: {
          success: {
            text: 'One last fire on the trail, and the particular pleasure of a journey nearly done. {hero} recounts the whole trip as if everyone present had not also been there. Nobody minds.',
            outcomes: [{ type: 'stress', delta: -1 }],
          },
        },
      },
    ],
  },
  {
    id: 'travel_beastfolk_toll',
    category: 'travel',
    illustration: 'gnawback_toll',
    title: 'The Gnawback Toll',
    text: 'They don\'t wait at a narrow place the way the hill folk do — an orc and two goblins simply fall in alongside the party out of the scrub, matching pace, unhurried, until the orc names a price for the rest of the walk unmolested. No chief sent them and none will answer for them; this toll is theirs alone to keep or break.',
    conditions: [{ type: 'destinationTag', tag: 'beastfolk' }],
    weight: 10,
    cooldownTurns: 8,
    binding: { type: 'highestSkill', skill: 'bargain' },
    factions: ['BEASTFOLK'],
    peoples: ['orc', 'goblin'],
    choices: [
      {
        label: 'Pay it and keep walking.',
        outcomes: {
          success: {
            text: 'You count it out without breaking stride. The goblins take it, the orc grunts something that might be thanks, and all three peel off back into the scrub as suddenly as they appeared.',
            outcomes: [
              { type: 'expeditionSilver', delta: -8 },
              { type: 'standing', faction: 'BEASTFOLK', delta: 1 },
            ],
          },
        },
      },
      {
        label: 'Haggle — three isn\'t a war-band, and they know it.',
        check: { skill: 'bargain', stat: 'wits', difficulty: 10, tags: ['BEASTFOLK'] },
        outcomes: {
          success: {
            text: '{hero} points out, mildly, that three of them against a whole party is a bad bet even before anyone reaches for a weapon. The orc considers this, shrugs, and settles for half of what he asked.',
            outcomes: [{ type: 'expeditionSilver', delta: -4 }],
          },
          failure: {
            text: 'The math doesn\'t land the way {hero} meant it to — the orc takes it as a threat rather than an argument, and the price goes up rather than down.',
            outcomes: [
              { type: 'expeditionSilver', delta: -16 },
              { type: 'stress', delta: 1 },
            ],
          },
        },
      },
      {
        label: 'Refuse outright and keep moving.',
        check: { skill: 'combat', stat: 'might', difficulty: 11, tags: ['intimidation', 'BEASTFOLK'] },
        outcomes: {
          success: {
            text: 'The party doesn\'t slow down, and after a few tense strides alongside, the three of them peel off rather than force the issue. Word of the refusal will reach the wilds before you do.',
            outcomes: [{ type: 'standing', faction: 'BEASTFOLK', delta: -3 }],
          },
          failure: {
            text: 'They force the issue after all — not a real fight, just enough of one to make the point, and the point costs more than the toll would have.',
            outcomes: [
              { type: 'health', delta: -2 },
              { type: 'expeditionSilver', delta: -16 },
              { type: 'standing', faction: 'BEASTFOLK', delta: -4 },
            ],
          },
        },
      },
    ],
  },
];
