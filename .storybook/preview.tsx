import type { Preview } from '@storybook/react-vite';
import '../src/styles/index.css';

const preview: Preview = {
  globalTypes: {
    theme: { description: 'CashGear theme', defaultValue: 'light', toolbar: { icon: 'paintbrush', items: ['light', 'dark'] } },
    density: { description: 'Control density', defaultValue: 'comfortable', toolbar: { icon: 'component', items: ['comfortable', 'compact'] } },
    direction: { description: 'Writing direction', defaultValue: 'ltr', toolbar: { icon: 'transfer', items: ['ltr', 'rtl'] } },
  },
  decorators: [
    (Story, context) => {
      const globals = context.globals as Record<string, unknown>;
      const theme = globals.theme === 'dark' ? 'dark' : 'light';
      const density = globals.density === 'compact' ? 'compact' : 'comfortable';
      const direction = globals.direction === 'rtl' ? 'rtl' : 'ltr';
      return (
        <div
          data-cg-theme={theme}
          data-cg-density={density}
          dir={direction}
          style={{ minHeight: '100vh', padding: '1.5rem', color: 'var(--cg-text)', background: 'var(--cg-page-bg)', fontFamily: 'var(--cg-font-family)' }}
        >
          <Story />
        </div>
      );
    },
  ],
  parameters: {
    controls: { expanded: true },
    a11y: { test: 'todo' },
  },
};

export default preview;
