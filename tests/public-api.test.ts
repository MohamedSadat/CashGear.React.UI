import { describe, expect, it } from 'vitest';
import * as publicApi from '../src/index';

/**
 * Guards the public surface of the package. Adding an export is a deliberate
 * act: update this list in the same commit and the reviewer sees the API change.
 */
const EXPECTED_RUNTIME_EXPORTS = [
  'CgButton',
  'CgTextBox',
  'cx',
  'useCgId',
  'useControllableState',
] as const;

describe('@cashgear/ui public API', () => {
  it('exports exactly the documented runtime members', () => {
    expect(Object.keys(publicApi).sort()).toEqual([...EXPECTED_RUNTIME_EXPORTS]);
  });

  it('does not leak internal implementation modules', () => {
    for (const key of Object.keys(publicApi)) {
      expect(key).not.toMatch(/^(styles|internal|_)/);
    }
  });
});
