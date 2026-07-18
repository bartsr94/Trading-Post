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
