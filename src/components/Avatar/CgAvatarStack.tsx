import { forwardRef } from 'react';
import { cx } from '../../utils';
import { CgAvatar } from './CgAvatar';
import styles from './CgAvatar.module.css';
import type { CgAvatarStackProps } from './CgAvatar.types';

export const CgAvatarStack = forwardRef<HTMLSpanElement, CgAvatarStackProps>(function CgAvatarStack(
  { items, label, max = 4, overflowLabel, size = 'small', variant = 'group', className, title, ...nativeProps },
  forwardedRef,
) {
  if (!label.trim()) throw new Error('CgAvatarStack label cannot be empty.');
  if (!Number.isInteger(max) || max < 1) throw new RangeError('CgAvatarStack max must be a positive integer.');
  if (!items.length) return null;
  const image = variant === 'image';
  const shown = items.slice(0, max);
  const hidden = items.slice(shown.length);
  const overflow = hidden.length ? overflowLabel(hidden) : '';
  return <span
    {...nativeProps}
    ref={forwardedRef}
    className={cx(styles.stack, styles[`stack-${size}`], className)}
    role={image ? 'img' : 'group'}
    aria-label={label}
    title={title ?? (image ? label : undefined)}
    data-cg-avatar-stack=""
    data-variant={variant}
  >
    {shown.map((item) => <CgAvatar key={item.key} name={item.name} initials={item.initials} color={item.color} textColor={item.textColor} src={item.src} size={size} decorative={image} />)}
    {hidden.length ? <span
      className={cx(styles.avatar, styles[size], styles.more)}
      data-cg-avatar-overflow=""
      {...(image ? { 'aria-hidden': true } : { role: 'img', 'aria-label': overflow, title: overflow })}
    ><span className={styles.initials} aria-hidden="true">+{hidden.length}</span></span> : null}
  </span>;
});
