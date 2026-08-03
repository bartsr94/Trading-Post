// Dependant Sheet (DEPENDANT_SHEET_SPEC.md): a lighter counterpart to
// HeroSheet.tsx for a married-in spouse, child, or grown kin — everything
// already on `Dependant` plus the generic family-graph selectors, no stats/
// skills/traits (dependants don't have them). A hero-to-hero spouse is a
// full `Hero` and keeps opening the full HeroSheet instead (see
// HeroSpouseTile there) — this sheet is for the Dependant node type only.

import { dominantHeritage, isHeroNode, isMixed, nodePeoples, childrenOf, parentsOf, spousesOf } from '../../engine/family';
import type { FamilyNode } from '../../engine/family';
import { cap } from '../../engine/types';
import type { Dependant, GameState, Heritage, UnionSource } from '../../engine/types';
import { pickDependantTemperament } from '../../content/temperament';
import { useGameStore } from '../../store/gameStore';
import { pickDependantPortraitKey, portraitUrl } from '../portraits';
import { HERITAGE_LABEL, SUBPEOPLE_LABEL } from './HeroSheet';

const KIND_LABEL: Record<Dependant['kind'], string> = {
  spouse: 'Spouse',
  child: 'Child',
  kin: 'Grown kin',
};

const UNION_BLURB: Record<UnionSource, string> = {
  homeland: 'Wed through a courtship expedition back to Thornwatch.',
  alliance: 'Wed as part of an alliance with a native people.',
  informal: 'An informal household match, made quietly at the post.',
  // Never actually reachable — a 'party' union (two heroes marrying each
  // other) never creates a Dependant record. Kept only so this Record stays
  // exhaustive over UnionSource, same convention as CharactersScreen's
  // UNION_BADGE.
  party: 'Wed at the post.',
};

function peopleLabel(peoples: Heritage[]): string {
  return peoples.map((p) => HERITAGE_LABEL[p]).join(' × ');
}

function hueOf(key: string): number {
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return ((hash % 360) + 360) % 360;
}

function DependantFace({ dep }: { dep: Dependant }) {
  const key =
    dep.portraitKey ??
    pickDependantPortraitKey(`${dominantHeritage(dep)}_${dep.gender}`, dep.id, dep.kind === 'child');
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

/** A clickable link to another family-graph node's own sheet — a Hero opens
 *  the full HeroSheet, a Dependant opens another DependantSheet. */
function PersonLink({ node }: { node: FamilyNode }) {
  const openPerson = useGameStore((s) => s.openPerson);
  return (
    <span
      className="person-link"
      onClick={() => openPerson(node.id, isHeroNode(node) ? 'hero' : 'dependant')}
    >
      {node.name}
    </span>
  );
}

export function DependantSheet({ game, dep }: { game: GameState; dep: Dependant }) {
  const selectDependant = useGameStore((s) => s.selectDependant);
  const peoples = nodePeoples(dep);
  const mixed = isMixed(dep);
  const spouses = spousesOf(game, dep.id);
  const children = childrenOf(game, dep.id);
  const parents = parentsOf(game, dep);
  const [tag1, tag2] = pickDependantTemperament(dep.id);
  const subPeopleText = dep.subPeople ? (SUBPEOPLE_LABEL[dep.subPeople] ?? dep.subPeople) : undefined;

  return (
    <div className="overlay" onClick={() => selectDependant(null)}>
      <div className="panel dependant-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="hero-sheet-head">
          <div className="hero-sheet-portrait">
            <DependantFace dep={dep} />
          </div>
          <div>
            <h2>
              {dep.name} <span className="dim">{KIND_LABEL[dep.kind]}</span>
              <span className="dim"> {dep.gender === 'female' ? '♀' : '♂'}</span>
            </h2>
            <p className="dim" style={{ fontSize: '0.78rem', margin: '0 0 4px' }}>
              {mixed ? peopleLabel(peoples) : HERITAGE_LABEL[peoples[0]]}
              {!mixed && subPeopleText && subPeopleText !== HERITAGE_LABEL[peoples[0]]
                ? ` — ${subPeopleText}`
                : ''}
            </p>
            <p className="dim" style={{ fontSize: '0.85rem', fontStyle: 'italic' }}>
              {cap(tag1)}, {tag2}.
            </p>
          </div>
        </div>

        {dep.kind === 'spouse' && dep.union && (
          <p style={{ fontSize: '0.85rem' }}>{UNION_BLURB[dep.union]}</p>
        )}

        {parents.length > 0 && (
          <p style={{ fontSize: '0.85rem' }}>
            Child of{' '}
            {parents.map((p, i) => (
              <span key={p.id}>
                {i > 0 && ' and '}
                <PersonLink node={p} />
              </span>
            ))}
            .
          </p>
        )}

        {spouses.length > 0 && (
          <p style={{ fontSize: '0.85rem' }}>
            Wed to{' '}
            {spouses.map((s, i) => (
              <span key={s.id}>
                {i > 0 && ' and '}
                <PersonLink node={s} />
              </span>
            ))}
            .
          </p>
        )}

        {children.length > 0 && (
          <p style={{ fontSize: '0.85rem' }}>
            Children:{' '}
            {children.map((c, i) => (
              <span key={c.id}>
                {i > 0 && ', '}
                <PersonLink node={c} />
              </span>
            ))}
            .
          </p>
        )}

        {dep.history && dep.history.length > 0 && (
          <>
            <h3 style={{ marginTop: 14 }}>History</h3>
            <div className="history-log">
              {dep.history.map((line, i) => (
                <div key={i}>— {line}</div>
              ))}
            </div>
          </>
        )}

        <div style={{ marginTop: 16 }}>
          <button onClick={() => selectDependant(null)}>Close</button>
        </div>
      </div>
    </div>
  );
}
