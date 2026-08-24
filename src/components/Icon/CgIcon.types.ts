import type { SVGAttributes } from 'react';
import type { CgIconName } from '../../types';

export interface CgIconProps extends Omit<SVGAttributes<SVGSVGElement>, 'children' | 'name'> {
  name: CgIconName;
  size?: number | string;
  label?: string;
}
