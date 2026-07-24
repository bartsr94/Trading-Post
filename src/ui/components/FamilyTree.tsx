// The family tree (FAMILY_SPEC.md §10): a multi-generational view of one
// household — a head hero, their spouse(s), children, and grown descendants who
// have married and had children of their own. Opened as a focused overlay so it
// need not fit the no-scroll shell. Mixed-heritage nodes read as "A × B".

import {
  childrenOf,
  dominantHeritage,
  graphNode,
  isHeroNode,
  isMixed,
  nodePeoples,
  spousesOf,
} from '../../engine/family';
import type { FamilyNode } from '../../engine/family';
import type { Dependant, GameState, Heritage } from '../../engine/types';
import { pickPortraitKey, portraitUrl } from '../portraits';
import { Portrait } from './Portrait';

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function peopleLabel(peoples: Heritage[]): string {
  if (peoples.length <= 2) return peoples.map(cap).join(' × ');
  return `${peoples.slice(0, 2).map(cap).join(' × ')} …`;
}

function genderGlyph(node: FamilyNode): string {
  return node.gender === 'female' ? '♀' : '♂';
}

function hueOf(key: string): number {
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return ((hash % 360) + 360) % 360;
}

/** A dependant's face: real portrait art from their people+gender pool where one
 *  exists (deterministic by id), else the hash-hue initial tile. */
function DependantFace({ dep }: { dep: Dependant }) {
  const key = dep.portraitKey ?? pickPortraitKey(`${dominantHeritage(dep)}_${dep.gender}`, dep.id);
  const url = portraitUrl(key);
  if (url) return <img className="portrait-art" src={url} alt="" draggable={false} />;
  return (
    <span
      className="portrait-fallback"
      aria-hidden="true"
      style={{
        background: `linear-gradient(160deg, hsl(${hueOf(dep.name)}, 28%, 32%), hsl(${(hueOf(dep.name) + 40) % 360}, 30%, 16%))`,
      }}
    >
      {dep.name.charAt(0)}
    </span>
  );
}

function PersonTile({ node }: { node: FamilyNode }) {
  const peoples = nodePeoples(node);
  const mixed = isMixed(node);
  const dead = isHeroNode(node) && node.status !== 'active';
  const roleLabel = isHeroNode(node)
    ? node.epithet
    : node.kind === 'spouse'
      ? 'spouse'
      : node.kind === 'child'
        ? 'child'
        : node.comeOfAge
          ? 'grown kin'
          : 'kin';

  return (
    <div className={`ft-person${dead ? ' ft-dead' : ''}`} title={peopleLabel(peoples)}>
      <div className="ft-face">
        {isHeroNode(node) ? <Portrait hero={node} /> : <DependantFace dep={node} />}
      </div>
      <div className="ft-name">
        {node.name} <span className="dim">{genderGlyph(node)}</span>
      </div>
      <div className="ft-tags">
        <span className={mixed ? 'ft-mixed' : 'dim'}>{peopleLabel(peoples)}</span>
        {isHeroNode(node) && node.bloodline && (
          <span className={`ft-blood ${node.bloodline}`}>
            {node.bloodline === 'pure' ? 'Pure line' : 'Mixed line'}
          </span>
        )}
      </div>
      <div className="ft-role dim">{roleLabel}</div>
    </div>
  );
}

/** One person, their spouse(s), and the branch beneath them. Recurses into any
 *  grown child who has married and had children of their own.
 *
 *  `seen` is read-only here — it must never be mutated in place. React 19's
 *  StrictMode (see main.tsx) double-invokes a component's render function in
 *  development specifically to catch exactly this kind of impurity: mutating
 *  a shared object referenced by props means the second invocation sees the
 *  first invocation's mutations already applied (e.g. `seen.has(id)` already
 *  true), silently returning `null` instead of the real tree — this
 *  previously left the whole Family Tree modal blank in dev, for every
 *  household, not just a hero-to-hero one; only StrictMode's double-render
 *  ever exposed it, so it went unnoticed until an e2e test finally asserted
 *  on the modal's actual content. Each call instead builds its own extended
 *  copy to pass to any recursive children, leaving the caller's set intact. */
function Branch({
  game,
  id,
  seen,
}: {
  game: GameState;
  id: string;
  seen: ReadonlySet<string>;
}) {
  if (seen.has(id)) return null;
  const node = graphNode(game, id);
  if (!node) return null;

  const spouses = spousesOf(game, id).filter((s) => !seen.has(s.id));
  const nextSeen = new Set(seen);
  nextSeen.add(id);
  for (const s of spouses) nextSeen.add(s.id);

  // Children of this person (and its spouses), deduped by id.
  const kids = new Map<string, FamilyNode>();
  for (const c of childrenOf(game, id)) kids.set(c.id, c);
  for (const s of spouses) for (const c of childrenOf(game, s.id)) kids.set(c.id, c);

  return (
    <div className="ft-branch">
      <div className="ft-couple">
        <PersonTile node={node} />
        {spouses.map((s) => (
          <div key={s.id} className="ft-couple">
            <span className="ft-bond" aria-hidden="true">
              ═
            </span>
            <PersonTile node={s} />
          </div>
        ))}
      </div>
      {kids.size > 0 && (
        <div className="ft-children">
          {[...kids.values()].map((child) => {
            const grownMarried =
              !isHeroNode(child) &&
              child.kind === 'kin' &&
              child.comeOfAge === true &&
              spousesOf(game, child.id).length > 0;
            return grownMarried ? (
              <Branch key={child.id} game={game} id={child.id} seen={nextSeen} />
            ) : (
              <PersonTile key={child.id} node={child} />
            );
          })}
        </div>
      )}
    </div>
  );
}

export function FamilyTree({
  game,
  headId,
  onClose,
}: {
  game: GameState;
  headId: string;
  onClose: () => void;
}) {
  const head = graphNode(game, headId);
  return (
    <div className="ft-overlay" onClick={onClose}>
      <div className="ft-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ft-header">
          <h3 style={{ margin: 0 }}>{head ? `${head.name}’s Family` : 'Family'}</h3>
          <button className="small" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="ft-canvas">
          <Branch game={game} id={headId} seen={new Set()} />
        </div>
      </div>
    </div>
  );
}
