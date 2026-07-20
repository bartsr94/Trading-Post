// Portrait asset registry. Art lives in src/assets/portraits/<race>/ named
// <race>_<gender>_<NN>.png (e.g. imanian/imanian_male_02.png) and is addressed
// by basename ("imanian_male_02") from HeroTemplate.portraitKey. Race pools:
// imanian (Ansberrian/Imanian company folk), kiswani, dustwalker, bejasi
// (per lore spec §6). Keys with no matching file fall back to the hash-hue
// placeholder in Portrait.tsx, so keys for not-yet-painted pools are fine.

const modules = import.meta.glob('../assets/portraits/*/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

export const PORTRAIT_URLS: Map<string, string> = new Map(
  Object.entries(modules).map(([path, url]) => {
    const file = path.split('/').pop()!;
    return [file.replace(/\.[^.]+$/, ''), url];
  }),
);

export function portraitUrl(key: string | undefined): string | undefined {
  return key !== undefined ? PORTRAIT_URLS.get(key) : undefined;
}

/** Painted portrait keys for a race_gender prefix (e.g. "kiswani_female"). */
export function portraitKeysFor(prefix: string): string[] {
  return [...PORTRAIT_URLS.keys()].filter((k) => k.startsWith(`${prefix}_`)).sort();
}

/**
 * Deterministically pick a portrait key from a race_gender pool by a stable seed
 * (e.g. a dependant id), so unnamed family show real art where a pool exists and
 * the same person always gets the same face. Returns undefined if the pool is empty.
 */
export function pickPortraitKey(prefix: string, seed: string): string | undefined {
  const keys = portraitKeysFor(prefix);
  if (keys.length === 0) return undefined;
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return keys[Math.abs(hash) % keys.length];
}
