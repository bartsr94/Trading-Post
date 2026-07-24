// The Post's People (RESIDENTS_SPEC.md + TULA_SETTLEMENT_SPEC.md §8): the
// unnamed population — counts by role, contentment, the Concession it settles,
// land-use allocation, the herd, and idle reassignment. Two pieces slotted
// into the Outpost Overview dashboard (PostOverview.tsx): a dashboard column
// (population/hands) and a full-width strip below the grid (land/herd) — so
// the whole thing lives on one screen without ever scrolling.

import { useEffect, useState } from 'react';
import { TUNING } from '../../content/tuning';
import {
  croplandCapacity,
  herdCarryingCapacity,
  landChains,
  pastureCapacity,
  wildlandCapacity,
} from '../../engine/claim';
import { dependantHeritageBreakdown, dependantHeritageGroupCounts } from '../../engine/family';
import {
  claimCapacity,
  contentmentBand,
  frictionBand,
  heritageCount,
  residentTagCounts,
  residentTotal,
} from '../../engine/residents';
import {
  restivenessBand,
  thrallOutputMultiplier,
  thrallTotal,
} from '../../engine/thralls';
import { RESIDENT_ROLES } from '../../engine/types';
import type { GameState, LandUse, ResidentRole, TransientKind } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';

const THRALL_ROLES = RESIDENT_ROLES.filter((role) => role !== 'guards');

const RESTIVENESS_LABEL = {
  settled: { text: 'Settled', cls: 'good' },
  uneasy: { text: 'Uneasy', cls: 'dim' },
  restive: { text: 'Restive', cls: 'bad' },
} as const;

const TRANSIENT_LABELS: Record<TransientKind, string> = {
  visitorGuards: 'Visiting guards',
  companyAgents: 'Company inspectors',
  supplierCrew: 'Supplier crew',
  beastfolkVisitors: 'Beastfolk visitors',
};

const ROLE_LABELS: Record<ResidentRole, string> = {
  farmers: 'Farmers',
  porters: 'Porters',
  guards: 'Guards',
  craftsfolk: 'Craftsfolk',
  herders: 'Herders',
  hunters: 'Hunters',
};

const ROLE_NOTES: Record<ResidentRole, string> = {
  farmers: 'Work the cropland — the season’s harvest.',
  porters: 'Haul for caravans — more cargo on the road.',
  guards: 'Hold the palisade and escort parties.',
  craftsfolk: 'Keep the post mended — easier upkeep.',
  herders: 'Tend the herd on pasture.',
  hunters: 'Hunt the wildland — food each turn.',
};

const LAND_LABELS: Record<LandUse, string> = {
  cropland: 'Cropland',
  pasture: 'Pasture',
  wildland: 'Wildland',
};

