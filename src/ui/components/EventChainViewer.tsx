// Event Chain Viewer (dev tool, cheat-mode gated — opened from a button in
// CheatConsole.tsx, same off-by-default gate). Answers "what does this event
// chain actually look like, and what art does it need" for arc-tagged event
// chains like content/events/goblin/ambush.ts's goblin_ambush arc, which
// otherwise only shows up as a flat id list in docs/EVENT_CATALOG.md's
// "Arcs" section.
//
// Modeled directly on FamilyTree.tsx's recursive-branch overlay (same
// ft-overlay/ft-modal/ft-header/ft-canvas shell, same cycle-guard
// discipline) rather than a graph-layout library — a chain is a small tree,
// same shape as a family branch, and that pattern is already proven here.

import { useState } from 'react';
import { ALL_EVENTS } from '../../content/events';
import { buildArcGraphs, describeCondition } from '../../content/events/chainGraph';
import type { ChainEdge, ChainNode } from '../../content/events/chainGraph';
import { eventArtUrl } from '../eventArt';
import { Illustration } from './Illustration';

const TIER_ABBR: Record<string, string> = {
  critSuccess: 'CS',
  success: 'S',
  failure: 'F',
  critFailure: 'CF',
};

/** Illustration key label — shown wherever an image is (or would be) so a
 *  missing asset is as visible as a present one, not just inferable from
 *  the placeholder tile's own key text. */
function AssetLabel({ assetKey }: { assetKey: string }) {
  const present = eventArtUrl(assetKey) !== undefined;
  return (
    <span className={`chain-asset-label${present ? '' : ' chain-asset-missing'}`} title={assetKey}>
      {assetKey} {present ? '✓' : '⚠ missing'}
    </span>
  );
}

function gatingSummary(node: ChainNode): string {
  const parts: string[] = [node.event.category];
  if (node.event.once) parts.push('once');
  if (node.event.cooldownTurns) parts.push(`cooldown ${node.event.cooldownTurns}`);
  if (node.event.conditions.length) {
    parts.push(node.event.conditions.map(describeCondition).join(' · '));
  }
  return parts.join(' — ');
}

function EdgeRow({ edge, nodesById }: { edge: ChainEdge; nodesById: Map<string, ChainNode> }) {
  const target = edge.targetId ? nodesById.get(edge.targetId) : undefined;
  return (
    <div className="chain-edge">
      <span className="chain-edge-choice" title={edge.choiceLabel}>
        {edge.tier ? <span className="chain-edge-tier">{TIER_ABBR[edge.tier]}</span> : null}
        {edge.choiceLabel}
      </span>
      {edge.illustrationOverridden && (
        <span className="chain-edge-thumb" title={edge.illustration}>
          <Illustration assetKey={edge.illustration} />
        </span>
      )}
      <AssetLabel assetKey={edge.illustration} />
      {edge.kind ? (
        <span className="chain-edge-arrow dim">
          {edge.kind === 'queueEvent' ? `⏳ +${edge.delayTurns}t →` : '→'}{' '}
          {target ? target.event.title : (edge.targetId ?? '?')}
        </span>
      ) : (
        <span className="chain-edge-end dim">(ends here)</span>
      )}
    </div>
  );
}

function NodeCard({ node }: { node: ChainNode }) {
  return (
    <div className="chain-card">
      <div className="chain-thumb">
        <Illustration assetKey={node.event.illustration} />
      </div>
      <div className="chain-card-body">
        <div className="chain-card-title">{node.event.title}</div>
        <div className="chain-card-id dim">{node.event.id}</div>
        <div className="chain-card-gating dim" title={gatingSummary(node)}>
          {gatingSummary(node)}
        </div>
        <AssetLabel assetKey={node.event.illustration} />
      </div>
    </div>
  );
}

/** One event and everything it leads to. `seen` is read-only — never
 *  mutated in place, matching FamilyTree.tsx's Branch (React 19 StrictMode
 *  double-invokes render, so an in-place mutation leaks across invocations
 *  and can silently drop the second render's output). */
function ChainBranch({
  node,
  nodesById,
  seen,
}: {
  node: ChainNode;
  nodesById: Map<string, ChainNode>;
  seen: ReadonlySet<string>;
}) {
  if (seen.has(node.event.id)) {
    return (
      <div className="chain-branch">
        <div className="dim" style={{ fontSize: '0.72rem' }}>↺ {node.event.id} (see above)</div>
      </div>
    );
  }
  const nextSeen = new Set(seen);
  nextSeen.add(node.event.id);

  return (
    <div className="chain-branch">
      <NodeCard node={node} />
      {node.edges.length > 0 && (
        <div className="chain-edges">
          {node.edges.map((edge, i) => {
            const target = edge.targetId ? nodesById.get(edge.targetId) : undefined;
            return (
              <div className="chain-edge-group" key={i}>
                <EdgeRow edge={edge} nodesById={nodesById} />
                {target && <ChainBranch node={target} nodesById={nodesById} seen={nextSeen} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ArcSection({ arc, nodes }: { arc: string; nodes: ChainNode[] }) {
  const nodesById = new Map(nodes.map((n) => [n.event.id, n]));
  const roots = nodes.filter((n) => !n.isChainTarget);
  return (
    <div className="chain-arc">
      <h4>{arc}</h4>
      <div className="chain-roots">
        {roots.map((root) => (
          <ChainBranch key={root.event.id} node={root} nodesById={nodesById} seen={new Set()} />
        ))}
      </div>
    </div>
  );
}

/** Matches the filter against the arc name or any of its events' id/title —
 *  a whole arc stays visible if anything in it matches, so e.g. searching
 *  "tumble" surfaces the goblin_ambush arc via its illustration-key match
 *  target text, and searching "ambush" surfaces it via the arc name itself. */
function arcMatches(arc: string, nodes: ChainNode[], needle: string): boolean {
  if (arc.toLowerCase().includes(needle)) return true;
  return nodes.some(
    (n) =>
      n.event.id.toLowerCase().includes(needle) ||
      n.event.title.toLowerCase().includes(needle) ||
      n.event.illustration.toLowerCase().includes(needle) ||
      n.edges.some((e) => e.illustration.toLowerCase().includes(needle)),
  );
}

export function EventChainViewer({ onClose }: { onClose: () => void }) {
  const [filter, setFilter] = useState('');
  const arcGraphs = buildArcGraphs(ALL_EVENTS);
  const allArcs = [...arcGraphs.entries()].sort(([a], [b]) => a.localeCompare(b));
  const needle = filter.trim().toLowerCase();
  const arcs = needle ? allArcs.filter(([arc, nodes]) => arcMatches(arc, nodes, needle)) : allArcs;

  return (
    <div className="ft-overlay" onClick={onClose}>
      <div className="ft-modal chain-viewer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ft-header">
          <h3 style={{ margin: 0 }}>Event Chains</h3>
          <button className="small" onClick={onClose}>Close</button>
        </div>
        <div className="ft-canvas">
          <input
            type="text"
            className="chain-filter"
            placeholder="Filter by arc, id, title, or illustration key…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {allArcs.length === 0 ? (
            <p className="dim">No authored `arc` groups yet.</p>
          ) : arcs.length === 0 ? (
            <p className="dim">No arcs match "{filter}".</p>
          ) : (
            arcs.map(([arc, nodes]) => <ArcSection key={arc} arc={arc} nodes={nodes} />)
          )}
        </div>
      </div>
    </div>
  );
}
