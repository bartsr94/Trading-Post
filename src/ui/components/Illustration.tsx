// Real art when assetKey resolves to a file in src/assets/events/, else the
// flat placeholder used since spec §11: a colored 16:9 panel with a label.
// Layout reserves the final aspect ratio either way, so dropping in art never
// reflows the panel (same placeholder philosophy as Portrait.tsx).

import { eventArtUrl } from '../eventArt';

export function Illustration({ assetKey }: { assetKey: string }) {
  const url = eventArtUrl(assetKey);
  if (url) return <img className="event-illustration-art" src={url} alt="" draggable={false} />;

  let hash = 0;
  for (const ch of assetKey) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const hue = ((hash % 360) + 360) % 360;
  const style = {
    background: `linear-gradient(160deg, hsl(${hue}, 28%, 30%), hsl(${(hue + 40) % 360}, 30%, 16%))`,
  };
  return (
    <div className="event-illustration" style={style}>
      {assetKey.replaceAll('_', ' ')}
    </div>
  );
}
