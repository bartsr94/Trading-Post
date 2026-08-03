// Flavor-only personality tags for dependants (DEPENDANT_SHEET_SPEC.md) —
// mirrors `Hero.temperament`'s "engine never branches on specific values"
// contract, but goes one step further: never stored. `pickDependantTemperament`
// hashes a stable seed (the dependant's own id) into this pool the same way
// `ui/portraits.ts`'s `pickPortraitKey` hashes a seed into a portrait pool, so
// the same dependant always reads the same personality without needing
// content to hand-author one for every spouse/child/kin the game creates.

const DEPENDANT_TEMPERAMENT_POOL: readonly (readonly [string, string])[] = [
  ['warm', 'steadfast'],
  ['sharp-tongued', 'clever'],
  ['guarded', 'watchful'],
  ['devout', 'gentle'],
  ['restless', 'quick-tempered'],
  ['patient', 'quiet'],
  ['proud', 'stubborn'],
  ['cheerful', 'talkative'],
  ['stern', 'dutiful'],
  ['shy', 'tender'],
  ['bold', 'reckless'],
  ['wry', 'weathered'],
];

export function pickDependantTemperament(seed: string): string[] {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const pair = DEPENDANT_TEMPERAMENT_POOL[Math.abs(hash) % DEPENDANT_TEMPERAMENT_POOL.length];
  return [...pair];
}
