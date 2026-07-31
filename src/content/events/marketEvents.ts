// Market shock events (TRADING_ECONOMY_SPEC §3c). Ambient economy news that
// spawns a telegraphed price shock at a named, discovered market: a `lead` of
// rumor turns (no price move, shown on the Ledger) before the shock bites for
// `duration` turns. The opportunity is legible in the text — name the market
// and the good — so the player can ready a caravan. Category 'post' (they enter
// the ordinary weighted pool); gated on the market being reachable ('visited').

import type { GameEvent } from '../../engine/events/types';
import { makeChoiceEvent } from './eventHelpers';

export const MARKET_EVENTS: GameEvent[] = [
  makeChoiceEvent({
    id: 'market_garrison_salt_short',
    category: 'post',
    illustration: 'market_news',
    title: 'Word from Thornwatch',
    text: 'A bargeman ties up at your landing with news and a dry throat. The salt barges up from Port Iron have not come — a wreck at the rapids, they say, and the Company garrison at Thornwatch is rationing what little it has. Salt will fetch a soldier\'s ransom there before the season turns, if a caravan can reach the quay while the shortage holds.',
    conditions: [{ type: 'locationDiscovery', location: 'charter_landing', atLeast: 'visited' }],
    weight: 16,
    cooldownTurns: 7,
    factions: ['CHARTER_COMPANY'],
    choices: [
      {
        type: 'flat',
        label: 'Mark it in the ledger and watch the road.',
        text: 'You note the market and the day. Salt is dear at Thornwatch now — and dearer still by the time word spreads.',
        outcomes: [{ type: 'marketShock', location: 'charter_landing', good: 'salt', mod: 1.8, lead: 2, duration: 5 }],
      },
    ],
  }),
  makeChoiceEvent({
    id: 'market_fur_glut',
    category: 'post',
    illustration: 'market_news',
    title: 'A Great Hunt',
    text: 'The Hanjoda ranges have had a season of plenty. Herds moved early, the hunting was fat, and the drying-racks at the Ashcircle sag under more pelts than the horse-tribes can trade away. A trader with silver and a spare caravan could buy furs there for coppers now — and sell them east, where the Company always wants more.',
    conditions: [{ type: 'locationDiscovery', location: 'hill_fort', atLeast: 'visited' }],
    weight: 14,
    cooldownTurns: 7,
    peoples: ['hanjoda'],
    choices: [
      {
        type: 'flat',
        label: 'Send word ahead to buy while the pelts are cheap.',
        text: 'Furs are worth next to nothing at the Ashcircle until the glut clears. Buy low.',
        outcomes: [{ type: 'marketShock', location: 'hill_fort', good: 'furs', mod: 0.5, lead: 1, duration: 4 }],
      },
    ],
  }),
  makeChoiceEvent({
    id: 'market_tools_starved_hills',
    category: 'post',
    illustration: 'market_news',
    title: 'The Hills Want Iron',
    text: 'A Hanjoda rider waters his horse at your well and talks while it drinks. A feud has broken two of the plateau bands\' smithies, and the Ashcircle is short of blades, points, and good tools before the raiding season. They will pay in furs, in silver, in whatever a trader asks — for anyone who brings iron up the Shattered Road soon.',
    conditions: [{ type: 'locationDiscovery', location: 'hill_fort', atLeast: 'visited' }],
    weight: 14,
    cooldownTurns: 8,
    peoples: ['hanjoda'],
    choices: [
      {
        type: 'flat',
        label: 'Load tools while the Company sells them cheap.',
        text: 'Tools will fetch a fortune at the Ashcircle until the smithies mend. Buy them dear nowhere, sell them dear there.',
        outcomes: [{ type: 'marketShock', location: 'hill_fort', good: 'tools', mod: 1.9, lead: 2, duration: 5 }],
      },
    ],
  }),
  makeChoiceEvent({
    id: 'market_greyleaf_fever',
    category: 'post',
    illustration: 'market_news',
    title: 'Fever on the River',
    text: 'A marsh fever is moving through the river towns. Njaro-Matu has closed its smoke-houses and the rivermen chew Greyleaf against the shakes faster than the Black Mere margins can be cut. The bitter herb is worth three times its weight there now — and will be until the fever burns out or the physic runs dry.',
    conditions: [{ type: 'locationDiscovery', location: 'river_meet', atLeast: 'visited' }],
    weight: 14,
    cooldownTurns: 8,
    factions: ['RIVER_CLANS'],
    choices: [
      {
        type: 'flat',
        label: 'Gather what Greyleaf you can and make for the river.',
        text: 'Greyleaf is worth a fever\'s ransom at Njaro-Matu while the sickness holds.',
        outcomes: [{ type: 'marketShock', location: 'river_meet', good: 'herbs', mod: 1.9, lead: 1, duration: 4 }],
      },
    ],
  }),
  makeChoiceEvent({
    id: 'market_amber_fashion',
    category: 'post',
    illustration: 'market_news',
    title: 'A Taste for Amber',
    text: 'Word comes down the Black River that some governor\'s wife in Port Iron has taken to amber, and the whole creole quarter at Shackle Station means to follow the fashion. The far garrison is buying every scrap of jungle resin that reaches it, and paying homeland prices. It is a long haul up-river — but a caravan that makes it while the craze holds comes home rich.',
    conditions: [{ type: 'locationDiscovery', location: 'shackle_station', atLeast: 'visited' }],
    weight: 12,
    cooldownTurns: 9,
    factions: ['CHARTER_COMPANY'],
    choices: [
      {
        type: 'flat',
        label: 'Buy amber cheap from the Bejasi and run it up-river.',
        text: 'Amber will fetch a homeland price at Shackle Station until the fashion turns. The Bejasi sell it for a song.',
        outcomes: [{ type: 'marketShock', location: 'shackle_station', good: 'amber', mod: 1.7, lead: 2, duration: 6 }],
      },
    ],
  }),
  makeChoiceEvent({
    id: 'market_grain_dearth',
    category: 'post',
    illustration: 'market_news',
    title: 'Lean Months in the Badlands',
    text: 'The Sunspear country grows nothing, and this year even the trade that feeds it has thinned. The Blackstone camps are short of grain before the lean stretch is half done, and their javelin-throwers guard the approaches all the more jealously for it. Food will trade for silver, hides, or furs there — for a caravan willing to climb the badlands with full sacks.',
    conditions: [{ type: 'locationDiscovery', location: 'blackstone_plateau', atLeast: 'visited' }],
    weight: 12,
    cooldownTurns: 8,
    peoples: ['hanjoda'],
    choices: [
      {
        type: 'flat',
        label: 'Fill the sacks and make for the plateau.',
        text: 'Grain is dear in the badlands until the season turns. Carry it up while the dearth holds.',
        outcomes: [{ type: 'marketShock', location: 'blackstone_plateau', good: 'grain', mod: 1.7, lead: 2, duration: 6 }],
      },
    ],
  }),
];
