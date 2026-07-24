// Raid encounter modal (RAIDING_SPEC.md §13) - a focused overlay for both
// defending the post and ordering an outgoing strike once the raiders reach
// their mark.

import { useEffect, useMemo, useState } from 'react';
import { CONTENT } from '../../content/registry';
import { hasCaptiveHeldBy } from '../../engine/captivity';
import {
  defenderForceBreakdown,
  raidingForceBreakdown,
} from '../../engine/raids';
import { heroesAtPost } from '../../engine/types';
import type {
  ExpeditionState,
  GameState,
  PendingOutgoingRaid,
  RaidAttackGoal,
  RaidDefendGoal,
  RaidManeuver,
} from '../../engine/types';
import { useGameStore } from '../../store/gameStore';
import { Illustration } from './Illustration';

const DEFEND_GOALS: { id: RaidDefendGoal; label: string; hint: string }[] = [
  { id: 'driveoff', label: 'Drive them off', hint: 'Spare our own and force them back from the wall.' },
  { id: 'stand', label: 'Stand and bloody them', hint: 'Make this raid costly, even if it hardens the feud.' },
  { id: 'sally', label: 'Sally out', hint: 'Meet them in the open and strip what they carry on a win.' },
  { id: 'hold', label: 'Hold the walls', hint: 'Trust timber, stone, and numbers more than valor.' },
];

const ATTACK_GOALS: { id: RaidAttackGoal; label: string; hint: string }[] = [
  { id: 'plunder', label: 'Plunder', hint: 'Take silver and goods, then break clear.' },
  { id: 'burn', label: 'Burn it', hint: 'Leave hurt behind you, not just empty stores.' },
  { id: 'bloody', label: 'Bloody them', hint: 'Teach a lesson even if the haul is thin.' },
  { id: 'cow', label: 'Cow them', hint: 'Break their nerve and force tribute from them.' },
  { id: 'rescue', label: 'Rescue', hint: 'Free whoever of ours is held here — leave the rest be.' },
  { id: 'enslave', label: 'Take thralls', hint: 'March captives home as thralls — needs a guard escort.' },
];

const MANEUVERS: { id: RaidManeuver; label: string; hint: string }[] = [
  { id: 'skirmish', label: 'Skirmish', hint: 'Harass and wear them down. Beats a charge.' },
  { id: 'charge', label: 'Charge', hint: 'Hit them hard and fast. Beats an evasion.' },
  { id: 'evade', label: 'Evade', hint: 'Give ground, strike gaps. Beats a skirmish.' },
];

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatScore(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function resultHeading(direction: 'incoming' | 'outgoing', outcome: string): string {
  if (direction === 'incoming') {
    if (outcome === 'repelled') return 'The Raid is Thrown Back';
    if (outcome === 'held') return 'The Post Holds - Barely';
    return 'The Post is Overrun';
  }
  if (outcome === 'drivenOff') return 'The Raid Fails';
  if (outcome === 'bloodied') return 'Blood Paid in Kind';
  if (outcome === 'cowed') return 'Tribute is Won';
  if (outcome === 'rescued') return 'Brought Home';
  if (outcome === 'enslaved') return 'Captives Marched Home';
  return 'The Raid Lands';
}

function outgoingParty(
  game: GameState,
  raid: PendingOutgoingRaid,
): ExpeditionState | null {
  return game.expeditions.find((entry) => entry.id === raid.expeditionId) ?? null;
}

function BreakdownCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="raid-breakdown-card">
      <div className="raid-breakdown-label">{label}</div>
      <div className="raid-breakdown-value">{value}</div>
      <div className="raid-breakdown-note">{note}</div>
    </div>
  );
}

