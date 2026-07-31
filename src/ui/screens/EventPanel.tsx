// Event Panel (spec §11) — the screen with the most polish budget.
// Illustration, body text, choices, inline dice with the full breakdown.

import { useState } from 'react';
import { FACTION_DEFS } from '../../content/factions';
import { LOCATION_DEFS } from '../../content/locations';
import { CONTENT } from '../../content/registry';
import { evalConditions } from '../../engine/events/conditions';
import { interpolate } from '../../engine/events/text';
import type { Choice } from '../../engine/events/types';
import { spouseCount } from '../../engine/family';
import { cap, getHero } from '../../engine/types';
import type { GameState, Hero } from '../../engine/types';
import { travelContextOf, useGameStore } from '../../store/gameStore';
import { DiceRoll } from '../components/DiceRoll';
import { EventCast } from '../components/EventCast';
import { Illustration } from '../components/Illustration';

// Matches TUNING.family.maxSpousesPerHero — a hero can never reach a 4th.
const SPOUSE_ORDINALS = ['first', 'second', 'third'] as const;

function checkHint(state: GameState, choice: Choice): string | null {
  if (!choice.check) return null;
  const difficulty =
    typeof choice.check.difficulty === 'function'
      ? choice.check.difficulty(state)
      : choice.check.difficulty;
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
  const partnerId = active.vars?.partnerId;
  const partner = typeof partnerId === 'string' ? game.heroes.find((h) => h.id === partnerId) : undefined;
  const cast: Hero[] = partner && partner.id !== hero.id ? [hero, partner] : [hero];
  const ctx = {
    heroName: hero.name,
    heroGender: hero.gender,
    destinationName: travel?.destination.name ?? contactSeat?.name,
    factionName: contactSeat?.faction ? FACTION_DEFS.get(contactSeat.faction)?.name : undefined,
    partnerName: partner?.name,
    spouseRank: `${SPOUSE_ORDINALS[spouseCount(game, hero.id)] ?? 'next'} wife`,
  };
  const showResult = resolution !== null && (resolution.check === null || diceSettled);

  return (
    <div className="overlay">
      <div className="event-panel">
        <div className="event-illustration-wrap">
          <Illustration assetKey={resolution?.illustration ?? event.illustration} />
          <EventCast heroes={cast} />
        </div>
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
