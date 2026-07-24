/// <reference types="node" />
// Generates docs/EVENT_CATALOG.md from the live event registry — never
// hand-edit that file. Runs as part of `npm test` (so the catalog can never
// drift out of sync with content) and can be run alone via `npm run catalog`.
// See docs/ADDING_EVENTS.md for the authoring conventions this reads
// (`peoples`/`factions`/`loreRef` on GameEvent) and how to extend this
// script when a new engine-hand-built trigger or condition/outcome shape
// is added.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Choice, Condition, GameEvent, Outcome } from '../../engine/events/types';
import { FACTION_IDS, type FactionId } from '../../engine/types';
import { HERITAGES } from '../../engine/types';
import { BEASTFOLK_EVENTS } from './beastfolkEvents';
import { CAPTIVE_EVENTS } from './captiveEvents';
import { DIPLOMACY_EVENTS } from './diplomacyEvents';
import { FAMILY_EVENTS } from './familyEvents';
import { GENERIC_HERO_EVENTS, HERO_EVENTS } from './heroEvents';
import { POST_EVENTS } from './postEvents';
import { RAID_EVENTS } from './raidEvents';
import { RECRUIT_EVENTS } from './recruitEvents';
import { SEASON_EVENTS } from './seasonEvents';
import { THRALL_EVENTS } from './thrallEvents';
import { TRAVEL_EVENTS } from './travelEvents';

const OUTPUT_PATH = new URL('../../../docs/EVENT_CATALOG.md', import.meta.url);

// Keep this list in sync with anywhere engine code hand-builds a
// QueuedEvent/ActiveEvent for a content event id rather than going through
// the normal weighted-draw pool or an authored queueEvent/continueChain
// outcome. As of this writing: turn.ts (hero_breakdown, on stress overflow),
// diplomacy.ts (post_first_contact, on first contact with a community), and
// captivity.ts (the three captive_* stages). Grep engine/*.ts for a literal
// content event id string if this list needs updating.
const ENGINE_TRIGGERED_EVENT_IDS = new Set([
  'hero_breakdown',
  'post_first_contact',
  'captive_quick_release',
  'captive_check_in',
  'captive_kin_arrival',
]);

// Mirrors content/events/index.ts's ALL_EVENTS composition — keep in sync
// with that file if a new event group is ever added.
const GROUPS: { label: string; events: readonly GameEvent[] }[] = [
  { label: 'postEvents.ts', events: POST_EVENTS },
  { label: 'heroEvents.ts (HERO_EVENTS)', events: HERO_EVENTS },
  { label: 'heroEvents.ts (GENERIC_HERO_EVENTS)', events: GENERIC_HERO_EVENTS },
  { label: 'recruitEvents.ts', events: RECRUIT_EVENTS },
  { label: 'familyEvents.ts', events: FAMILY_EVENTS },
  { label: 'seasonEvents.ts', events: SEASON_EVENTS },
  { label: 'travelEvents.ts', events: TRAVEL_EVENTS },
  { label: 'beastfolkEvents.ts', events: BEASTFOLK_EVENTS },
  { label: 'raidEvents.ts', events: RAID_EVENTS },
  { label: 'diplomacyEvents.ts', events: DIPLOMACY_EVENTS },
  { label: 'captiveEvents.ts', events: CAPTIVE_EVENTS },
  { label: 'thrallEvents.ts', events: THRALL_EVENTS },
];

const ALL_EVENTS: GameEvent[] = GROUPS.flatMap((g) => g.events);
const FACTION_ID_SET = new Set<string>(FACTION_IDS);
const HERITAGE_SET = new Set<string>(HERITAGES);

type Trigger =
  | 'organic-draw'
  | 'travel-arrival'
  | 'chain-continuation'
  | 'engine-hand-built'
  | 'unreachable?';

function chainTargets(events: readonly GameEvent[]): Set<string> {
  const targets = new Set<string>();
  for (const event of events) {
    for (const choice of event.choices) {
      for (const tier of Object.values(choice.outcomes)) {
        if (!tier) continue;
        for (const outcome of tier.outcomes) {
          if (outcome.type === 'queueEvent' || outcome.type === 'continueChain') {
            targets.add(outcome.eventId);
          }
        }
      }
    }
  }
  return targets;
}

