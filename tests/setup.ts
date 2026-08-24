import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// React Testing Library does not auto-clean when `globals` are provided by
// Vitest rather than Jest, so unmount explicitly between tests.
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
