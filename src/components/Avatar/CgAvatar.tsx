import { forwardRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { cx } from '../../utils';
import styles from './CgAvatar.module.css';
import type { CgAvatarProps } from './CgAvatar.types';
import { avatarInitials } from './initials';

export const CgAvatar = forwardRef<HTMLSpanElement, CgAvatarProps>(function CgAvatar(
  { name, initials, color, textColor, src, size = 'small', decorative = false, className, style, title, ...nativeProps },
  forwardedRef,
) {
  if (!decorative && !name.trim()) throw new Error('CgAvatar name cannot be empty unless the avatar is decorative.');
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const letters = initials ?? avatarInitials(name);
  const showImage = src !== undefined && src !== '' && failedSource !== src;
  const colours = {
    ...(color !== undefined ? { '--cg-avatar-background': color, '--cg-avatar-color': textColor ?? '#fff' } : {}),
    ...(color === undefined && textColor !== undefined ? { '--cg-avatar-color': textColor } : {}),
    ...style,
  } as CSSProperties;
  return <span
    {...nativeProps}
    ref={forwardedRef}
    className={cx(styles.avatar, styles[size], className)}
    style={colours}
    data-cg-avatar=""
    data-size={size}
    {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': name, title: title ?? name })}
  >
    <span className={styles.initials} aria-hidden="true">{letters}</span>
    {showImage ? <img className={styles.image} src={src} alt="" draggable={false} onError={() => setFailedSource(src)} /> : null}
  </span>;
});
