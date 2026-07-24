// Portrait asset registry. Art lives in src/assets/portraits/<culture>/ named
// <culture>_<gender>_<NN>.webp or <culture>_<ethnicity>_<gender>_<NN>.webp and is
// addressed by basename (e.g. "kiswani_bayuk_female_01") from content `portraitKey`
// strings. imanian (Ansberrian/Imanian company folk), kiswani, dustwalker, bejasi
// (per lore spec §6). Keys with no matching file fall back to the hash-hue
// placeholder in Portrait.tsx, so keys for not-yet-painted pools are fine.
// New source art should be run through `node scripts/optimize-images.mjs` before
// being committed — it lands at full camera resolution otherwise (perf audit,
// 2026-07-23: 22 files were 60.8MB before that pass, 0.3MB after).
//
// Child dependants get their own life-stage pool: drop in
// <culture>_[<ethnicity>_]<gender>_child_<NN>.webp (e.g. "imanian_male_child_01")
// alongside the adult art in the same culture folder. Unlike ethnicity, "child"
// is a reserved stage token, not a free-form pool split — a plain adult query
// (no `_child` suffix on the prefix) never matches child-tagged art, and a
// child query falls back to the adult pool when no child art exists yet for
// that culture/gender/ethnicity combo (`pickDependantPortraitKey`, 2026-07-24).

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
type PortraitStage = 'child';

function parsePortraitKey(key: string): {
  culture: string;
  ethnicity?: string;
  gender: PortraitGender;
  stage?: PortraitStage;
  index: string;
} | null {
  const parts = key.toLowerCase().split('_');
  if (parts.length < 3) return null;
  const index = parts[parts.length - 1] ?? '';
  let genderIdx = parts.length - 2;
  let stage: PortraitStage | undefined;
  if (parts[genderIdx] === 'child') {
    stage = 'child';
    genderIdx -= 1;
  }
  const gender = parts[genderIdx];
  if (gender !== 'male' && gender !== 'female') return null;
  const culture = parts[0] ?? '';
  if (!culture) return null;
  const ethnicityParts = parts.slice(1, genderIdx);
  const ethnicity = ethnicityParts.length > 0 ? ethnicityParts.join('_') : undefined;
  return { culture, ethnicity, gender, stage, index };
}

function parsePortraitPrefix(prefix: string): {
  culture: string;
  ethnicity?: string;
  gender: PortraitGender;
  stage?: PortraitStage;
} | null {
  const parts = prefix.toLowerCase().split('_');
  let rest = parts;
  let stage: PortraitStage | undefined;
  if (rest[rest.length - 1] === 'child') {
    stage = 'child';
    rest = rest.slice(0, -1);
  }
  if (rest.length < 2) return null;
  const gender = rest[rest.length - 1];
  if (gender !== 'male' && gender !== 'female') return null;
  const culture = rest[0] ?? '';
  if (!culture) return null;
  const ethnicityParts = rest.slice(1, rest.length - 1);
  const ethnicity = ethnicityParts.length > 0 ? ethnicityParts.join('_') : undefined;
  return { culture, ethnicity, gender, stage };
}

/**
 * Painted portrait keys for a culture+gender pool (e.g. "kiswani_female").
 * If an ethnicity is included (e.g. "kiswani_bayuk_female"), the pool is
 * restricted to that ethnicity; otherwise, all ethnicities for the culture are
 * eligible. Life stage is an exact match, not a free-for-all like ethnicity:
 * a plain query (no `_child` suffix) matches only the adult pool, and a
 * `_child` query matches only child art — use `pickDependantPortraitKey` for
 * the child-falls-back-to-adult behavior dependants want.
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
    if (got.stage !== want.stage) continue;
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

/**
 * Portrait key for a dependant: a `child` dependant draws from the dedicated
 * child pool (`<prefix>_child`), falling back to the ordinary adult pool when
 * no child art exists yet for that culture/gender/ethnicity combo. Non-child
 * dependants (spouse/kin) always use the adult pool. Since this is evaluated
 * fresh at every render off the dependant's live `kind`, a child coming of age
 * (kind flips to 'kin') switches back to the adult pool for free.
 */
export function pickDependantPortraitKey(
  prefix: string,
  seed: string,
  isChild: boolean,
): string | undefined {
  if (isChild) {
    const childKey = pickPortraitKey(`${prefix}_child`, seed);
    if (childKey) return childKey;
  }
  return pickPortraitKey(prefix, seed);
}
