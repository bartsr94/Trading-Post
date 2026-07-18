// A hero's face: real art when the portraitKey resolves to an asset, else the
// deterministic hash-hue tile with the hero's initial (same placeholder
// philosophy as Illustration.tsx). Fills whatever sized box it's placed in —
// the hero bar tile and the hero sheet both just wrap it.

import { PORTRAIT_KEYS } from '../../content/heroes';
import type { Hero } from '../../engine/types';
import { portraitUrl } from '../portraits';

function portraitHue(key: string): number {
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return ((hash % 360) + 360) % 360;
}

export function Portrait({ hero }: { hero: Hero }) {
  const key = PORTRAIT_KEYS.get(hero.id) ?? hero.id;
  const url = portraitUrl(key);
  if (url) return <img className="portrait-art" src={url} alt="" draggable={false} />;

  const hue = portraitHue(key);
  return (
    <span
      className="portrait-fallback"
      aria-hidden="true"
      style={{
        background: `linear-gradient(160deg, hsl(${hue}, 28%, 32%), hsl(${(hue + 40) % 360}, 30%, 16%))`,
      }}
    >
      {hero.name.charAt(0)}
    </span>
  );
}
