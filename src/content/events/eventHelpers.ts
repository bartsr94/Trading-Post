// Reusable GameEvent-assembly helpers for content authors (EVENT_TEXT_SEPARATION_SPEC.md).
// Pure data assembly only — no engine knowledge beyond the event data model
// itself, and no narrative/faction-specific assumptions, so any content file
// can import these. Domain specifics (which faction, which goods, which
// counter keys, choice labels) stay in the calling content file; these only
// factor out the repeated event/choice object wiring.

import type {
  Condition,
  EventCategory,
  EventCheck,
  GameEvent,
  HeroBinding,
  Outcome,
  TierResult,
} from '../../engine/events/types';
import type { FactionId, GoodId, Heritage } from '../../engine/types';

/** One-line builders for the handful of dominant simple `Outcome` shapes —
 *  cuts a `{ type: 'x', ... }` entry from a multi-line object literal to a
 *  single call without losing type safety (the return type is still
 *  `Outcome`, so `tsc` still catches mistakes) or requiring any external
 *  file/build step (EVENT_TEXT_SEPARATION_SPEC.md — a 2026-07-31 measurement
 *  found 1,132 such entries across content/events, the actual mass a
 *  reduction effort should target once prose externalization is off the
 *  table). Add a case here only once a shape is actually needed by real
 *  content, not speculatively for every `Outcome` variant. */
export const outcome = {
  silver: (delta: number): Outcome => ({ type: 'silver', delta }),
  good: (good: GoodId, delta: number): Outcome => ({ type: 'good', good, delta }),
  cargo: (good: GoodId, delta: number): Outcome => ({ type: 'cargo', good, delta }),
  expeditionSilver: (delta: number): Outcome => ({ type: 'expeditionSilver', delta }),
  standing: (faction: FactionId, delta: number): Outcome => ({ type: 'standing', faction, delta }),
  stress: (delta: number, allHeroes?: boolean): Outcome => ({ type: 'stress', delta, allHeroes }),
  health: (delta: number): Outcome => ({ type: 'health', delta }),
  history: (text: string): Outcome => ({ type: 'history', text }),
  heroCounter: (key: string, delta: number, heroId?: string): Outcome => ({ type: 'heroCounter', key, delta, heroId }),
  setFlag: (flag: string, value?: boolean): Outcome => ({ type: 'setFlag', flag, value }),
  continueChain: (eventId: string, heroId?: string): Outcome => ({ type: 'continueChain', eventId, heroId }),
  captureHero: (faction: FactionId, heroId?: string): Outcome => ({ type: 'captureHero', faction, heroId }),
  contentment: (delta: number): Outcome => ({ type: 'contentment', delta }),
  friction: (heritage: Heritage, delta: number): Outcome => ({ type: 'friction', heritage, delta }),
  figureCounter: (figureId: string, key: string, delta: number): Outcome => ({ type: 'figureCounter', figureId, key, delta }),
};

/** One choice in a `makeChoiceEvent` call — either check-gated (up to all
 *  four result tiers) or flat (a single always-taken outcome). Discriminated
 *  on `type`, matching the same-idiom unions already used everywhere else in
 *  this data model (`Outcome`, `Condition`, `HeroBinding`). Choices render in
 *  array order, so this array *is* the on-screen order — nothing reorders
 *  it. */
export type ChoiceSpec =
  | {
      type: 'checked';
      label: string;
      check: EventCheck;
      requires?: Condition[];
      /** Overrides the event's illustration once this choice resolves. */
      illustration?: string;
      critSuccess?: TierResult;
      success: TierResult;
      failure?: TierResult;
      critFailure?: TierResult;
    }
  | {
      type: 'flat';
      label: string;
      text: string;
      outcomes: Outcome[];
      requires?: Condition[];
      /** Overrides the event's illustration once this choice resolves. */
      illustration?: string;
    };

/** Assembles a `GameEvent` from an ordered list of choices, each
 *  independently checked or flat (EVENT_TEXT_SEPARATION_SPEC.md's "full
 *  rollout" follow-up — a 2026-07-31 measurement of the whole corpus found
 *  every one of the 110 events in `content/events/` reduces to this one
 *  shape; the two-shape split this replaced, one helper for "checked choice
 *  always first" and a separate one for lone flat choices, existed only
 *  because of that ordering assumption, not because the events actually
 *  needed two different mechanisms). Defaults `category`/`weight`/`binding`
 *  to the common chain-reaction values (`'chain'`/`0`/`{ type: 'random' }`)
 *  since that's the majority use, but every field is overridable. */
export function makeChoiceEvent(config: {
  id: string;
  category?: EventCategory;
  illustration: string;
  title: string;
  text: string;
  conditions?: Condition[];
  weight?: GameEvent['weight'];
  once?: boolean;
  cooldownTurns?: number;
  binding?: HeroBinding;
  factions?: FactionId[];
  peoples?: Heritage[];
  loreRef?: string[];
  arc?: string;
  choices: ChoiceSpec[];
}): GameEvent {
  return {
    id: config.id,
    category: config.category ?? 'chain',
    illustration: config.illustration,
    title: config.title,
    text: config.text,
    conditions: config.conditions ?? [],
    weight: config.weight ?? 0,
    once: config.once,
    cooldownTurns: config.cooldownTurns,
    binding: config.binding ?? { type: 'random' },
    factions: config.factions,
    peoples: config.peoples,
    loreRef: config.loreRef,
    arc: config.arc,
    choices: config.choices.map((c) =>
      c.type === 'checked'
        ? {
            label: c.label,
            check: c.check,
            requires: c.requires,
            illustration: c.illustration,
            outcomes: {
              // Only include tiers actually provided — Choice['outcomes']
              // treats an absent key differently from a present key with an
              // `undefined` value (the latter breaks Object.values()
              // iteration in content/events/index.ts's chain-reference
              // validation).
              ...(c.critSuccess ? { critSuccess: c.critSuccess } : {}),
              success: c.success,
              ...(c.failure ? { failure: c.failure } : {}),
              ...(c.critFailure ? { critFailure: c.critFailure } : {}),
            },
          }
        : {
            label: c.label,
            requires: c.requires,
            illustration: c.illustration,
            outcomes: { success: { text: c.text, outcomes: c.outcomes } },
          },
    ),
  };
}
