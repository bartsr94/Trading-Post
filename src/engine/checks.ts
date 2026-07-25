// Skill check resolution (spec §5): 2d6 + skill + governing stat + situational
// modifiers vs difficulty. The full breakdown is returned so the UI can show
// the math — visible dice are a design pillar.

import { TUNING } from '../content/tuning';
import { cap, SKILL_GOVERNING } from './types';
import type { Hero, SkillId, StatId, TraitDef } from './types';
import type { Rng } from './rng';

export const CHECK_TIERS = ['critSuccess', 'success', 'failure', 'critFailure'] as const;
export type CheckTier = (typeof CHECK_TIERS)[number];

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

/** Of a skill's governing stats, the hero's best (activity checks use this). */
export function bestGoverningStat(hero: Hero, skill: SkillId): StatId {
  const options = SKILL_GOVERNING[skill];
  return options.reduce((a, b) => (hero.stats[b] > hero.stats[a] ? b : a));
}

/** Skills marked by successful checks grow at season's end. */
export function markSkill(hero: Hero, skill: SkillId): void {
  if (!hero.skillMarks.includes(skill)) hero.skillMarks.push(skill);
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

export interface HeroCheckOptions {
  skill: SkillId;
  difficulty: number;
  /** Check-modifier tags matched against the hero's traits. */
  tags?: readonly string[];
  /** Situational modifiers appended after trait mods (escort, pace, gifts, …). */
  extraMods?: CheckModifier[];
  /** Mark the skill for season-end growth on success (default true). */
  mark?: boolean;
}

/**
 * The shared "roll a hero check" preamble: pick the best governing stat, gather
 * this hero's trait modifiers for the skill/tags, roll, and mark the skill on
 * success. Trait mods come first, then `extraMods`, so the breakdown reads the
 * same as the hand-written call sites it replaces.
 */
export function heroCheck(
  rng: Rng,
  hero: Hero,
  traitDefs: ReadonlyMap<string, TraitDef>,
  opts: HeroCheckOptions,
): CheckResult {
  const stat = bestGoverningStat(hero, opts.skill);
  const mods = [
    ...traitModifiers(hero, traitDefs, opts.skill, opts.tags ?? []),
    ...(opts.extraMods ?? []),
  ];
  const check = resolveCheck(rng, hero, opts.skill, stat, opts.difficulty, mods);
  if ((opts.mark ?? true) && isSuccess(check.tier)) markSkill(hero, opts.skill);
  return check;
}