function classifyTrigger(event: GameEvent, chainTargetIds: Set<string>): Trigger {
  if (event.category === 'travel') return 'travel-arrival';
  if (ENGINE_TRIGGERED_EVENT_IDS.has(event.id)) return 'engine-hand-built';
  if (chainTargetIds.has(event.id)) return 'chain-continuation';
  if (typeof event.weight === 'number' && event.weight === 0) return 'unreachable?';
  return 'organic-draw';
}

interface Touches {
  factions: Set<FactionId>;
  peoples: Set<string>;
  locations: Set<string>;
  buildings: Set<string>;
}

function collectConditionTouches(c: Condition, t: Touches): void {
  switch (c.type) {
    case 'standingAtLeast':
    case 'standingAtMost':
      t.factions.add(c.faction);
      break;
    case 'communityStandingAtLeast':
    case 'communityStandingAtMost':
    case 'communityGrievanceAtLeast':
    case 'communityGrievanceAtMost':
    case 'communityPactIs':
    case 'locationDiscovery':
      t.locations.add(c.location);
      break;
    case 'heroHeritageInParty':
      t.peoples.add(c.heritage);
      break;
    case 'hasBuilding':
    case 'lacksBuilding':
      t.buildings.add(c.building);
      break;
    default:
      break;
  }
}

function collectOutcomeTouches(o: Outcome, t: Touches): void {
  switch (o.type) {
    case 'standing':
    case 'tribute':
      t.factions.add(o.faction);
      break;
    case 'communityStanding':
    case 'communityGrievance':
    case 'communityPact':
      if (o.location) t.locations.add(o.location);
      break;
    case 'discover':
      if (o.location) t.locations.add(o.location);
      break;
    case 'completeBuilding':
      t.buildings.add(o.building);
      break;
    case 'damageBuilding':
      if (o.building) t.buildings.add(o.building);
      break;
    case 'addResidents':
    case 'loseResidents':
      if (o.group) t.peoples.add(o.group);
      break;
    case 'formUnion':
    case 'addDependant':
      if (o.heritage) t.peoples.add(o.heritage);
      break;
    case 'startRaid':
      if (o.faction) t.factions.add(o.faction);
      break;
    default:
      break;
  }
}

function collectChoiceTouches(choice: Choice, t: Touches): void {
  for (const tag of choice.check?.tags ?? []) {
    if (FACTION_ID_SET.has(tag)) t.factions.add(tag as FactionId);
  }
  for (const c of choice.requires ?? []) collectConditionTouches(c, t);
  for (const tier of Object.values(choice.outcomes)) {
    if (!tier) continue;
    for (const o of tier.outcomes) collectOutcomeTouches(o, t);
  }
}

function mechanicalTouches(event: GameEvent): Touches {
  const t: Touches = {
    factions: new Set(),
    peoples: new Set(),
    locations: new Set(),
    buildings: new Set(),
  };
  for (const c of event.conditions) collectConditionTouches(c, t);
  for (const choice of event.choices) collectChoiceTouches(choice, t);
  return t;
}

function fmtList(items: Iterable<string>): string {
  const arr = [...items];
  return arr.length ? arr.join(', ') : '—';
}

function describeConditions(conditions: Condition[]): string {
  if (!conditions.length) return 'none';
  return conditions
    .map((c) => {
      const { type, ...rest } = c as { type: string } & Record<string, unknown>;
      const parts = Object.entries(rest)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(',');
      return parts ? `${type}(${parts})` : type;
    })
    .join('; ');
}

