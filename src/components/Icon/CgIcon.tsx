import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import { cx } from '../../utils';
import styles from './CgIcon.module.css';
import type { CgIconProps } from './CgIcon.types';

const paths: Record<CgIconProps['name'], ReactNode> = {
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
};

export const CgIcon = forwardRef<SVGSVGElement, CgIconProps>(function CgIcon(
  { name, size = '1em', label, className, ...svgProps },
  ref,
) {
  const labelled = Boolean(label);
  return (
    <svg
      {...svgProps}
      ref={ref}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx(styles.icon, (name === 'chevron-start' || name === 'chevron-end') && styles.logical, className)}
      aria-hidden={labelled ? undefined : true}
      aria-label={label}
      role={labelled ? 'img' : undefined}
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
});
