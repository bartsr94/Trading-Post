// Turn Report (spec §11): compact end-of-turn summary.

import { GOOD_NAMES } from '../../content/goods';
import { seasonOfTurn, yearOfTurn } from '../../engine/types';
import type { GameState, GoodId } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';

export function TurnReport({ game }: { game: GameState }) {
  const finishReport = useGameStore((s) => s.finishReport);
  const report = game.report;
  const goodsDeltas = Object.entries(report.goodsDelta) as [GoodId, number][];

  return (
    <div className="overlay">
      <div className="panel" style={{ width: 'min(560px, 94vw)' }}>
        <h2>
          Turn {report.turn} — {seasonOfTurn(report.turn)}, year {yearOfTurn(report.turn)}
        </h2>
        <div className="report-lines">
          {report.lines.map((line, i) => (
            <div key={i} className="line">
              {line.icon} {line.text}
            </div>
          ))}
        </div>
        <div style={{ fontSize: '0.95rem', marginBottom: 16 }}>
          <div>
            Silver:{' '}
            <b className={report.silverDelta >= 0 ? 'good' : 'bad'}>
              {report.silverDelta >= 0 ? '+' : ''}
              {report.silverDelta}
            </b>{' '}
            <span className="dim">(now {game.silver})</span>
          </div>
          {goodsDeltas.length > 0 && (
            <div>
              Goods:{' '}
              {goodsDeltas.map(([good, delta], i) => (
                <span key={good}>
                  {i > 0 && ', '}
                  <span className={delta >= 0 ? 'good' : 'bad'}>
                    {delta >= 0 ? '+' : ''}
                    {delta}
                  </span>{' '}
                  {GOOD_NAMES.get(good) ?? good}
                </span>
              ))}
            </div>
          )}
        </div>
        <button className="primary" onClick={finishReport}>
          Begin Next Turn ▸
        </button>
      </div>
    </div>
  );
}
