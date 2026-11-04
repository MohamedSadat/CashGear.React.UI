interface Hsl { hue: number; saturation: number; lightness: number }

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/iu;

/** Lowercase `#rrggbb`. Tints need the channel values, so CSS color names aren't accepted. */
export function normalizeHexColor(color: string, owner: string): string {
  if (!HEX_COLOR.test(color)) throw new RangeError(`${owner} needs a #rgb or #rrggbb color, received '${color}'.`);
  const lower = color.toLowerCase();
  return lower.length === 7 ? lower : `#${lower[1]!}${lower[1]!}${lower[2]!}${lower[2]!}${lower[3]!}${lower[3]!}`;
}

function toHsl(hex: string): Hsl {
  const channel = (start: number) => Number.parseInt(hex.slice(start, start + 2), 16) / 255;
  const [red, green, blue] = [channel(1), channel(3), channel(5)];
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const spread = max - min;
  if (spread === 0) return { hue: 0, saturation: 0, lightness };
  const saturation = spread / (lightness > 0.5 ? 2 - max - min : max + min);
  const sector = max === red ? (green - blue) / spread + (green < blue ? 6 : 0) : max === green ? (blue - red) / spread + 2 : (red - green) / spread + 4;
  return { hue: sector / 6, saturation, lightness };
}

function toHex({ hue, saturation, lightness }: Hsl): string {
  const upper = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
  const lower = 2 * lightness - upper;
  const channel = (offset: number) => {
    const turn = (hue + offset + 1) % 1;
    const value = turn < 1 / 6 ? lower + (upper - lower) * 6 * turn
      : turn < 1 / 2 ? upper
        : turn < 2 / 3 ? lower + (upper - lower) * (2 / 3 - turn) * 6
          : lower;
    return Math.round(value * 255).toString(16).padStart(2, '0');
  };
  return `#${channel(1 / 3)}${channel(0)}${channel(-1 / 3)}`;
}

/** A positive tint moves lightness towards white and a negative one towards black, as spreadsheet theme colors do. */
export function applyTint(hex: string, tint: number): string {
  if (tint === 0) return hex;
  const hsl = toHsl(hex);
  const lightness = tint < 0 ? hsl.lightness * (1 + tint) : hsl.lightness * (1 - tint) + tint;
  return toHex({ ...hsl, lightness: Math.min(1, Math.max(0, lightness)) });
}

/** The five shades a theme color offers, chosen by how light it is so that each one stays visible. */
export function defaultTints(hex: string): ReadonlyArray<number> {
  const { lightness } = toHsl(hex);
  if (lightness === 0) return [0.5, 0.35, 0.25, 0.15, 0.05];
  if (lightness === 1) return [-0.05, -0.15, -0.25, -0.35, -0.5];
  if (lightness < 0.2) return [0.9, 0.75, 0.5, 0.25, 0.1];
  if (lightness > 0.8) return [-0.1, -0.25, -0.5, -0.75, -0.9];
  return [0.8, 0.6, 0.4, -0.25, -0.5];
}

/** Spreadsheet files store tints such as 0.79998, so close values name the same shade. */
export function sameTint(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.005;
}
