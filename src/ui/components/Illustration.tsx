// Flat placeholder event art (spec §11): a colored 16:9 panel with a label.
// Layout reserves the final aspect ratio so real art drops in without reflow.

export function Illustration({ assetKey }: { assetKey: string }) {
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
