// Buildings & Construction (BUILDINGS_SPEC.md §9): what the post has raised, the
// single project underway, and what can be started next. Balance numbers come
// from TUNING.building; prose from content/buildings.ts.

import { BUILDINGS, BUILDING_NAMES } from '../../content/buildings';
import { GOOD_NAMES } from '../../content/goods';
import { TUNING } from '../../content/tuning';
import {
  buildingGateError,
  canAdvanceTier,
  constructionError,
  tierRequirement,
} from '../../engine/buildings';
import { outputMultiplier, residentsAvailable } from '../../engine/residents';
import type { BuildingId, GameState, GoodId } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';

const DEFS = TUNING.building.defs;

const EFFECT_LABELS: Record<string, (v: number) => string> = {
  foodStorageBonus: (v) => `+${v} food kept each harvest`,
  defenseBonus: (v) => `+${v} defense`,
  prosperityBonus: (v) => `+${v} prosperity`,
  tradeIncomeBonus: (v) => `+${Math.round(v * 100)}% trade income`,
  stressReliefBonus: (v) => `+${v} rest relief`,
  craftReliefBonus: (v) => `−${v} silver upkeep`,
  upkeepSilver: (v) => `${v} silver upkeep/turn`,
  contentmentBonus: (v) => `+${v} contentment`,
  healingBonus: (v) => `+${v} healing`,
  cargoCapacityBonus: (v) => `+${v} cargo capacity`,
  travelCheckBonus: (v) => `+${v} travel check`,
};

const CATEGORY_LABELS: Record<string, string> = {
  core: 'Core Works',
  culture: 'Culture',
  prestige: 'Prestige',
};

function effectSummary(id: BuildingId): string {
  const eff = DEFS[id]?.effects ?? {};
  return Object.entries(eff)
    .map(([k, v]) => EFFECT_LABELS[k]?.(v as number) ?? '')
    .filter(Boolean)
    .join(' · ');
}

function costSummary(id: BuildingId): string {
  const c = DEFS[id]?.cost;
  if (!c) return '';
  const parts = [`${c.silver} silver`];
  for (const [good, qty] of Object.entries(c.goods ?? {}) as [GoodId, number][]) {
    parts.push(`${qty} ${GOOD_NAMES.get(good) ?? good}`);
  }
  return parts.join(', ');
}

