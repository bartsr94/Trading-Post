// Template interpolation for event text: {hero} → bound hero's name.

import type { Gender } from '../types';

export interface TextContext {
  heroName: string;
  /** Bound hero's gender, driving the {he}/{him}/{his}/{himself} pronoun
   *  tokens below. Defaults to 'male' when absent (matches the Hero.gender
   *  fallback elsewhere, e.g. save.ts's migration default) — content that
   *  never binds a variable hero (fixed-gender NPC flavor text) doesn't need
   *  to pass this. */
  heroGender?: Gender;
  postName?: string;
  /** Destination name for travel events, or the seat name for first-contact events. */
  destinationName?: string;
  /** The seat's faction name, for first-contact events. */
  factionName?: string;
  /** The second hero in a two-hero chain, e.g. a hero-to-hero courtship
   *  (FAMILY_PHASE_D_SPEC.md §2.4) — resolved from the active event's
   *  `vars.partnerId`, same pattern as `destinationName`/`factionName`. */
  partnerName?: string;
}

const PRONOUNS: Record<Gender, { he: string; him: string; his: string; himself: string }> = {
  male: { he: 'he', him: 'him', his: 'his', himself: 'himself' },
  female: { he: 'she', him: 'her', his: 'her', himself: 'herself' },
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function interpolate(text: string, ctx: TextContext): string {
  const p = PRONOUNS[ctx.heroGender ?? 'male'];
  return text
    .replaceAll('{hero}', ctx.heroName)
    .replaceAll('{He}', cap(p.he))
    .replaceAll('{he}', p.he)
    .replaceAll('{Him}', cap(p.him))
    .replaceAll('{him}', p.him)
    .replaceAll('{His}', cap(p.his))
    .replaceAll('{his}', p.his)
    .replaceAll('{Himself}', cap(p.himself))
    .replaceAll('{himself}', p.himself)
    .replaceAll('{post}', ctx.postName ?? 'the post')
    .replaceAll('{destination}', ctx.destinationName ?? 'the road')
    .replaceAll('{faction}', ctx.factionName ?? 'this people')
    .replaceAll('{partner}', ctx.partnerName ?? 'them');
}
