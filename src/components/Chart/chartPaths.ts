export interface SvgPoint {
  readonly x: number;
  readonly y: number;
}

export function svgNumber(value: number): string {
  if (!Number.isFinite(value)) throw new RangeError('CgChart SVG coordinates must be finite.');
  const stable = Math.abs(value) < 1e-12 ? 0 : Number.parseFloat(value.toFixed(4));
  return String(stable);
}

export function straightPath(points: ReadonlyArray<SvgPoint>, close = false): string {
  if (!points.length) return '';
  const commands = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${svgNumber(point.x)} ${svgNumber(point.y)}`);
  return `${commands.join(' ')}${close ? ' Z' : ''}`;
}

function monotoneTangents(values: ReadonlyArray<SvgPoint>): number[] {
  if (values.length < 2) return values.map(() => 0);
  const slopes: number[] = [];
  for (let index = 0; index < values.length - 1; index++) {
    const left = values[index]!;
    const right = values[index + 1]!;
    const span = right.x - left.x;
    slopes.push(span === 0 ? 0 : (right.y - left.y) / span);
  }
  const tangents = values.map((_, index) => {
    if (index === 0) return slopes[0] ?? 0;
    if (index === values.length - 1) return slopes.at(-1) ?? 0;
    const before = slopes[index - 1] ?? 0;
    const after = slopes[index] ?? 0;
    if (before === 0 || after === 0 || Math.sign(before) !== Math.sign(after)) return 0;
    return 2 / (1 / before + 1 / after);
  });
  for (let index = 0; index < slopes.length; index++) {
    const slope = slopes[index]!;
    if (slope === 0) {
      tangents[index] = 0;
      tangents[index + 1] = 0;
      continue;
    }
    const a = tangents[index]! / slope;
    const b = tangents[index + 1]! / slope;
    const magnitude = Math.hypot(a, b);
    if (magnitude > 3) {
      const scale = 3 / magnitude;
      tangents[index] = scale * a * slope;
      tangents[index + 1] = scale * b * slope;
    }
  }
  return tangents;
}

export function monotonePath(points: ReadonlyArray<SvgPoint>, primary: 'x' | 'y' = 'x'): string {
  if (points.length < 2) return '';
  const normalized = primary === 'x' ? points : points.map((point) => ({ x: point.y, y: point.x }));
  const tangents = monotoneTangents(normalized);
  const commands = [`M${svgNumber(points[0]!.x)} ${svgNumber(points[0]!.y)}`];
  for (let index = 0; index < normalized.length - 1; index++) {
    const left = normalized[index]!;
    const right = normalized[index + 1]!;
    const span = (right.x - left.x) / 3;
    const c1 = { x: left.x + span, y: left.y + span * tangents[index]! };
    const c2 = { x: right.x - span, y: right.y - span * tangents[index + 1]! };
    if (primary === 'x') {
      commands.push(`C${svgNumber(c1.x)} ${svgNumber(c1.y)} ${svgNumber(c2.x)} ${svgNumber(c2.y)} ${svgNumber(right.x)} ${svgNumber(right.y)}`);
    } else {
      commands.push(`C${svgNumber(c1.y)} ${svgNumber(c1.x)} ${svgNumber(c2.y)} ${svgNumber(c2.x)} ${svgNumber(right.y)} ${svgNumber(right.x)}`);
    }
  }
  return commands.join(' ');
}

export function roundedRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  leading: 'top' | 'bottom' | 'start' | 'end',
): string {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const right = x + width;
  const bottom = y + height;
  if (r === 0) return `M${svgNumber(x)} ${svgNumber(y)}H${svgNumber(right)}V${svgNumber(bottom)}H${svgNumber(x)}Z`;
  if (leading === 'top') return `M${svgNumber(x)} ${svgNumber(bottom)}V${svgNumber(y + r)}Q${svgNumber(x)} ${svgNumber(y)} ${svgNumber(x + r)} ${svgNumber(y)}H${svgNumber(right - r)}Q${svgNumber(right)} ${svgNumber(y)} ${svgNumber(right)} ${svgNumber(y + r)}V${svgNumber(bottom)}Z`;
  if (leading === 'bottom') return `M${svgNumber(x)} ${svgNumber(y)}V${svgNumber(bottom - r)}Q${svgNumber(x)} ${svgNumber(bottom)} ${svgNumber(x + r)} ${svgNumber(bottom)}H${svgNumber(right - r)}Q${svgNumber(right)} ${svgNumber(bottom)} ${svgNumber(right)} ${svgNumber(bottom - r)}V${svgNumber(y)}Z`;
  if (leading === 'start') return `M${svgNumber(right)} ${svgNumber(y)}H${svgNumber(x + r)}Q${svgNumber(x)} ${svgNumber(y)} ${svgNumber(x)} ${svgNumber(y + r)}V${svgNumber(bottom - r)}Q${svgNumber(x)} ${svgNumber(bottom)} ${svgNumber(x + r)} ${svgNumber(bottom)}H${svgNumber(right)}Z`;
  return `M${svgNumber(x)} ${svgNumber(y)}H${svgNumber(right - r)}Q${svgNumber(right)} ${svgNumber(y)} ${svgNumber(right)} ${svgNumber(y + r)}V${svgNumber(bottom - r)}Q${svgNumber(right)} ${svgNumber(bottom)} ${svgNumber(right - r)} ${svgNumber(bottom)}H${svgNumber(x)}Z`;
}

export function arcPath(
  centerX: number,
  centerY: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
): string {
  const point = (radius: number, angle: number) => ({
    x: centerX + Math.cos(angle) * radius,
    y: centerY + Math.sin(angle) * radius,
  });
  const outerStart = point(outerRadius, startAngle);
  const outerEnd = point(outerRadius, endAngle);
  const large = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;
  const sweep = endAngle >= startAngle ? 1 : 0;
  if (innerRadius <= 0) {
    return `M${svgNumber(centerX)} ${svgNumber(centerY)}L${svgNumber(outerStart.x)} ${svgNumber(outerStart.y)}A${svgNumber(outerRadius)} ${svgNumber(outerRadius)} 0 ${large} ${sweep} ${svgNumber(outerEnd.x)} ${svgNumber(outerEnd.y)}Z`;
  }
  const innerEnd = point(innerRadius, endAngle);
  const innerStart = point(innerRadius, startAngle);
  return `M${svgNumber(outerStart.x)} ${svgNumber(outerStart.y)}A${svgNumber(outerRadius)} ${svgNumber(outerRadius)} 0 ${large} ${sweep} ${svgNumber(outerEnd.x)} ${svgNumber(outerEnd.y)}L${svgNumber(innerEnd.x)} ${svgNumber(innerEnd.y)}A${svgNumber(innerRadius)} ${svgNumber(innerRadius)} 0 ${large} ${sweep ? 0 : 1} ${svgNumber(innerStart.x)} ${svgNumber(innerStart.y)}Z`;
}
