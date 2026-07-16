// Skill check resolution (spec §5): 2d6 + skill + governing stat + situational
// modifiers vs difficulty. The full breakdown is returned so the UI can show
// the math — visible dice are a design pillar.

import { TUNING } from '../content/tuning';
import type { Hero, SkillId, StatId, TraitDef } from './types';
import type { Rng } from './rng';

export type CheckTier = 'critSuccess' | 'success' | 'failure' | 'critFailure';

export interface CheckModifier {
  label: string;
  value: number;
}

export interface CheckResult {
  d1: number;
  d2: number;
  natural: number;
  skill: SkillId;
  skillValue: number;
  stat: StatId;
  statValue: number;
  mods: CheckModifier[];
  total: number;
  difficulty: number;
  margin: number;
  tier: CheckTier;
}

export function isSuccess(tier: CheckTier): boolean {
  return tier === 'success' || tier === 'critSuccess';
}

function tierFromMargin(margin: number): CheckTier {
  if (margin >= TUNING.checks.critSuccessMargin) return 'critSuccess';
  if (margin >= 0) return 'success';
  if (margin <= TUNING.checks.critFailureMargin) return 'critFailure';
  return 'failure';
}

/** Trait modifiers that apply to this check, matched by skill or by tag. */
export function traitModifiers(
  hero: Hero,
  traitDefs: ReadonlyMap<string, TraitDef>,
  skill: SkillId,
  tags: readonly string[],
): CheckModifier[] {
  const mods: CheckModifier[] = [];
  for (const traitId of hero.traits) {
    const def = traitDefs.get(traitId);
    if (!def) continue;
    for (const mod of def.checkMods) {
      const skillMatch = mod.skill !== undefined && mod.skill === skill;
      const tagMatch = mod.tag !== undefined && tags.includes(mod.tag);
      if (skillMatch || tagMatch) {
        mods.push({ label: mod.label, value: mod.value });
      }
    }
  }
  return mods;
}

export function resolveCheck(
  rng: Rng,
  hero: Hero,
  skill: SkillId,
  stat: StatId,
  difficulty: number,
  situationalMods: CheckModifier[] = [],
): CheckResult {
  const d1 = rng.d6();
  const d2 = rng.d6();
  const natural = d1 + d2;
  const skillValue = hero.skills[skill];
  const statValue = hero.stats[stat];
  const modTotal = situationalMods.reduce((sum, m) => sum + m.value, 0);
  const total = natural + skillValue + statValue + modTotal;
  const margin = total - difficulty;

  let tier = tierFromMargin(margin);
  // Natural 2 is always at least a failure; natural 12 always at least a success.
  if (natural === 2 && isSuccess(tier)) tier = 'failure';
  if (natural === 12 && !isSuccess(tier)) tier = 'success';

  return {
    d1,
    d2,
    natural,
    skill,
    skillValue,
    stat,
    statValue,
    mods: situationalMods,
    total,
    difficulty,
    margin,
    tier,
  };
}

/** One-line human-readable breakdown, e.g. `4+3 +Bargain 3 +Charm 2 = 12 vs 11 — Success`. */
export function checkBreakdown(result: CheckResult): string {
  const parts = [`${result.d1}+${result.d2}`];
  parts.push(`+${cap(result.skill)} ${result.skillValue}`);
  parts.push(`+${cap(result.stat)} ${result.statValue}`);
  for (const mod of result.mods) {
    parts.push(`${mod.value >= 0 ? '+' : '−'}${Math.abs(mod.value)} ${mod.label}`);
  }
  const tierLabel: Record<CheckTier, string> = {
    critSuccess: 'Critical Success',
    success: 'Success',
    failure: 'Failure',
    critFailure: 'Critical Failure',
  };
  return `${parts.join(' ')} = ${result.total} vs ${result.difficulty} — ${tierLabel[result.tier]}`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
