import type { ReactNode } from 'react';

export interface StoryFrameProps {
  source: string;
  difference: string;
  children: ReactNode;
}

export function StoryFrame({ source, difference, children }: StoryFrameProps) {
  return (
    <section data-cg-story-root="" style={{ display: 'grid', gap: '1rem', maxWidth: 820 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'end' }}>{children}</div>
      <small style={{ color: 'var(--cg-text-secondary)' }}>
        <strong>Razor:</strong> {source}<br />
        <strong>Known difference:</strong> {difference}
      </small>
    </section>
  );
}

export const parityParameters = (source: string, difference: string) => ({
  docs: {
    description: {
      component: `Razor source/demo: \`${source}\`. Known difference: ${difference}`,
    },
  },
});
