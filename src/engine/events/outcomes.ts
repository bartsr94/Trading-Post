// Applies typed outcome effects to the game state and returns human-readable
// log lines for the event panel and turn report.

import { TUNING } from '../../content/tuning';
import { addBuildProgress, advanceTier, grantBuilding } from '../buildings';
import { addResidents, addTransientGroup, adjustContentment, loseResidents } from '../residents';
import { clamp, getHero, livingHeroes, nextDiscovery } from '../types';
import type {
  BuildingId,
  DiscoveryState,
  ExpeditionState,
  GameState,
  GoodId,
  LocationId,
} from '../types';
import type { Outcome } from './types';

export interface OutcomeContext {
  heroId: string;
  /** Set for travel events: outcomes hit the expedition's cargo and purse. */
  expedition?: ExpeditionState;
  /** Content-provided display names, so the engine stays content-free. */
  goodNames: ReadonlyMap<GoodId, string>;
  factionNames: ReadonlyMap<string, string>;
  traitNames: ReadonlyMap<string, string>;
  locationNames: ReadonlyMap<LocationId, string>;
  buildingNames: ReadonlyMap<BuildingId, string>;
}

export function applyOutcomes(
  state: GameState,
  outcomes: readonly Outcome[],
  ctx: OutcomeContext,
): string[] {
  const log: string[] = [];
  const hero = getHero(state, ctx.heroId);

  for (const outcome of outcomes) {
    switch (outcome.type) {
      case 'silver': {
        state.silver = Math.max(0, state.silver + outcome.delta);
        log.push(`${signed(outcome.delta)} silver`);
        break;
      }
      case 'good': {
        state.goods[outcome.good] = Math.max(0, state.goods[outcome.good] + outcome.delta);
        log.push(`${signed(outcome.delta)} ${ctx.goodNames.get(outcome.good) ?? outcome.good}`);
        break;
      }
      case 'standing': {
        const faction = state.factions[outcome.faction];
        faction.standing = clamp(faction.standing + outcome.delta, -100, 100);
        log.push(
          `${ctx.factionNames.get(outcome.faction) ?? outcome.faction} standing ${signed(outcome.delta)}`,
        );
        break;
      }
      case 'axis': {
        state.axes[outcome.axis] = clamp(state.axes[outcome.axis] + outcome.delta, -10, 10);
        const label =
          outcome.axis === 'integration'
            ? outcome.delta > 0
              ? 'The post grows more integrated'
              : 'The post grows more aloof'
            : outcome.axis === 'communal'
              ? outcome.delta > 0
                ? 'The post feels more like a home'
                : 'The post grows more mercantile'
              : outcome.delta > 0
                ? 'The post takes on a more Sauromatian character'
                : 'The post holds to its Imanian ways';
        log.push(label);
        break;
      }
      case 'addTrait': {
        if (!hero.traits.includes(outcome.trait)) {
          hero.traits.push(outcome.trait);
          log.push(`${hero.name} gains ${ctx.traitNames.get(outcome.trait) ?? outcome.trait}`);
        }
        break;
      }
      case 'removeTrait': {
        const idx = hero.traits.indexOf(outcome.trait);
        if (idx >= 0) {
          hero.traits.splice(idx, 1);
          log.push(`${hero.name} loses ${ctx.traitNames.get(outcome.trait) ?? outcome.trait}`);
        }
        break;
      }
      case 'health': {
        hero.health = clamp(hero.health + outcome.delta, 0, TUNING.condition.maxHealth);
        log.push(`${hero.name}: ${signed(outcome.delta)} health`);
        if (hero.health === 0 && hero.status === 'active') {
          hero.status = 'dead';
          hero.history.push(`Died in turn ${state.turn}.`);
          log.push(`☠ ${hero.name} has died.`);
        }
        break;
      }
      case 'stress': {
        const targets = outcome.allHeroes ? livingHeroes(state) : [hero];
        for (const t of targets) {
          t.stress = clamp(t.stress + outcome.delta, 0, TUNING.condition.maxStress);
        }
        log.push(
          `${outcome.allHeroes ? 'Everyone' : hero.name}: ${signed(outcome.delta)} stress`,
        );
        break;
      }
      case 'queueEvent': {
        state.queuedEvents.push({
          eventId: outcome.eventId,
          fireOnTurn: state.turn + outcome.delayTurns,
          ...(outcome.sameHero ? { heroId: hero.id } : {}),
        });
        break;
      }
      case 'setFlag': {
        state.flags[outcome.flag] = outcome.value ?? true;
        break;
      }
      case 'priceShock': {
        state.market[outcome.good].eventMod = outcome.mod;
        log.push(
          `${ctx.goodNames.get(outcome.good) ?? outcome.good} prices ${outcome.mod > 1 ? 'surge' : 'slump'}`,
        );
        break;
      }
      case 'addResidents': {
        const added = addResidents(state, outcome.role, outcome.count, outcome.tag, outcome.group);
        if (added > 0) log.push(`+${added} resident${added === 1 ? '' : 's'}`);
        else log.push('No room for newcomers');
        break;
      }
      case 'loseResidents': {
        const lost = loseResidents(state, outcome.role, outcome.count, outcome.group);
        if (lost > 0) log.push(`−${lost} resident${lost === 1 ? '' : 's'}`);
        break;
      }
      case 'contentment': {
        adjustContentment(state, outcome.delta);
        log.push(`Residents ${outcome.delta >= 0 ? 'heartened' : 'discontented'}`);
        break;
      }
      case 'addTransient': {
        addTransientGroup(state, outcome.kind, outcome.count, outcome.turns);
        break;
      }
      case 'advanceTier': {
        const tier = advanceTier(state);
        if (tier !== null) log.push('The post comes of age');
        break;
      }
      case 'completeBuilding': {
        if (grantBuilding(state, outcome.building)) {
          log.push(`${ctx.buildingNames.get(outcome.building) ?? outcome.building} is built`);
        }
        break;
      }
      case 'addBuildProgress': {
        addBuildProgress(state, outcome.delta);
        break;
      }
      case 'heroDeparts': {
        if (hero.status === 'active') {
          hero.status = 'departed';
          hero.history.push(`Left the company in turn ${state.turn}.`);
          log.push(`${hero.name} leaves the company.`);
        }
        break;
      }
      case 'history': {
        hero.history.push(outcome.text.replaceAll('{hero}', hero.name));
        break;
      }
      case 'discover': {
        const locationId = outcome.location ?? ctx.expedition?.destination;
        if (!locationId) break;
        const loc = state.locations[locationId];
        if (!loc) break;
        const target: DiscoveryState = outcome.to ?? nextDiscovery(loc.discovery);
        // Discovery only moves forward; outcomes never re-fog the map.
        const ladder: DiscoveryState[] = ['unknown', 'rumored', 'visited', 'known'];
        if (ladder.indexOf(target) > ladder.indexOf(loc.discovery)) {
          loc.discovery = target;
          log.push(`${ctx.locationNames.get(locationId) ?? locationId} is now ${target}`);
        }
        break;
      }
      case 'cargo': {
        const name = ctx.goodNames.get(outcome.good) ?? outcome.good;
        if (ctx.expedition) {
          const held = ctx.expedition.cargo[outcome.good] ?? 0;
          ctx.expedition.cargo[outcome.good] = Math.max(0, held + outcome.delta);
          log.push(`${signed(outcome.delta)} ${name} (cargo)`);
        } else {
          state.goods[outcome.good] = Math.max(0, state.goods[outcome.good] + outcome.delta);
          log.push(`${signed(outcome.delta)} ${name}`);
        }
        break;
      }
      case 'expeditionSilver': {
        if (ctx.expedition) {
          ctx.expedition.silver = Math.max(0, ctx.expedition.silver + outcome.delta);
          log.push(`${signed(outcome.delta)} silver (carried)`);
        } else {
          state.silver = Math.max(0, state.silver + outcome.delta);
          log.push(`${signed(outcome.delta)} silver`);
        }
        break;
      }
      case 'delayExpedition': {
        if (ctx.expedition) {
          ctx.expedition.turnsLeft += outcome.turns;
          log.push(`The party is delayed ${outcome.turns} turn${outcome.turns === 1 ? '' : 's'}`);
        }
        break;
      }
    }
  }

  return log;
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}
