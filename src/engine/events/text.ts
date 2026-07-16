// Template interpolation for event text: {hero} → bound hero's name.

export interface TextContext {
  heroName: string;
  postName?: string;
}

export function interpolate(text: string, ctx: TextContext): string {
  return text
    .replaceAll('{hero}', ctx.heroName)
    .replaceAll('{post}', ctx.postName ?? 'the post');
}
