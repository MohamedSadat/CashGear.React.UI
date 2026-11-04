import type { SVGAttributes } from 'react';
import type { CgIconName } from '../../types';

export interface CgIconProps extends Omit<SVGAttributes<SVGSVGElement>, 'children' | 'name'> {
  name: CgIconName;
  size?: number | string;
  label?: string;
  /** Fills the colour bar of `text-color`, `fill-color` and `line-color`. Other icons have no bar to fill. */
  accentColor?: string;
}
