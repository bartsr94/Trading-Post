/** Build a content registry while failing fast on duplicate stable IDs. */
export function uniqueIdMap<K extends PropertyKey, T extends { id: K }>(
  kind: string,
  items: readonly T[],
): ReadonlyMap<K, T> {
  const registry = new Map<K, T>();
  for (const item of items) {
    if (registry.has(item.id)) {
      throw new Error(`Duplicate ${kind} id: ${String(item.id)}`);
    }
    registry.set(item.id, item);
  }
  return registry;
}
