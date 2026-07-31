// Pure event-chain graph builder: groups authored events by `arc` and traces
// continueChain/queueEvent outcomes into edges. Backs two consumers —
// eventCatalog.generate.test.ts's unreachable-event check (chainTargetIds)
// and the Event Chain Viewer dev tool (ui/components/EventChainViewer.tsx,
// buildArcGraphs) — kept here as the single source of truth rather than
// letting either copy re-derive it.

import type { CheckTier } from '../../engine/checks';
import type { Choice, Condition, GameEvent } from '../../engine/events/types';

/** Every event id reached by some other event's `continueChain`/`queueEvent`
 *  outcome — i.e. never drawn organically, only entered mid-chain. */
export function chainTargetIds(events: readonly GameEvent[]): Set<string> {
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

export interface ChainEdge {
  choiceIndex: number;
  choiceLabel: string;
  /** null for a flat (no-check) choice, which only ever populates `success`. */
  tier: CheckTier | null;
  /** Resolved tier ?? choice ?? event illustration (same fallback the game
   *  itself uses — engine/turn.ts's ActiveEvent.illustration). */
  illustration: string;
  /** Whether this edge's illustration differs from the source event's own
   *  base image — the interesting case for "does this need its own art". */
  illustrationOverridden: boolean;
  kind: 'continueChain' | 'queueEvent' | null;
  targetId?: string;
  delayTurns?: number;
}

export interface ChainNode {
  event: GameEvent;
  edges: ChainEdge[];
  /** Reached only via another event's continueChain/queueEvent — not an
   *  organic/travel/engine-triggered entry point. */
  isChainTarget: boolean;
}

function buildEdges(event: GameEvent): ChainEdge[] {
  const edges: ChainEdge[] = [];
  event.choices.forEach((choice: Choice, choiceIndex) => {
    for (const [tierKey, result] of Object.entries(choice.outcomes)) {
      if (!result) continue;
      const tier = choice.check ? (tierKey as CheckTier) : null;
      const illustration = result.illustration ?? choice.illustration ?? event.illustration;
      const chainOutcome = result.outcomes.find(
        (o) => o.type === 'queueEvent' || o.type === 'continueChain',
      );
      edges.push({
        choiceIndex,
        choiceLabel: choice.label,
        tier,
        illustration,
        illustrationOverridden: illustration !== event.illustration,
        kind: chainOutcome ? (chainOutcome.type as 'queueEvent' | 'continueChain') : null,
        targetId: chainOutcome && 'eventId' in chainOutcome ? chainOutcome.eventId : undefined,
        delayTurns: chainOutcome?.type === 'queueEvent' ? chainOutcome.delayTurns : undefined,
      });
    }
  });
  return edges;
}

/** Groups every authored (`arc`-tagged) event into its arc, each carrying its
 *  outgoing chain edges. Root events (not another event's chain target) sort
 *  first within an arc so callers can render top-down without a separate
 *  pass. Events with no `arc` are omitted — this is a chain-visualization
 *  tool, not a full event listing (see eventCatalog.generate.test.ts for that). */
export function buildArcGraphs(events: readonly GameEvent[]): Map<string, ChainNode[]> {
  const targets = chainTargetIds(events);
  const byArc = new Map<string, ChainNode[]>();
  for (const event of events) {
    if (!event.arc) continue;
    const node: ChainNode = { event, edges: buildEdges(event), isChainTarget: targets.has(event.id) };
    const bucket = byArc.get(event.arc);
    if (bucket) bucket.push(node);
    else byArc.set(event.arc, [node]);
  }
  for (const nodes of byArc.values()) {
    nodes.sort((a, b) => Number(a.isChainTarget) - Number(b.isChainTarget));
  }
  return byArc;
}

/** Generic one-line rendering of a Condition for the viewer's gating summary
 *  — deliberately not the catalog's fuller per-type descriptions, just
 *  enough to see what gates a node at a glance. */
export function describeCondition(c: Condition): string {
  const { type, ...rest } = c as unknown as Record<string, unknown>;
  const parts = Object.entries(rest)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(', ');
  return parts ? `${String(type)}(${parts})` : String(type);
}
