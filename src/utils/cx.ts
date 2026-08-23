/**
 * Minimal class-name joiner.
 *
 * Deliberately dependency-free — pulling `clsx`/`classnames` into a shared
 * library forces that dependency on every consuming application.
 */
export type CgClassValue = string | number | false | null | undefined;

export function cx(...values: CgClassValue[]): string {
  let out = '';
  for (const value of values) {
    if (!value && value !== 0) continue;
    out = out ? `${out} ${String(value)}` : String(value);
  }
  return out;
}
