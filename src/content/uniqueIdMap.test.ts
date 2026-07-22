import { describe, expect, it } from 'vitest';
import { uniqueIdMap } from './uniqueIdMap';

describe('uniqueIdMap', () => {
  it('builds a registry for unique content IDs', () => {
    const registry = uniqueIdMap('test item', [
      { id: 'one', value: 1 },
      { id: 'two', value: 2 },
    ]);
    expect(registry.get('two')?.value).toBe(2);
  });

  it('fails fast with the content kind and duplicate ID', () => {
    expect(() =>
      uniqueIdMap('test item', [
        { id: 'same', value: 1 },
        { id: 'same', value: 2 },
      ]),
    ).toThrow('Duplicate test item id: same');
  });
});
