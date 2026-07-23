// The Post's People (RESIDENTS_SPEC.md + TULA_SETTLEMENT_SPEC.md §8): the
// unnamed population — counts by role, contentment, the Concession it settles,
// land-use allocation, the herd, and idle reassignment. Two columns so the
// screen never scrolls (UI_SHELL_SPEC.md no-scroll floor).

import { useState } from 'react';
import { TUNING } from '../../content/tuning';
import {
  croplandCapacity,
  herdCarryingCapacity,
  landChains,
  pastureCapacity,
  wildlandCapacity,
} from '../../engine/claim';
import {
  claimCapacity,
  contentmentBand,
  heritageCount,
  nativeShare,
  residentTagCounts,
  residentTotal,
} from '../../engine/residents';
import { RESIDENT_ROLES } from '../../engine/types';
import type { GameState, LandUse, ResidentRole, TransientKind } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';

const TRANSIENT_LABELS: Record<TransientKind, string> = {
  visitorGuards: 'Visiting guards',
  companyAgents: 'Company inspectors',
  supplierCrew: 'Supplier crew',
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

export function ResidentsPanel({ game }: { game: GameState }) {
  const reallocate = useGameStore((s) => s.reallocateResidents);
  const setLandAllocation = useGameStore((s) => s.setLandAllocation);
  const canAct = game.phase === 'assignment';

  const r = game.residents;
  const total = residentTotal(game);
  const cap = claimCapacity(game);
  const band = contentmentBand(game);
  const bandInfo = BAND_LABEL[band];
  const homeland = heritageCount(game, 'homeland');
  const native = heritageCount(game, 'native');
  const nativePct = Math.round(nativeShare(game) * 100);
  const tagCounts = residentTagCounts(game);

  const grainPerTurn = total * TUNING.residents.grainPerResidentPerTurn;
  const wagePerSeason = total * TUNING.residents.seasonWagePerResident;

  const [alloc, setAlloc] = useState<Record<LandUse, number>>({ ...game.claim.allocation });
  const allocSum = alloc.cropland + alloc.pasture + alloc.wildland;
  const allocChanged =
    alloc.cropland !== game.claim.allocation.cropland ||
    alloc.pasture !== game.claim.allocation.pasture ||
    alloc.wildland !== game.claim.allocation.wildland;

  const roleCap: Partial<Record<ResidentRole, number>> = {
    farmers: croplandCapacity(game),
    herders: pastureCapacity(game),
    hunters: wildlandCapacity(game),
  };

  return (
    <div className="panel people-panel">
      <h3>The Post's People</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>
        {/* Column 1 — who is here and what they do */}
        <div>
          {total === 0 && r.idle === 0 ? (
            <p className="dim" style={{ fontSize: '0.88rem' }}>
              No one has settled here yet — just the company and the frontier. Invite settlers from
              the neighbouring towns (on the Map), or draw them in as the post grows.
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
              <div className="axis-track" style={{ margin: '4px 0 10px' }}>
                <div className="marker" style={{ left: `${(r.contentment / 10) * 100}%` }} />
              </div>
              <div className="faction-row">
                <span>Makeup</span>
                <span className="dim">
                  {homeland} Imanian · {native} native{' '}
                  <span className={nativePct >= 50 ? 'bad' : 'dim'}>({nativePct}% native)</span>
                </span>
              </div>
              {tagCounts.length > 0 && (
                <div
                  className="faction-row"
                  title="Specific origins within the makeup above — a partial breakdown."
                >
                  <span className="dim" style={{ fontSize: '0.82rem' }}>
                    Origins
                  </span>
                  <span className="dim" style={{ fontSize: '0.82rem', textAlign: 'right' }}>
                    {tagCounts.map(([tag, count]) => `${formatTag(tag)} ${count}`).join(' · ')}
                  </span>
                </div>
              )}
              <div className="faction-row">
                <span className="dim">Food</span>
                <span className="dim">{grainPerTurn} food / turn</span>
              </div>
              <div className="faction-row">
                <span className="dim">Wages</span>
                <span className="dim">{wagePerSeason} silver / season</span>
              </div>
            </>
          )}

          <h4 style={{ marginTop: 12 }}>Hands</h4>
          <div className="hands-grid">
            {RESIDENT_ROLES.map((role) => {
              const at = r.roles[role];
              const workCap = roleCap[role];
              const overWorked = workCap !== undefined && at > workCap;
              return (
                <div key={role} className="hand-cell" title={ROLE_NOTES[role]}>
                  <div>
                    {ROLE_LABELS[role]} <b className={overWorked ? 'bad' : ''}>{at}</b>
                    {workCap !== undefined && (
                      <span className="dim" style={{ fontSize: '0.72rem' }}>
                        {' '}
                        /{workCap} land
                      </span>
                    )}
                  </div>
                  <div className="hand-cell-actions">
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
                </div>
              );
            })}
          </div>

          {r.idle > 0 && (
            <>
              <h4 style={{ marginTop: 12 }}>
                Idle Hands{' '}
                <span className="dim" style={{ fontSize: '0.8rem' }}>
                  ({r.idle})
                </span>
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
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
        </div>

        {/* Column 2 — the land it sits on */}
        <div>
          <h4 style={{ marginTop: 0 }}>
            The Concession{' '}
            <span className="dim" style={{ fontSize: '0.8rem' }}>
              ({game.claim.size} chains · supports {cap})
            </span>
          </h4>
          <p className="dim" style={{ fontSize: '0.78rem', margin: '0 0 6px' }}>
            Apportion the land. Cropland feeds the harvest, pasture the herd, wildland the hunters.
            Negotiate more from a neighbour on the Map.
          </p>
          <div className="hands-grid">
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
          <div className="faction-row" style={{ marginTop: 6 }}>
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
          <div className="faction-row" style={{ marginTop: 6 }}>
            <span className="dim">Herd</span>
            <span className="dim">
              {game.herd.count} / {herdCarryingCapacity(game)} head
            </span>
          </div>

          {game.transients.length > 0 && (
            <>
              <h4 style={{ marginTop: 14 }}>Visitors</h4>
              {game.transients.map((t) => (
                <div key={t.id} className="faction-row">
                  <span className="dim">
                    {TRANSIENT_LABELS[t.kind]} <b>{t.count}</b>
                  </span>
                  <span className="dim" style={{ fontSize: '0.8rem' }}>
                    {t.turnsLeft < 0
                      ? 'posted'
                      : `${t.turnsLeft} turn${t.turnsLeft === 1 ? '' : 's'} left`}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {!canAct && (
        <div className="dim" style={{ fontSize: '0.78rem', marginTop: 8 }}>
          Apportion land and assign hands during the assignment phase.
        </div>
      )}
    </div>
  );
}