export function BuildingsPanel({ game }: { game: GameState }) {
  const start = useGameStore((s) => s.startConstruction);
  const cancel = useGameStore((s) => s.cancelConstruction);
  const canAct = game.phase === 'assignment';

  const construction = game.construction;
  const activeDef = construction ? DEFS[construction.building] : undefined;
  const nextTier = tierRequirement(game.postTier + 1);
  const ready = canAdvanceTier(game);

  // Buildings not yet built and not the active project.
  const notStarted = BUILDINGS.filter(
    (b) => !game.buildings.includes(b.id) && construction?.building !== b.id,
  );
  // The project menu only shows buildings that are structurally eligible —
  // prereqs, tier, and any resident/heritage/tag/standing gate already met,
  // so all that's left is saving up silver/goods. Everything still gated
  // (however large the catalog grows) is a compact chip in the rail instead
  // of a full card, so the menu can't outgrow the no-scroll floor.
  const available = notStarted.filter((b) => buildingGateError(game, b.id) === null);
  // Culture/prestige buildings (a shrine to a people you've welcomed in, a
  // vault only a rich post would bother with) are a payoff for playing a
  // certain way — they stay a surprise, not previewed as a locked chip.
  // Ordinary tier upgrades still preview so players can plan toward them.
  const future = notStarted.filter(
    (b) =>
      buildingGateError(game, b.id) !== null && b.category !== 'culture' && b.category !== 'prestige',
  );

  return (
    <div className="buildings-layout">
      {/* Left rail — what stands, what's underway, and how the post grows next. */}
      <div className="panel">
        <h3>Completed</h3>

        {game.buildings.length === 0 ? (
          <p className="dim" style={{ fontSize: '0.88rem' }}>
            Nothing built yet — just tents and a firepit. Assign a hero to{' '}
            <b>Build</b> once a project is underway.
          </p>
        ) : (
          <div className="building-chips">
            {game.buildings.map((id) => (
              <span key={id} className="building-chip" title={effectSummary(id)}>
                {BUILDING_NAMES.get(id) ?? id}
              </span>
            ))}
          </div>
        )}

        {construction && activeDef && (
          <div className="construction-active">
            <div className="faction-row">
              <span>
                Building: <b>{BUILDING_NAMES.get(construction.building) ?? construction.building}</b>
              </span>
              <span className="dim">
                {construction.progress} / {activeDef.buildProgress}
              </span>
            </div>
            <div className="build-track">
              <div
                className="build-fill"
                style={{
                  width: `${Math.min(100, (construction.progress / activeDef.buildProgress) * 100)}%`,
                }}
              />
            </div>
            <p className="dim" style={{ fontSize: '0.78rem', margin: '4px 0 6px' }}>
              Assign heroes to <b>Build</b> to raise it (Craft each turn).
            </p>
            {(() => {
              const crewGain = Math.round(
                residentsAvailable(game, 'craftsfolk') *
                  TUNING.residents.effects.crewYieldPerCraftsperson *
                  outputMultiplier(game),
              );
              return crewGain > 0 ? (
                <p className="good" style={{ fontSize: '0.78rem', margin: '0 0 6px' }}>
                  +{crewGain} / turn from the craftsfolk on the crew.
                </p>
              ) : null;
            })()}
            <button
              className="small"
              disabled={!canAct}
              title="Abandon the project — the silver and goods already spent are lost."
              onClick={() => {
                if (window.confirm('Abandon this project? The silver and goods spent are forfeit.'))
                  cancel();
              }}
            >
              Cancel Project
            </button>
          </div>
        )}

        {(ready || nextTier) && (
          <div className={`tier-callout ${ready ? 'good' : 'dim'}`} style={{ marginTop: 10 }}>
            {ready ? (
              <>▲ The post is ready to grow — the moment will present itself.</>
            ) : (
              nextTier && (
                <>
                  To grow further: raise{' '}
                  {nextTier.requiredBuildings
                    .map((b) => BUILDING_NAMES.get(b) ?? b)
                    .join(' + ')}{' '}
                  and hold {nextTier.silverCost} silver.
                </>
              )
            )}
          </div>
        )}

        {future.length > 0 && (
          <>
            <h4 style={{ marginTop: 14, marginBottom: 6 }}>Coming Later</h4>
            <div className="building-chips">
              {future.map((b) => (
                <span
                  key={b.id}
                  className="building-chip locked"
                  title={`${b.blurb} — ${buildingGateError(game, b.id)}`}
                >
                  {b.name}
                </span>
              ))}
            </div>
          </>
        )}

        {!canAct && (
          <div className="dim" style={{ fontSize: '0.78rem', marginTop: 8 }}>
            Start and cancel projects during the assignment phase.
          </div>
        )}
      </div>

      {/* Right — the wide project menu; this is where the room freed up by the
          rail actually pays for itself as the building set grows. */}
      <div className="panel">
        <h3>Start a Project</h3>
        {available.length > 0 ? (
          <div className="build-menu">
            {available.map((b) => {
              const reason = constructionError(game, b.id);
              return (
                <div key={b.id} className="build-option" title={b.blurb}>
                  <div className="build-option-head">
                    <b>
                      {b.name}
                      {b.category && b.category !== 'core' && (
                        <span className="dim" style={{ fontWeight: 400, fontSize: '0.72rem' }}>
                          {' '}
                          · {CATEGORY_LABELS[b.category]}
                        </span>
                      )}
                    </b>
                    <button
                      className="small primary"
                      disabled={!canAct || reason !== null}
                      title={reason ?? `Begin — ${costSummary(b.id)}`}
                      onClick={() => start(b.id)}
                    >
                      Build
                    </button>
                  </div>
                  <div className="dim" style={{ fontSize: '0.78rem' }}>
                    {costSummary(b.id)} · {DEFS[b.id]?.buildProgress} work
                  </div>
                  <div className="dim" style={{ fontSize: '0.78rem' }}>
                    {effectSummary(b.id)}
                  </div>
                  {reason && reason !== 'Finish or cancel the current project first.' && (
                    <div className="bad" style={{ fontSize: '0.74rem' }}>
                      {reason}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="dim" style={{ fontSize: '0.88rem' }}>
            Every building this tier allows is built or underway.
          </p>
        )}
      </div>
    </div>
  );
}
