// Template interpolation for event text: {hero} → bound hero's name.

export interface TextContext {
  heroName: string;
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

export function interpolate(text: string, ctx: TextContext): string {
  return text
    .replaceAll('{hero}', ctx.heroName)
    .replaceAll('{post}', ctx.postName ?? 'the post')
    .replaceAll('{destination}', ctx.destinationName ?? 'the road')
    .replaceAll('{faction}', ctx.factionName ?? 'this people')
    .replaceAll('{partner}', ctx.partnerName ?? 'them');
}
