import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import { fluentIconAccentPaths, fluentIconPaths } from '../../vendor/fluent-icons/icons';
import type { FluentAccentIconName, FluentIconName } from '../../vendor/fluent-icons/icons';
import { cx } from '../../utils';
import styles from './CgIcon.module.css';
import type { CgIconProps } from './CgIcon.types';

type StrokeIconName = Exclude<CgIconProps['name'], FluentIconName>;

const paths: Record<StrokeIconName, ReactNode> = {
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 4.5 4.5" /></>,
  clear: <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6m0-6-6 6" /></>,
  close: <path d="M5 5l14 14M19 5 5 19" />,
  eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
  'eye-off': <><path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6 0 9.5 6 9.5 6a15 15 0 0 1-2.2 3M6.7 6.7C4 8.4 2.5 12 2.5 12S6 18 12 18c1.3 0 2.5-.3 3.6-.7" /></>,
  check: <path d="m4 12 5 5L20 6" />,
  minus: <path d="M4 12h16" />,
  'chevron-up': <path d="m5 15 7-7 7 7" />,
  'chevron-down': <path d="m5 9 7 7 7-7" />,
  'chevron-start': <path d="m15 5-7 7 7 7" />,
  'chevron-end': <path d="m9 5 7 7-7 7" />,
  sidebar: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></>,
  'zoom-out': <><circle cx="10.5" cy="10.5" r="6.5" /><path d="M7.5 10.5h6m2 5 4.5 4.5" /></>,
  'zoom-in': <><circle cx="10.5" cy="10.5" r="6.5" /><path d="M7.5 10.5h6m-3-3v6m5 2 4.5 4.5" /></>,
  rotate: <><path d="M20 7v5h-5" /><path d="M19 12a7 7 0 1 0-2 5" /></>,
  print: <><path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" /><path d="M7 14h10v7H7z" /></>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5" /><path d="M5 21h14" /></>,
  fullscreen: <><path d="M8 3H3v5m13-5h5v5M8 21H3v-5m13 5h5v-5" /></>,
};

function isFluentIcon(name: CgIconProps['name']): name is FluentIconName {
  return Object.hasOwn(fluentIconPaths, name);
}

export const CgIcon = forwardRef<SVGSVGElement, CgIconProps>(function CgIcon(
  { name, size = '1em', label, accentColor, className, ...svgProps },
  ref,
) {
  const labelled = Boolean(label);
  const shared = {
    ...svgProps,
    ref,
    width: size,
    height: size,
    className: cx(styles.icon, (name === 'chevron-start' || name === 'chevron-end') && styles.logical, className),
    'aria-hidden': labelled ? undefined : true,
    'aria-label': label,
    role: labelled ? 'img' : undefined,
    focusable: 'false',
  } as const;
  if (isFluentIcon(name)) {
    const accentPath = accentColor === undefined ? undefined : fluentIconAccentPaths[name as FluentAccentIconName];
    return (
      <svg {...shared} viewBox="0 0 20 20" fill="currentColor">
        {accentPath ? <path d={accentPath} fill={accentColor} data-cg-icon-accent="" /> : null}
        <path d={fluentIconPaths[name]} />
      </svg>
    );
  }
  return (
    <svg {...shared} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
});
