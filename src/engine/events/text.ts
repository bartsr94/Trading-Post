// Template interpolation for event text: {hero} → bound hero's name.

export interface TextContext {
  heroName: string;
  postName?: string;
  /** Destination name for travel events. */
  destinationName?: string;
}

export function interpolate(text: string, ctx: TextContext): string {
  return text
    .replaceAll('{hero}', ctx.heroName)
    .replaceAll('{post}', ctx.postName ?? 'the post')
    .replaceAll('{destination}', ctx.destinationName ?? 'the road');
}