export function RaidModal({ game }: { game: GameState }) {
  const resolveRaid = useGameStore((s) => s.resolveRaid);
  const continueRaid = useGameStore((s) => s.continueRaid);
  const resolution = useGameStore((s) => s.lastRaidResolution);
  const raid = game.pendingRaid;
  const homeHeroes = heroesAtPost(game);

  const [defendGoal, setDefendGoal] = useState<RaidDefendGoal>('driveoff');
  const [attackGoal, setAttackGoal] = useState<RaidAttackGoal>('plunder');
  const [maneuver, setManeuver] = useState<RaidManeuver>('skirmish');
  const [rally, setRally] = useState(false);

  useEffect(() => {
    if (!raid) return;
    if (raid.kind === 'incoming') {
      setDefendGoal('driveoff');
      setManeuver('skirmish');
      setRally(false);
      return;
    }
    setAttackGoal(raid.goal);
    setManeuver(raid.maneuver);
    setRally(raid.rally);
  }, [raid]);

  const canRally = useMemo(() => {
    if (!raid) return false;
    if (raid.kind === 'incoming') return homeHeroes.length > 0;
    const expedition = outgoingParty(game, raid);
    return Boolean(expedition && expedition.heroIds.length > 0);
  }, [homeHeroes.length, game, raid]);

  const incomingBreakdown = useMemo(
    () => (raid && raid.kind === 'incoming' ? defenderForceBreakdown(game) : null),
    [game, raid],
  );
  const outgoingExpedition = useMemo(
    () => (raid && raid.kind === 'outgoing' ? outgoingParty(game, raid) : null),
    [game, raid],
  );
  const outgoingBreakdown = useMemo(
    () =>
      outgoingExpedition ? raidingForceBreakdown(game, outgoingExpedition) : null,
    [game, outgoingExpedition],
  );

  if (resolution) {
    return (
      <div className="overlay">
        <div className="event-panel raid-modal raid-modal--result">
          <div className="raid-modal-art">
            <Illustration assetKey="raid_battle" />
          </div>
          <div className="raid-modal-content raid-modal-content--result">
            <h2>{resultHeading(resolution.direction, resolution.outcome)}</h2>
            <div className="outcome-log raid-result-log">
              {resolution.log.map((line, i) => (
                <div key={i}>- {line}</div>
              ))}
            </div>
            {!resolution.gameOver && (
              <button className="primary raid-submit" onClick={continueRaid}>
                Continue {'->'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!raid) return null;

  if (raid.kind === 'incoming' && incomingBreakdown) {
    const faction = CONTENT.factionNames.get(raid.faction) ?? raid.faction;
    const guardHeads = game.residents.roles.guards;
    const musterHeads = game.residents.roles.farmers + game.residents.idle;

    return (
      <div className="overlay">
        <div className="event-panel raid-modal">
          <div className="raid-modal-art">
            <Illustration assetKey="raid_battle" />
          </div>
          <div className="raid-modal-content">
            <div className="raid-heading">
              <h2>A Raid on the Post</h2>
              <p className="text">
                {cap(raid.band)} of the {faction} is upon the post.{' '}
                {raid.spotted
                  ? 'The patrols cried the alarm in time and the wall is manned.'
                  : 'They move fast and quiet; the alarm comes late.'}
              </p>
            </div>

            <div className="raid-forces">
              <span className="statchip">Our strength: {formatScore(incomingBreakdown.total)}</span>
              <span className="statchip">Their force: {raid.attackerForce}</span>
              <span className="statchip">Threat: {cap(raid.severity)}</span>
            </div>

            <div className="raid-breakdown-grid">
              <BreakdownCard
                label="Guards on the wall"
                value={`+${formatScore(incomingBreakdown.guards)}`}
                note={`${guardHeads} resident guard${guardHeads === 1 ? '' : 's'} standing to`}
              />
              <BreakdownCard
                label="Walls and towers"
                value={`+${formatScore(incomingBreakdown.fortifications)}`}
                note="Palisades, watchtowers, and built defenses"
              />
              <BreakdownCard
                label="Outside blades"
                value={`+${formatScore(incomingBreakdown.transients)}`}
                note="Visitors and other temporary defenders in the post"
              />
              <BreakdownCard
                label="At-post heroes"
                value={`+${formatScore(incomingBreakdown.heroes)}`}
                note={`${homeHeroes.length} hero${homeHeroes.length === 1 ? '' : 'es'} able to fight`}
              />
              <BreakdownCard
                label="Company muster"
                value={`+${formatScore(incomingBreakdown.muster)}`}
                note={`${musterHeads} farmer/idle hand${musterHeads === 1 ? '' : 's'} that can be called up`}
              />
            </div>

            <div className="raid-plan-grid">
              <section className="raid-plan-card">
                <div className="raid-choice-label">Battle goal</div>
                <div className="raid-option-grid">
                  {DEFEND_GOALS.map((goal) => (
                    <button
                      key={goal.id}
                      className={`raid-option ${defendGoal === goal.id ? 'selected' : ''}`}
                      onClick={() => setDefendGoal(goal.id)}
                    >
                      {goal.label}
                      <span className="check-hint">{goal.hint}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="raid-plan-card">
                <div className="raid-choice-label">Maneuver</div>
                <div className="raid-option-grid raid-option-grid--three">
                  {MANEUVERS.map((option) => (
                    <button
                      key={option.id}
                      className={`raid-option ${maneuver === option.id ? 'selected' : ''}`}
                      onClick={() => setManeuver(option.id)}
                    >
                      {option.label}
                      <span className="check-hint">{option.hint}</span>
                    </button>
                  ))}
                </div>

                {canRally && (
                  <label className="raid-rally">
                    <input
                      type="checkbox"
                      checked={rally}
                      onChange={(e) => setRally(e.target.checked)}
                    />
                    Rally the defenders first for a leadership check and added strength.
                  </label>
                )}

                <button
                  className="primary raid-submit"
                  onClick={() => resolveRaid({ goal: defendGoal, maneuver, rally })}
                >
                  Meet them {'->'}
                </button>
              </section>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (raid.kind === 'outgoing' && outgoingBreakdown && outgoingExpedition) {
    const faction = CONTENT.factionNames.get(raid.faction) ?? raid.faction;
    const guardHeads = outgoingExpedition.residentEscort?.guards ?? 0;
    const porterHeads = outgoingExpedition.residentEscort?.porters ?? 0;
    const tripLength = outgoingExpedition.legTurns ?? outgoingExpedition.turnsLeft;
    const canRescue = hasCaptiveHeldBy(game, raid.faction);
    const visibleAttackGoals = ATTACK_GOALS.filter(
      (goal) => (goal.id !== 'rescue' || canRescue) && (goal.id !== 'enslave' || guardHeads >= 1),
    );

    return (
      <div className="overlay">
        <div className="event-panel raid-modal">
          <div className="raid-modal-art">
            <Illustration assetKey="raid_battle" />
          </div>
          <div className="raid-modal-content">
            <div className="raid-heading">
              <h2>Raiders at {raid.targetName}</h2>
              <p className="text">
                Your party has reached {raid.targetName} in {faction} country.{' '}
                {raid.spotted
                  ? 'Watchfires rise before the strike; the defenders are ready for blood.'
                  : 'They are in place before the alarm can spread.'}
                {raid.ally
                  ? ` ${CONTENT.factionNames.get(raid.ally) ?? raid.ally} riders wait beside them.`
                  : ''}
              </p>
            </div>

            <div className="raid-forces">
              <span className="statchip">Raid force: {formatScore(outgoingBreakdown.total)}</span>
              <span className="statchip">Defenders: {raid.defenderForce}</span>
              <span className="statchip">Enemy maneuver: {cap(raid.defenderManeuver)}</span>
            </div>

            <div className="raid-breakdown-grid">
              <BreakdownCard
                label="Heroes in the strike"
                value={`+${formatScore(outgoingBreakdown.heroes)}`}
                note={`${outgoingExpedition.heroIds.length} hero${outgoingExpedition.heroIds.length === 1 ? '' : 'es'} in the party`}
              />
              <BreakdownCard
                label="Guard escort"
                value={`+${formatScore(outgoingBreakdown.guards)}`}
                note={`${guardHeads} guard${guardHeads === 1 ? '' : 's'} riding with the raid`}
              />
              <BreakdownCard
                label="Porters and packs"
                value={`${outgoingBreakdown.cargoCapacity}`}
                note={`${porterHeads} porter${porterHeads === 1 ? '' : 's'}; total haul capacity`}
              />
              <BreakdownCard
                label="Allied riders"
                value={`+${formatScore(outgoingBreakdown.ally)}`}
                note={raid.ally ? 'A friendly faction lends weight to the blow.' : 'No ally was called in.'}
              />
              <BreakdownCard
                label="Long march"
                value={`-${formatScore(outgoingBreakdown.distancePenalty)}`}
                note={`${tripLength} turn${tripLength === 1 ? '' : 's'} from home`}
              />
            </div>

            <div className="raid-plan-grid">
              <section className="raid-plan-card">
                <div className="raid-choice-label">Battle goal</div>
                <div className="raid-option-grid">
                  {visibleAttackGoals.map((goal) => (
                    <button
                      key={goal.id}
                      className={`raid-option ${attackGoal === goal.id ? 'selected' : ''}`}
                      onClick={() => setAttackGoal(goal.id)}
                    >
                      {goal.label}
                      <span className="check-hint">{goal.hint}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="raid-plan-card">
                <div className="raid-choice-label">Maneuver</div>
                <div className="raid-option-grid raid-option-grid--three">
                  {MANEUVERS.map((option) => (
                    <button
                      key={option.id}
                      className={`raid-option ${maneuver === option.id ? 'selected' : ''}`}
                      onClick={() => setManeuver(option.id)}
                    >
                      {option.label}
                      <span className="check-hint">{option.hint}</span>
                    </button>
                  ))}
                </div>

                {canRally && (
                  <label className="raid-rally">
                    <input
                      type="checkbox"
                      checked={rally}
                      onChange={(e) => setRally(e.target.checked)}
                    />
                    Rally the raiders before the strike for a leadership check and added force.
                  </label>
                )}

                <button
                  className="primary raid-submit"
                  onClick={() => resolveRaid({ goal: attackGoal, maneuver, rally })}
                >
                  Give the word {'->'}
                </button>
              </section>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
