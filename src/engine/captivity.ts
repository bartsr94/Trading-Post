// Abduction/captivity: shared helpers for the two triggers (an incoming raid
// on the post, an expedition arriving at a risky-faction destination). Pure —
// takes/returns RNG state like every other engine module, content-free beyond
// TUNING.abduction. Resolution timing reuses the existing chain-event
// `QueuedEvent`/`heroId`-pin mechanism directly (there is no authored-event
// context at either capture call site, so this pushes onto
// `state.queuedEvents` by hand rather than going through the `queueEvent`
// Outcome type).

import { TUNING } from '../content/tuning';
import type { Rng } from './rng';
import { isActiveHeroId } from './types';
import type { ExpeditionState, FactionId, GameState, Heritage, Hero, LocationDef } from './types';

/** Whether a faction's peoples are known to take captives (only male heroes,
 *  from RIVER_CLANS/BEASTFOLK in v1 — see TUNING.abduction.riskyFactions). */
export function isAbductionRiskyFaction(faction: FactionId | null | undefined): boolean {
  return !!faction && (TUNING.abduction.riskyFactions as readonly FactionId[]).includes(faction);
}

/** Whether a faction currently holds one of our named characters — gates the
 *  ransom diplomacy mission and the rescue raid goal. */
export function hasCaptiveHeldBy(state: GameState, faction: FactionId): boolean {
  return state.heroes.some((h) => h.status === 'captive' && h.captivity?.faction === faction);
}

/** The specific people attributed to a rare captor's-family arrival. Kiswani
 *  for RIVER_CLANS; BEASTFOLK covers two distinct species (unlike RIVER_CLANS,
 *  a single `Heritage`), so it gets an even roll — same convention `bandLabel`
 *  in `raids.ts` already uses for orc/goblin raid-flavor text. */
function captorHeritageFor(faction: FactionId, rng: Rng): Heritage {
  if (faction === 'BEASTFOLK') return rng.next() < 0.5 ? 'orc' : 'goblin';
  return 'kiswani';
}

/**
 * On a successful recovery (ransom or rescue) of a hero held long enough to
 * have gotten a grim-warning check-in, rolls a rare chance the captor's
 * family follows them home. Call after the hero is freed, before
 * `hero.captivity` would otherwise be needed — pass the turn they were
 * captured, since the field itself may already be cleared.
 */
export function maybeQueueKinArrival(
  state: GameState,
  hero: Hero,
  faction: FactionId,
  capturedTurn: number,
  rng: Rng,
): void {
  const a = TUNING.abduction;
  if (state.turn - capturedTurn < a.grimWarningThresholdTurns) return;
  if (rng.next() >= a.familyArrivalChance) return;
  state.queuedEvents.push({
    eventId: 'captive_kin_arrival',
    fireOnTurn: state.turn + 6 + rng.int(0, 6),
    heroId: hero.id,
    vars: { faction, captorHeritage: captorHeritageFor(faction, rng) },
  });
}

function isCapturable(hero: Hero): boolean {
  return hero.status === 'active' && hero.gender === 'male';
}

/**
 * Marks a hero captive and queues the chain event that resolves their fate —
 * a quick, no-action-needed release for lenient captors, or a longer "held"
 * check-in (the grim-warning beat) otherwise. Mutates `hero` and
 * `state.queuedEvents`; returns a report log line.
 */
export function captureHero(
  state: GameState,
  hero: Hero,
  faction: FactionId,
  source: 'raid' | 'expedition',
  rng: Rng,
): string {
  const a = TUNING.abduction;
  hero.status = 'captive';
  hero.captivity = { faction, capturedTurn: state.turn, source };

  const quickChance = a.quickReleaseChance[faction] ?? 0;
  if (rng.next() < quickChance) {
    const span = a.quickReleaseMaxTurns - a.quickReleaseMinTurns;
    const delay = a.quickReleaseMinTurns + (span > 0 ? rng.int(0, span) : 0);
    state.queuedEvents.push({
      eventId: 'captive_quick_release',
      fireOnTurn: state.turn + delay,
      heroId: hero.id,
      vars: { faction, capturedTurn: state.turn },
    });
  } else {
    state.queuedEvents.push({
      eventId: 'captive_check_in',
      fireOnTurn: state.turn + a.grimWarningThresholdTurns,
      heroId: hero.id,
      vars: { faction, capturedTurn: state.turn },
    });
  }
  return `${hero.name} is taken captive.`;
}

/**
 * Rolls whether a qualifying male hero is captured on arrival at a
 * risky-faction expedition destination, reduced per escorted guard. Skipped
 * entirely for a `raid`-kind expedition whose goal is already `rescue` (that
 * mission shouldn't risk minting a second captive on the way to freeing the
 * first). Mutates the expedition's `heroIds` and the captured hero on a hit;
 * returns a report line, or null if nobody was taken.
 */
export function rollAbductionRisk(
  state: GameState,
  expedition: ExpeditionState,
  def: Pick<LocationDef, 'faction' | 'tags'> | undefined,
  rng: Rng,
): string | null {
  if (!def) return null;
  if (expedition.kind === 'raid' && expedition.raidGoal === 'rescue') return null;
  const faction: FactionId | null = def.faction ?? (def.tags.includes('beastfolk') ? 'BEASTFOLK' : null);
  if (!isAbductionRiskyFaction(faction)) return null;

  const candidates = expedition.heroIds
    .map((id) => state.heroes.find((h) => h.id === id))
    .filter((h): h is Hero => !!h && isCapturable(h));
  if (candidates.length === 0) return null;

  const a = TUNING.abduction;
  const guards = expedition.residentEscort?.guards ?? 0;
  const chance = Math.max(
    a.expeditionCaptureChanceFloor,
    a.expeditionCaptureChanceBase - guards * a.expeditionCaptureChancePerGuard,
  );
  if (rng.next() >= chance) return null;

  const hero = candidates[rng.int(0, candidates.length - 1)];
  const line = captureHero(state, hero, faction as FactionId, 'expedition', rng);
  expedition.heroIds = expedition.heroIds.filter((id) => isActiveHeroId(state, id));
  return line;
}
