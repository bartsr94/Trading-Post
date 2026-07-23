// Event Panel (spec §11) — the screen with the most polish budget.
// Illustration, body text, choices, inline dice with the full breakdown.

import { useState } from 'react';
import { FACTION_DEFS } from '../../content/factions';
import { LOCATION_DEFS } from '../../content/locations';
import { CONTENT } from '../../content/registry';
import { evalConditions } from '../../engine/events/conditions';
import { interpolate } from '../../engine/events/text';
import type { Choice } from '../../engine/events/types';
import { getHero } from '../../engine/types';
import type { GameState } from '../../engine/types';
import { travelContextOf, useGameStore } from '../../store/gameStore';
import { DiceRoll } from '../components/DiceRoll';
import { Illustration } from '../components/Illustration';

function checkHint(state: GameState, choice: Choice): string | null {
  if (!choice.check) return null;
  const difficulty =
    typeof choice.check.difficulty === 'function'
      ? choice.check.difficulty(state)
      : choice.check.difficulty;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return `${cap(choice.check.skill)} + ${cap(choice.check.stat)} vs ${difficulty}`;
}

export function EventPanel({ game }: { game: GameState }) {
  const chooseOption = useGameStore((s) => s.chooseOption);
  const continueEvent = useGameStore((s) => s.continueEvent);
  const resolution = useGameStore((s) => s.lastResolution);
  const [diceSettled, setDiceSettled] = useState(false);

  const active = game.pendingEvents[0];
  if (!active) return null;
  const event = CONTENT.events.get(active.eventId);
  if (!event) return null;
  const hero = getHero(game, active.heroId);
  const travel = travelContextOf(game, active);
  const contactSeat = !travel && active.locationId ? LOCATION_DEFS.get(active.locationId) : undefined;
  const ctx = {
    heroName: hero.name,
    destinationName: travel?.destination.name ?? contactSeat?.name,
    factionName: contactSeat?.faction ? FACTION_DEFS.get(contactSeat.faction)?.name : undefined,
  };
  const showResult = resolution !== null && (resolution.check === null || diceSettled);

  return (
    <div className="overlay">
      <div className="event-panel">
        <Illustration assetKey={event.illustration} />
        <div className="event-body">
          <h2>{event.title}</h2>
          {resolution === null ? (
            <>
              <div className="text">{interpolate(event.text, ctx)}</div>
              <div className="choice-list">
                {event.choices.map((choice, i) => {
                  const available =
                    !choice.requires ||
                    evalConditions(game, choice.requires, {
                      travel,
                      heroId: active.heroId,
                      chainVars: active.vars,
                    });
                  const hint = checkHint(game, choice);
                  return (
                    <button
                      key={i}
                      disabled={!available}
                      onClick={() => {
                        setDiceSettled(false);
                        chooseOption(i);
                      }}
                    >
                      {interpolate(choice.label, ctx)}
                      {hint && <span className="check-hint">🎲 {hint}</span>}
                      {!available && <span className="lock-hint">You lack the means.</span>}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {resolution.check && (
                <DiceRoll result={resolution.check} onSettled={() => setDiceSettled(true)} />
              )}
              {showResult && (
                <>
                  <div className="result-text">{interpolate(resolution.resultText, ctx)}</div>
                  {resolution.log.length > 0 && (
                    <div className="outcome-log">
                      {resolution.log.map((line, i) => (
                        <div key={i}>• {line}</div>
                      ))}
                    </div>
                  )}
                  <button className="primary" onClick={continueEvent}>
                    Continue ▸
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
