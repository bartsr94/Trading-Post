// Portrait asset registry. Art lives in src/assets/portraits/<culture>/ named
// <culture>_<gender>_<NN>.webp or <culture>_<ethnicity>_<gender>_<NN>.webp and is
// addressed by basename (e.g. "kiswani_bayuk_female_01") from content `portraitKey`
// strings. imanian (Ansberrian/Imanian company folk), kiswani, dustwalker, bejasi
// (per lore spec §6). Keys with no matching file fall back to the hash-hue
// placeholder in Portrait.tsx, so keys for not-yet-painted pools are fine.
// New source art should be run through `node scripts/optimize-images.mjs` before
// being committed — it lands at full camera resolution otherwise (perf audit,
// 2026-07-23: 22 files were 60.8MB before that pass, 0.3MB after).

const modules = import.meta.glob('../assets/portraits/*/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

export const PORTRAIT_URLS: Map<string, string> = new Map(
  Object.entries(modules).map(([path, url]) => {
    const file = path.split('/').pop()!;
    return [file.replace(/\.[^.]+$/, '').toLowerCase(), url];
  }),
);

export function portraitUrl(key: string | undefined): string | undefined {
  return key !== undefined ? PORTRAIT_URLS.get(key.toLowerCase()) : undefined;
}

type PortraitGender = 'male' | 'female';

function parsePortraitKey(key: string): {
  culture: string;
  ethnicity?: string;
  gender: PortraitGender;
  index: string;
} | null {
  const parts = key.toLowerCase().split('_');
  if (parts.length < 3) return null;
  const index = parts[parts.length - 1] ?? '';
  const gender = parts[parts.length - 2];
  if (gender !== 'male' && gender !== 'female') return null;
  const culture = parts[0] ?? '';
  if (!culture) return null;
  const ethnicityParts = parts.slice(1, parts.length - 2);
  const ethnicity = ethnicityParts.length > 0 ? ethnicityParts.join('_') : undefined;
  return { culture, ethnicity, gender, index };
}

function parsePortraitPrefix(prefix: string): {
  culture: string;
  ethnicity?: string;
  gender: PortraitGender;
} | null {
  const parts = prefix.toLowerCase().split('_');
  if (parts.length < 2) return null;
  const gender = parts[parts.length - 1];
  if (gender !== 'male' && gender !== 'female') return null;
  const culture = parts[0] ?? '';
  if (!culture) return null;
  const ethnicityParts = parts.slice(1, parts.length - 1);
  const ethnicity = ethnicityParts.length > 0 ? ethnicityParts.join('_') : undefined;
  return { culture, ethnicity, gender };
}

/**
 * Painted portrait keys for a culture+gender pool (e.g. "kiswani_female").
 * If an ethnicity is included (e.g. "kiswani_bayuk_female"), the pool is
 * restricted to that ethnicity; otherwise, all ethnicities for the culture are eligible.
 */
export function portraitKeysFor(prefix: string): string[] {
  const want = parsePortraitPrefix(prefix);
  if (!want) return [];

  const out: string[] = [];
  for (const key of PORTRAIT_URLS.keys()) {
    const got = parsePortraitKey(key);
    if (!got) continue;
    if (got.culture !== want.culture) continue;
    if (got.gender !== want.gender) continue;
    if (want.ethnicity !== undefined && got.ethnicity !== want.ethnicity) continue;
    out.push(key);
  }
  return out.sort();
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
