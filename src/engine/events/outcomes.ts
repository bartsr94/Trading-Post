// Applies typed outcome effects to the game state and returns human-readable
// log lines for the event panel and turn report.

import { TUNING } from '../../content/tuning';
import { addBuildProgress, advanceTier, grantBuilding } from '../buildings';
import {
  applyDiplomacyShift,
  diplomacySeatStateById,
  isFirstContact,
  queueFirstContact,
  setDiplomacyPactById,
} from '../diplomacy';
import {
  addChild,
  addDependant,
  comeOfAge,
  dominantHeritage,
  formUnion,
  graphNode,
  removeDependant,
} from '../family';
import { createIncomingRaid, setTribute } from '../raids';
import { addResidents, addTransientGroup, adjustContentment, loseResidents } from '../residents';
import { departCharacter, recruitCharacter } from '../roster';
import { Rng } from '../rng';
import { clamp, getHero, livingHeroes, nextDiscovery, oppositeGender } from '../types';
import type {
  BuildingId,
  DiscoveryState,
  ExpeditionState,
  GameState,
  Gender,
  GoodId,
  Heritage,
  LocationDef,
  LocationId,
  RecruitDef,
} from '../types';
import type { Outcome } from './types';

export interface OutcomeContext {
  heroId: string;
  /** Set for travel events: outcomes hit the expedition's cargo and purse. */
  expedition?: ExpeditionState;
  /** Set for first-contact events: community outcomes default to this seat. */
  locationId?: LocationId;
  /** Content-provided display names, so the engine stays content-free. */
  goodNames: ReadonlyMap<GoodId, string>;
  factionNames: ReadonlyMap<string, string>;
  traitNames: ReadonlyMap<string, string>;
  locationNames: ReadonlyMap<LocationId, string>;
  locationDefs: ReadonlyMap<LocationId, LocationDef>;
  buildingNames: ReadonlyMap<BuildingId, string>;
  /** Recruit templates by id, so `recruitCharacter` stays content-free. */
  recruitDefs: ReadonlyMap<string, RecruitDef>;
  /** A dependant name for a people + gender, picked deterministically by seed. */
  dependantName: (heritage: Heritage, gender: Gender, seed: number) => string;
  /** The turn's RNG when applied from an event (absent when called directly). */
  rng?: Rng;
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
      case 'communityStanding': {
        const location = outcome.location ?? ctx.locationId ?? ctx.expedition?.destination;
        if (!location) break;
        const def = ctx.locationDefs.get(location);
        if (!def?.faction) break;
        applyDiplomacyShift(state, ctx.locationDefs, location, outcome.delta);
        log.push(
          `${ctx.locationNames.get(location) ?? location} standing ${signed(outcome.delta)}`,
        );
        break;
      }
      case 'communityGrievance': {
        const location = outcome.location ?? ctx.locationId ?? ctx.expedition?.destination;
        if (!location) break;
        const seat = diplomacySeatStateById(state, location);
        if (!seat) break;
        seat.grievances = Math.max(0, seat.grievances + outcome.delta);
        seat.lastContactTurn = state.turn;
        log.push(
          `${ctx.locationNames.get(location) ?? location} ${outcome.delta >= 0 ? 'remembers the slight' : 'lets an old slight rest'}`,
        );
        break;
      }
      case 'communityPact': {
        const location = outcome.location ?? ctx.locationId ?? ctx.expedition?.destination;
        if (!location) break;
        const seat = diplomacySeatStateById(state, location);
        if (!seat) break;
        setDiplomacyPactById(state, location, outcome.pact);
        log.push(
          outcome.pact === 'none'
            ? `${ctx.locationNames.get(location) ?? location} pact lapses`
            : `${ctx.locationNames.get(location) ?? location} pact: ${outcome.pact}`,
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
        if (added > 0) {
          const tagNote = outcome.tag ? ` (${outcome.tag})` : '';
          log.push(`+${added} resident${added === 1 ? '' : 's'}${tagNote}`);
        } else log.push('No room for newcomers');
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
      case 'damageBuilding': {
        if (outcome.building) {
          const idx = state.buildings.indexOf(outcome.building);
          if (idx >= 0) {
            state.buildings.splice(idx, 1);
            log.push(`${ctx.buildingNames.get(outcome.building) ?? outcome.building} is damaged beyond use`);
          }
        }
        if (outcome.construction && state.construction) {
          const before = state.construction.progress;
          state.construction.progress = Math.max(0, before - outcome.construction);
          if (state.construction.progress !== before) log.push('Construction is set back');
        }
        break;
      }
      case 'startRaid': {
        if (!state.pendingRaid && !state.gameOver) {
          const rng = ctx.rng ?? new Rng(state.rngState);
          const raid = createIncomingRaid(state, rng, {
            faction: outcome.faction,
            severity: outcome.severity,
          });
          if (raid) {
            state.pendingRaid = raid;
            state.lastRaidTurn = state.turn;
            log.push(`${raid.band} descends on the post`);
          }
          if (!ctx.rng) state.rngState = rng.getState();
        }
        break;
      }
      case 'tribute': {
        setTribute(state, {
          faction: outcome.faction,
          direction: outcome.direction,
          silver: outcome.silver ?? 0,
          goods: { ...(outcome.goods ?? {}) },
        });
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
      case 'recruitCharacter': {
        const def = ctx.recruitDefs.get(outcome.templateId);
        if (def) {
          const joined = recruitCharacter(state, def, outcome.toActive);
          log.push(`${joined.name}, ${joined.epithet}, joins the company.`);
        }
        break;
      }
      case 'departCharacter': {
        const targetId = outcome.heroId ?? ctx.heroId;
        const target = state.heroes.find((h) => h.id === targetId);
        if (departCharacter(state, targetId) && target) {
          log.push(`${target.name} leaves the company.`);
        }
        break;
      }
      case 'addDependant': {
        const parentId = outcome.parentId ?? ctx.heroId;
        const subject = graphNode(state, parentId);
        const rand = () =>
          ctx.rng ? ctx.rng.next() : ((state.nextDependantId * 2654435761) >>> 0) / 0x100000000;
        const nameFor = (g: Gender, h: Heritage) =>
          ctx.dependantName(h, g, state.nextDependantId);

        if (outcome.kind === 'child') {
          const child = addChild(state, parentId, {
            nameFor,
            gender: outcome.gender,
            partnerId: outcome.otherParentId,
            rand,
          });
          if (child) log.push(`A child, ${child.name}, is born to the post.`);
          break;
        }
        if (outcome.kind === 'spouse' && outcome.union) {
          const heritage = outcome.heritage ?? (subject ? dominantHeritage(subject) : 'imanian');
          const spouseGender = outcome.gender ?? (subject ? oppositeGender(subject.gender) : 'female');
          const spouse = formUnion(state, parentId, {
            source: outcome.union,
            heritage,
            name: nameFor(spouseGender, heritage),
          });
          if (spouse && subject) log.push(`${subject.name} takes a spouse, ${spouse.name}.`);
          break;
        }
        // A plain kin/spouse with no union source (an aunt, a ward, a betrothed).
        const heritage = outcome.heritage ?? (subject ? dominantHeritage(subject) : 'imanian');
        const gender =
          outcome.gender ??
          (rand() < TUNING.family.pureFemaleChance ? 'female' : 'male');
        const dep = addDependant(state, {
          kind: outcome.kind,
          name: nameFor(gender, heritage),
          parentId,
          gender,
          heritage,
          ancestry: { peoples: [heritage] },
        });
        log.push(`${dep.name} joins ${subject?.name ?? 'the'} household.`);
        break;
      }
      case 'removeDependant': {
        if (outcome.dependantId) {
          if (removeDependant(state, outcome.dependantId)) log.push('A family member departs.');
          break;
        }
        const parentId = outcome.parentId ?? ctx.heroId;
        const target = state.dependants.find(
          (d) => d.parentId === parentId && (!outcome.kind || d.kind === outcome.kind),
        );
        if (target && removeDependant(state, target.id)) log.push(`${target.name} departs.`);
        break;
      }
      case 'formUnion': {
        const subjectId = outcome.subjectId ?? ctx.heroId;
        const subject = graphNode(state, subjectId);
        const heritage = outcome.heritage ?? (subject ? dominantHeritage(subject) : 'imanian');
        const spouseGender = subject ? oppositeGender(subject.gender) : 'female';
        const spouse = formUnion(state, subjectId, {
          source: outcome.source,
          heritage,
          name: ctx.dependantName(heritage, spouseGender, state.nextDependantId),
        });
        if (spouse && subject) log.push(`${subject.name} weds ${spouse.name}.`);
        break;
      }
      case 'comeOfAge': {
        const grown = comeOfAge(state, outcome.dependantId);
        if (grown) log.push(`${grown.name} comes of age at the post.`);
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
          const priorDiscovery = loc.discovery;
          loc.discovery = target;
          log.push(`${ctx.locationNames.get(locationId) ?? locationId} is now ${target}`);
          const seatDef = ctx.locationDefs.get(locationId);
          if (target === 'visited' && seatDef && isFirstContact(seatDef, priorDiscovery)) {
            queueFirstContact(state, seatDef, ctx.heroId);
          }
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
