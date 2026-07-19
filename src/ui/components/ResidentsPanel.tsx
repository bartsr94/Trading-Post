// The Post's People (RESIDENTS_SPEC.md §9): the unnamed population — counts by
// role, contentment, capacity, upkeep, plus hire & reallocation controls.

import { useState } from 'react';
import { TUNING } from '../../content/tuning';
import {
  contentmentBand,
  heritageCount,
  hireError,
  localHireCost,
  nativeShare,
  residentCap,
  residentTotal,
} from '../../engine/residents';
import { RESIDENT_ROLES } from '../../engine/types';
import type { GameState, Heritage, ResidentRole, TransientKind } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';

const TRANSIENT_LABELS: Record<TransientKind, string> = {
  visitorGuards: 'Visiting guards',
  companyAgents: 'Company inspectors',
  supplierCrew: 'Supplier crew',
};

/** Native peoples hireable at their seats (HERITAGE_SPEC.md §4). */
const NATIVE_PEOPLES: { id: Heritage; label: string }[] = [
  { id: 'kiswani', label: 'Kiswani' },
  { id: 'dustwalker', label: 'Dustwalker' },
  { id: 'bejasi', label: 'Bejasi' },
];

const ROLE_LABELS: Record<ResidentRole, string> = {
  farmers: 'Farmers',
  porters: 'Porters',
  guards: 'Guards',
  craftsfolk: 'Craftsfolk',
};

const ROLE_NOTES: Record<ResidentRole, string> = {
  farmers: 'Work the plots — grain each turn.',
  porters: 'Haul for caravans — more cargo on the road.',
  guards: 'Hold the palisade and escort parties.',
  craftsfolk: 'Keep the post mended — easier upkeep.',
};

const BAND_LABEL = {
  content: { text: 'Content', cls: 'good' },
  grumbling: { text: 'Grumbling', cls: 'dim' },
  unrest: { text: 'Unrest', cls: 'bad' },
} as const;

export function ResidentsPanel({ game }: { game: GameState }) {
  const hire = useGameStore((s) => s.hire);
  const reallocate = useGameStore((s) => s.reallocateResidents);
  const canAct = game.phase === 'assignment';
  const [people, setPeople] = useState<Heritage>('kiswani');

  const r = game.residents;
  const total = residentTotal(game);
  const cap = residentCap(game);
  const band = contentmentBand(game);
  const bandInfo = BAND_LABEL[band];
  const homeland = heritageCount(game, 'homeland');
  const native = heritageCount(game, 'native');
  const nativePct = Math.round(nativeShare(game) * 100);

  const grainPerTurn = total * TUNING.residents.grainPerResidentPerTurn;
  const wagePerSeason = total * TUNING.residents.seasonWagePerResident;

  return (
    <div className="panel">
      <h3>The Post's People</h3>

      {total === 0 && r.idle === 0 ? (
        <p className="dim" style={{ fontSize: '0.88rem' }}>
          No one has settled here yet — just the company and the frontier. Hire hands from the
          neighbouring towns, or draw them in as the post grows.
        </p>
      ) : (
        <>
          <div className="faction-row">
            <span>Population</span>
            <span className={total > cap ? 'bad' : 'dim'}>
              {total} / {cap}
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
          <div className="faction-row">
            <span className="dim">Food</span>
            <span className="dim">{grainPerTurn} grain / turn</span>
          </div>
          <div className="faction-row">
            <span className="dim">Wages</span>
            <span className="dim">{wagePerSeason} silver / season</span>
          </div>
        </>
      )}

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

      <h4 style={{ marginTop: 14 }}>Hire Local Hands</h4>
      <div className="people-picker" style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {NATIVE_PEOPLES.map((p) => (
          <button
            key={p.id}
            className={people === p.id ? 'small primary' : 'small'}
            onClick={() => setPeople(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="hands-grid">
        {RESIDENT_ROLES.map((role) => {
          const reason = hireError(game, role, 1, people);
          const cost = localHireCost(role, 1);
          return (
            <div key={role} className="hand-cell" title={ROLE_NOTES[role]}>
              <div>
                {ROLE_LABELS[role]} <b>{r.roles[role]}</b>
              </div>
              <div className="hand-cell-actions">
                {r.roles[role] > 0 && (
                  <button
                    className="small"
                    disabled={!canAct}
                    title="Send to the idle pool"
                    onClick={() => reallocate(role, 'idle', 1)}
                  >
                    Release
                  </button>
                )}
                <button
                  className="small primary"
                  disabled={!canAct || reason !== null}
                  title={reason ?? `Hire a ${people} ${ROLE_LABELS[role].toLowerCase()} for ${cost} silver`}
                  onClick={() => hire(role, 1, people)}
                >
                  Hire ({cost})
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <p className="dim" style={{ fontSize: '0.78rem', margin: '8px 0 0' }}>
        Local hands come cheap but pull the post toward the frontier. Homeland hands must be sent
        for from Thornwatch — see the Map's “Call for Hands.”
      </p>

      {r.idle > 0 && (
        <>
          <h4 style={{ marginTop: 14 }}>
            Idle Hands <span className="dim" style={{ fontSize: '0.8rem' }}>({r.idle})</span>
          </h4>
          <p className="dim" style={{ fontSize: '0.78rem', margin: '0 0 6px' }}>
            Newcomers with nothing to do yet. Put them to work — idle hands sour the mood.
          </p>
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

      {!canAct && (
        <div className="dim" style={{ fontSize: '0.78rem', marginTop: 8 }}>
          Hire and assign during the assignment phase.
        </div>
      )}
    </div>
  );
}