/** 'native-kin' -> 'Native Kin'. Tags are free-form content strings. */
function formatTag(tag: string): string {
  return tag
    .split(/[-_]/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

const BAND_LABEL = {
  content: { text: 'Content', cls: 'good' },
  grumbling: { text: 'Grumbling', cls: 'dim' },
  unrest: { text: 'Unrest', cls: 'bad' },
} as const;

/** Friction bands read opposite contentment's — high is bad, so the color
 *  classes flip relative to BAND_LABEL above. */
const FRICTION_BAND_LABEL = {
  settled: 'good',
  tense: 'dim',
  volatile: 'bad',
} as const;

/** Dashboard column: population summary + hands + idle reassignment. */
export function PeopleOverviewColumn({ game }: { game: GameState }) {
  const reallocate = useGameStore((s) => s.reallocateResidents);
  const reallocateThralls = useGameStore((s) => s.reallocateThralls);
  const freeThralls = useGameStore((s) => s.freeThralls);
  const canAct = game.phase === 'assignment';

  const r = game.residents;
  const total = residentTotal(game);
  const cap = claimCapacity(game);
  const band = contentmentBand(game);
  const bandInfo = BAND_LABEL[band];
  const dependantGroups = dependantHeritageGroupCounts(game);
  // The Makeup row reads as "the makeup of the outpost" — named family counts
  // toward it too, alongside the unnamed resident pool (Bartosz, 2026-07-24).
  // Population/cap above stays resident-only; dependants are food-only and
  // uncapped, a different axis (see claimCapacity/residentTotal).
  const homeland = heritageCount(game, 'homeland') + dependantGroups.homeland;
  const native = heritageCount(game, 'native') + dependantGroups.native;
  const makeupTotal = homeland + native;
  const nativePct = makeupTotal === 0 ? 0 : Math.round((native / makeupTotal) * 100);
  const tagCounts = residentTagCounts(game);
  const frictionEntries = Object.entries(r.friction).filter(([, value]) => (value ?? 0) > 0) as [
    string,
    number,
  ][];
  const dependants = dependantHeritageBreakdown(game);
  const dependantCounts = Object.entries(dependants.counts).sort((a, b) => b[1] - a[1]);

  const grainPerTurn = total * TUNING.residents.grainPerResidentPerTurn;
  const wagePerSeason = total * TUNING.residents.seasonWagePerResident;

  const roleCap: Partial<Record<ResidentRole, number>> = {
    farmers: croplandCapacity(game),
    herders: pastureCapacity(game),
    hunters: wildlandCapacity(game),
  };

  return (
    <div className="panel">
      <h3>The People</h3>
      {total === 0 && r.idle === 0 ? (
        <p className="dim" style={{ fontSize: '0.82rem' }}>
          No one has settled here yet. Invite settlers from a neighbouring town (on the Map), or
          draw them in as the post grows.
        </p>
      ) : (
        <>
          <div className="faction-row">
            <span>Population</span>
            <span className={total > cap ? 'bad' : 'dim'}>
              {total} / {cap} <span className="dim">supported</span>
            </span>
          </div>
          <div className="faction-row">
            <span>Mood</span>
            <span className={bandInfo.cls}>
              {bandInfo.text} <span className="dim">({r.contentment}/10)</span>
            </span>
          </div>
          <div className="faction-row" title="Residents and named family together.">
            <span className="dim">Makeup</span>
            <span className="dim">
              {homeland} Imanian · {native} native{' '}
              <span className={nativePct >= 50 ? 'bad' : 'dim'}>({nativePct}%)</span>
            </span>
          </div>
          {tagCounts.length > 0 && (
            <div className="faction-row" title="Specific origins among the resident pool, within the makeup above.">
              <span className="dim" style={{ fontSize: '0.78rem' }}>
                Origins
              </span>
              <span className="dim" style={{ fontSize: '0.78rem', textAlign: 'right' }}>
                {tagCounts.map(([tag, count]) => `${formatTag(tag)} ${count}`).join(' · ')}
              </span>
            </div>
          )}
          {frictionEntries.length > 0 && (
            <div
              className="faction-row"
              title="Lingering integration tension for a settled newcomer group — settles on its own over time, faster with a mediation event."
            >
              <span className="dim" style={{ fontSize: '0.78rem' }}>
                Friction
              </span>
              <span className="dim" style={{ fontSize: '0.78rem', textAlign: 'right' }}>
                {frictionEntries.map(([heritage, value]) => (
                  <span key={heritage} className={FRICTION_BAND_LABEL[frictionBand(value)]}>
                    {formatTag(heritage)} {Math.round(value)}/10{' '}
                  </span>
                ))}
              </span>
            </div>
          )}
          {dependants.total > 0 && (
            <div
              className="faction-row"
              title="Named family — wives and children of heroes. Fed, never worked; counted in the makeup above, not in Population."
            >
              <span className="dim" style={{ fontSize: '0.78rem' }}>
                Dependants
              </span>
              <span className="dim" style={{ fontSize: '0.78rem', textAlign: 'right' }}>
                {dependants.total} (
                {dependantCounts.map(([label, count]) => `${formatTag(label)} ${count}`).join(' · ')}
                )
              </span>
            </div>
          )}
          <div className="faction-row">
            <span className="dim" style={{ fontSize: '0.78rem' }}>
              Upkeep
            </span>
            <span className="dim" style={{ fontSize: '0.78rem', textAlign: 'right' }}>
              {grainPerTurn} food/turn · {wagePerSeason} silver/season
            </span>
          </div>
        </>
      )}

      <h4>Hands</h4>
      <div className="hand-list">
        {RESIDENT_ROLES.map((role) => {
          const at = r.roles[role];
          const workCap = roleCap[role];
          const overWorked = workCap !== undefined && at > workCap;
          return (
            <div key={role} className="hand-row" title={ROLE_NOTES[role]}>
              <span>
                {ROLE_LABELS[role]} <b className={overWorked ? 'bad' : ''}>{at}</b>
                {workCap !== undefined && (
                  <span className="dim" style={{ fontSize: '0.72rem' }}>
                    {' '}
                    /{workCap}
                  </span>
                )}
              </span>
              {at > 0 && (
                <button
                  className="small"
                  disabled={!canAct}
                  title="Send to the idle pool"
                  onClick={() => reallocate(role, 'idle', 1)}
                >
                  Release
                </button>
              )}
            </div>
          );
        })}
      </div>

      {r.idle > 0 && (
        <>
          <h4>
            Idle Hands{' '}
            <span className="dim" style={{ fontSize: '0.8rem' }}>
              ({r.idle})
            </span>
          </h4>
          <div className="idle-hands-actions">
            {RESIDENT_ROLES.map((role) => (
              <button
                key={role}
                className="small"
                disabled={!canAct}
                onClick={() => reallocate('idle', role, 1)}
              >
                → {ROLE_LABELS[role]}
              </button>
            ))}
          </div>
        </>
      )}

      {thrallTotal(game) > 0 && (() => {
        const t = game.thralls;
        const band = restivenessBand(game);
        const bandInfo = RESTIVENESS_LABEL[band];
        const manumitCost = TUNING.thralls.manumission.silverPerHead;
        return (
          <>
            <h4 title="Forced labor — thralls to the Sauromatians, 'indentured labor' to the Company. No wage, but held at real risk.">
              Thralls{' '}
              <span className="dim" style={{ fontSize: '0.8rem' }}>
                ({thrallTotal(game)})
              </span>
            </h4>
            <div className="faction-row">
              <span>Restiveness</span>
              <span className={bandInfo.cls}>
                {bandInfo.text} <span className="dim">({Math.round(t.restiveness)}/10)</span>
              </span>
            </div>
            <div className="faction-row" title="Output vs. a free resident's, by the guard:thrall ratio.">
              <span className="dim" style={{ fontSize: '0.78rem' }}>
                Output
              </span>
              <span className="dim" style={{ fontSize: '0.78rem' }}>
                ×{thrallOutputMultiplier(game).toFixed(2)}
              </span>
            </div>
            <div className="hand-list">
              {THRALL_ROLES.map((role) => {
                const at = t.roles[role];
                if (at === 0) return null;
                return (
                  <div key={role} className="hand-row">
                    <span>
                      {ROLE_LABELS[role]} <b>{at}</b>
                    </span>
                    <button
                      className="small"
                      disabled={!canAct}
                      title="Send to the idle thrall pool"
                      onClick={() => reallocateThralls(role, 'idle', 1)}
                    >
                      Release
                    </button>
                  </div>
                );
              })}
            </div>
            {t.idle > 0 && (
              <>
                <h4>
                  Idle Thralls{' '}
                  <span className="dim" style={{ fontSize: '0.8rem' }}>
                    ({t.idle})
                  </span>
                </h4>
                <div className="idle-hands-actions">
                  {THRALL_ROLES.map((role) => (
                    <button
                      key={role}
                      className="small"
                      disabled={!canAct}
                      onClick={() => reallocateThralls('idle', role, 1)}
                    >
                      → {ROLE_LABELS[role]}
                    </button>
                  ))}
                  <button
                    className="small"
                    disabled={!canAct || game.silver < manumitCost}
                    title={`Free one thrall into the resident pool for ${manumitCost} silver.`}
                    onClick={() => freeThralls('idle', 1)}
                  >
                    Free ({manumitCost}s)
                  </button>
                </div>
              </>
            )}
          </>
        );
      })()}
    </div>
  );
}

/** Full-width strip below the dashboard grid: the Concession's land + herd. */
export function ConcessionStrip({ game }: { game: GameState }) {
  const setLandAllocation = useGameStore((s) => s.setLandAllocation);
  const canAct = game.phase === 'assignment';
  const cap = claimCapacity(game);

  const [alloc, setAlloc] = useState<Record<LandUse, number>>({ ...game.claim.allocation });
  // Resync when the committed allocation changes underneath this component —
  // a successful Apply, an imported save, or a new game — since this panel
  // stays mounted across those (it doesn't remount on an ordinary state swap).
  useEffect(() => {
    setAlloc({ ...game.claim.allocation });
  }, [game.claim.allocation.cropland, game.claim.allocation.pasture, game.claim.allocation.wildland]);
  const allocSum = alloc.cropland + alloc.pasture + alloc.wildland;
  const allocChanged =
    alloc.cropland !== game.claim.allocation.cropland ||
    alloc.pasture !== game.claim.allocation.pasture ||
    alloc.wildland !== game.claim.allocation.wildland;

  return (
    <div className="panel concession-strip">
      <div className="concession-strip-row">
        <div className="concession-strip-head">
          <h3>The Concession</h3>
          <span className="dim" style={{ fontSize: '0.8rem' }}>
            {game.claim.size} chains · supports {cap}
          </span>
        </div>

        <div className="concession-strip-alloc">
          {(['cropland', 'pasture', 'wildland'] as LandUse[]).map((use) => (
            <label
              key={use}
              className="hand-cell"
              title={`${landChains(game, use)} chains in use`}
            >
              <div>{LAND_LABELS[use]}</div>
              <input
                type="number"
                min={0}
                max={100}
                disabled={!canAct}
                value={alloc[use]}
                onChange={(event) => {
                  const v = Math.max(
                    0,
                    Math.min(100, Math.floor(Number(event.target.value) || 0)),
                  );
                  setAlloc((cur) => ({ ...cur, [use]: v }));
                }}
              />
              <span className="dim" style={{ fontSize: '0.74rem' }}>
                {landChains(game, use)} chains
              </span>
            </label>
          ))}
        </div>

        <div className="concession-strip-apply">
          <span className={allocSum === 100 ? 'dim' : 'bad'} style={{ fontSize: '0.8rem' }}>
            Total {allocSum}% {allocSum === 100 ? '' : '(must be 100)'}
          </span>
          <button
            className="small primary"
            disabled={!canAct || allocSum !== 100 || !allocChanged}
            onClick={() => setLandAllocation(alloc)}
          >
            Apply
          </button>
        </div>

        <div className="concession-strip-herd">
          <span className="dim">Herd</span>
          <span className="dim">
            {game.herd.count} / {herdCarryingCapacity(game)} head
          </span>
        </div>

        {game.transients.length > 0 && (
          <div className="concession-strip-visitors">
            <span className="dim" style={{ fontSize: '0.78rem' }}>
              Visitors
            </span>
            {game.transients.map((t) => (
              <span key={t.id} className="dim" style={{ fontSize: '0.78rem' }}>
                {TRANSIENT_LABELS[t.kind]} {t.count}
                {t.turnsLeft < 0 ? '' : ` (${t.turnsLeft}t)`}
              </span>
            ))}
          </div>
        )}
      </div>

      {!canAct && (
        <div className="dim" style={{ fontSize: '0.76rem', marginTop: 6 }}>
          Apportion land and assign hands during the assignment phase.
        </div>
      )}
    </div>
  );
}
