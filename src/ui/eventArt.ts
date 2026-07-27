// Event illustration registry. Art lives in src/assets/events/ named
// <illustration-key>.webp (or .png/.jpg) and is addressed by basename — the
// exact string an event's `illustration` field carries (e.g. 'orc_demand').
// Keys with no matching file fall back to the hash-hue placeholder panel in
// Illustration.tsx, so keys for not-yet-painted events are fine. Same
// eager-glob/basename-lookup approach as ui/portraits.ts.
// Run new source art through `node scripts/optimize-images.mjs` before
// committing (resizes + converts to WebP).

const modules = import.meta.glob('../assets/events/*.{webp,png,jpg,jpeg}', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

export const EVENT_ART_URLS: Map<string, string> = new Map(
  Object.entries(modules).map(([path, url]) => {
    const file = path.split('/').pop()!;
    return [file.replace(/\.[^.]+$/, '').toLowerCase(), url];
  }),
);

export function eventArtUrl(key: string): string | undefined {
  return EVENT_ART_URLS.get(key.toLowerCase());
}