describe('event catalog generator', () => {
  it('builds docs/EVENT_CATALOG.md from the live registry', () => {
    expect(ALL_EVENTS.length).toBeGreaterThan(0);

    const chainTargetIds = chainTargets(ALL_EVENTS);
    const oddities: string[] = [];
    const needsMetadata: string[] = [];

    const lines: string[] = [];
    lines.push('# Event Catalog');
    lines.push('');
    lines.push(
      '_Auto-generated by `npm run catalog` (src/content/events/eventCatalog.generate.test.ts) — do not hand-edit. See ADDING_EVENTS.md for the authoring conventions and metadata fields this reads._',
    );
    lines.push('');

    // Summary table
    lines.push('## Summary');
    lines.push('');
    lines.push('| Group | Events | Categories |');
    lines.push('|---|---|---|');
    for (const g of GROUPS) {
      const cats = new Map<string, number>();
      for (const e of g.events) cats.set(e.category, (cats.get(e.category) ?? 0) + 1);
      const catStr = [...cats.entries()].map(([c, n]) => `${c}:${n}`).join(', ');
      lines.push(`| ${g.label} | ${g.events.length} | ${catStr} |`);
    }
    lines.push(`| **Total** | **${ALL_EVENTS.length}** | |`);
    lines.push('');

    const triggerCounts = new Map<Trigger, number>();

    for (const g of GROUPS) {
      lines.push(`## ${g.label}`);
      lines.push('');
      for (const event of g.events) {
        const trigger = classifyTrigger(event, chainTargetIds);
        triggerCounts.set(trigger, (triggerCounts.get(trigger) ?? 0) + 1);
        if (trigger === 'unreachable?') {
          oddities.push(
            `${event.id}: category '${event.category}' with weight 0 but not an engine-hand-built id and not targeted by any queueEvent/continueChain — likely orphaned/unreachable.`,
          );
        }

        const touches = mechanicalTouches(event);
        const authoredFactions = new Set(event.factions ?? []);
        const authoredPeoples = new Set(event.peoples ?? []);
        const missingFactions = [...touches.factions].filter((f) => !authoredFactions.has(f));
        const missingPeoples = [...touches.peoples].filter(
          (p) => HERITAGE_SET.has(p) && !authoredPeoples.has(p as never),
        );
        if (missingFactions.length || missingPeoples.length) {
          needsMetadata.push(
            `${event.id}: mechanically touches faction(s) [${fmtList(missingFactions)}] / people(s) [${fmtList(missingPeoples)}] not listed in its authored \`factions\`/\`peoples\`.`,
          );
        }

        if (event.once && event.cooldownTurns) {
          oddities.push(`${event.id}: has both \`once: true\` and \`cooldownTurns\` — cooldown is dead once it's fired.`);
        }
        if (event.choices.length === 1) {
          oddities.push(`${event.id}: single-choice event — confirm it's meant to have no decline/alternative.`);
        }
        if (event.binding?.type === 'specific') {
          oddities.push(
            `${event.id}: binds a \`specific\` hero id (${event.binding.heroId}) — the legacy locked-hero pattern; new events should use generic binding (see hero_event_binding_convention).`,
          );
        }

        lines.push(`### \`${event.id}\``);
        lines.push('');
        lines.push(`- **Category / trigger:** ${event.category} — ${trigger}`);
        lines.push(
          `- **Weight/once/cooldown:** ${typeof event.weight === 'function' ? 'fn(state)' : event.weight}${event.once ? ', once' : ''}${event.cooldownTurns ? `, cooldown ${event.cooldownTurns}` : ''}`,
        );
        lines.push(`- **Binding:** ${event.binding ? JSON.stringify(event.binding) : 'default (random)'}`);
        lines.push(`- **Conditions:** ${describeConditions(event.conditions)}`);
        lines.push(`- **Choices:** ${event.choices.length}`);
        lines.push(
          `- **Mechanically touches:** factions=[${fmtList(touches.factions)}] peoples=[${fmtList(touches.peoples)}] locations=[${fmtList(touches.locations)}] buildings=[${fmtList(touches.buildings)}]`,
        );
        lines.push(
          `- **Authored metadata:** peoples=[${fmtList(event.peoples ?? [])}] factions=[${fmtList(event.factions ?? [])}] loreRef=[${fmtList(event.loreRef ?? [])}]`,
        );
        lines.push('');
      }
    }

    lines.push('## Trigger mechanism totals');
    lines.push('');
    for (const [trigger, count] of triggerCounts) {
      lines.push(`- ${trigger}: ${count}`);
    }
    lines.push('');

    lines.push('## Needs metadata (mechanically touches a faction/people not yet authored)');
    lines.push('');
    lines.push(
      needsMetadata.length
        ? needsMetadata.map((l) => `- ${l}`).join('\n')
        : '_None — every mechanical faction/people touch is reflected in authored metadata._',
    );
    lines.push('');

    lines.push('## Structural oddities');
    lines.push('');
    lines.push(oddities.length ? oddities.map((l) => `- ${l}`).join('\n') : '_None found._');
    lines.push('');

    const outPath = fileURLToPath(OUTPUT_PATH);
    const dir = dirname(outPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(outPath, lines.join('\n'), 'utf-8');
  });
});
