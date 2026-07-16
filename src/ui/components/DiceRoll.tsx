// Animated 2d6 reveal (spec §5): dice tumble, then settle on the engine's
// already-resolved values and the full breakdown line appears.

import { useEffect, useState } from 'react';
import type { CheckResult } from '../../engine/checks';
import { checkBreakdown } from '../../engine/checks';

const TIER_CLASS: Record<CheckResult['tier'], string> = {
  critSuccess: 'crit',
  success: 'good',
  failure: 'bad',
  critFailure: 'bad',
};

const TIER_TEXT: Record<CheckResult['tier'], string> = {
  critSuccess: 'Critical Success!',
  success: 'Success',
  failure: 'Failure',
  critFailure: 'Critical Failure!',
};

export function DiceRoll({ result, onSettled }: { result: CheckResult; onSettled: () => void }) {
  const [rolling, setRolling] = useState(true);
  const [faces, setFaces] = useState<[number, number]>([1, 6]);

  useEffect(() => {
    setRolling(true);
    const tumble = setInterval(() => {
      setFaces([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]);
    }, 80);
    const settle = setTimeout(() => {
      clearInterval(tumble);
      setFaces([result.d1, result.d2]);
      setRolling(false);
      onSettled();
    }, 900);
    return () => {
      clearInterval(tumble);
      clearTimeout(settle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  return (
    <div>
      <div className="dice-area">
        <div className={`die ${rolling ? 'rolling' : ''}`}>{faces[0]}</div>
        <div className={`die ${rolling ? 'rolling' : ''}`}>{faces[1]}</div>
        {!rolling && (
          <span className={`tier-label ${TIER_CLASS[result.tier]}`}>{TIER_TEXT[result.tier]}</span>
        )}
      </div>
      {!rolling && <div className="breakdown">🎲 {checkBreakdown(result)}</div>}
    </div>
  );
}
