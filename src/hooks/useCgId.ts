import { useId } from 'react';

/**
 * Returns a stable, SSR-safe DOM id: the caller's explicit id when supplied,
 * otherwise a generated one.
 *
 * Every labelled control needs this to wire `<label for>`, `aria-describedby`
 * and `aria-errormessage` without forcing consumers to invent ids by hand.
 */
export function useCgId(providedId?: string): string {
  const generatedId = useId();
  return providedId ?? `cg-${generatedId.replace(/[^a-zA-Z0-9-]/g, '')}`;
}
