import type { HTMLAttributes } from 'react';

export type CgLiveAnnouncerPoliteness = 'polite' | 'assertive';

/** What `ref` gives: the region is written to directly, so announcing never re-renders anything. */
export interface CgLiveAnnouncerHandle {
  /**
   * Reads `message` out. The same message twice in a row is read twice: the region is emptied
   * first and written a frame later. An empty or blank message only clears the region.
   */
  announce(message: string): void;
  /** Empties the region and drops a message waiting for its frame. */
  clear(): void;
}

export interface CgLiveAnnouncerProps extends Omit<HTMLAttributes<HTMLDivElement>,
  'children' | 'role' | 'aria-live' | 'aria-atomic' | 'aria-relevant' | 'dangerouslySetInnerHTML'> {
  /** `polite` waits for the reader to finish; `assertive` interrupts it. Default `polite`. */
  politeness?: CgLiveAnnouncerPoliteness;
  /** Empties the region this many milliseconds after a message, so it is not found later by browsing. Default: kept. */
  clearAfter?: number;
}
