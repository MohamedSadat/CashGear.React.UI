export type CgRouteMatchMode = 'exact' | 'prefix' | 'ignore-query-and-fragment';

const ALLOWED_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);

export function validateSafeUrl(value: string | undefined, componentName: string): string | undefined {
  if (value === undefined) return undefined;
  const url = value.trim();
  if (!url) return undefined;
  const compact = [...url].filter((character) => {
    const code = character.charCodeAt(0);
    return code > 32 && code !== 127 && !(code >= 128 && code <= 159) && !/\s/u.test(character);
  }).join('');
  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(compact)?.[1]?.toLowerCase();
  if (scheme && !ALLOWED_SCHEMES.has(`${scheme}:`)) {
    throw new Error(`${componentName} URL uses unsafe or unsupported scheme '${scheme}'.`);
  }
  return url;
}

function normalizedPath(pathname: string): string {
  if (pathname === '/') return pathname;
  return pathname.replace(/\/+$/, '') || '/';
}

export function isAbsoluteRoute(value: string): boolean {
  return /^[a-z][a-z\d+.-]*:/i.test(value.trim()) || value.trim().startsWith('//');
}

export function routeMatchScore(
  route: string,
  currentLocation: string,
  mode: CgRouteMatchMode,
  options: { allowAbsolute?: boolean; baseUrl?: string } = {},
): number {
  if (isAbsoluteRoute(route) && options.allowAbsolute !== true) return -1;
  const base = options.baseUrl
    ?? (typeof window === 'undefined' ? 'https://cashgear.invalid/' : window.location.href);
  const current = new URL(currentLocation, base);
  const target = new URL(route, current.href);
  if (target.origin !== current.origin) return -1;

  const currentPath = normalizedPath(current.pathname);
  const targetPath = normalizedPath(target.pathname);
  const pathExact = currentPath === targetPath;
  const pathPrefix = pathExact || currentPath.startsWith(`${targetPath === '/' ? '' : targetPath}/`);
  let matches: boolean;
  if (mode === 'prefix') matches = pathPrefix;
  else if (mode === 'ignore-query-and-fragment') matches = pathExact;
  else {
    matches = pathExact
      && (!target.search || current.search === target.search)
      && (!target.hash || current.hash === target.hash);
  }
  if (!matches) return -1;
  return targetPath.length * 4 + (mode === 'ignore-query-and-fragment' ? 0 : target.search ? 2 : 0)
    + (mode === 'ignore-query-and-fragment' ? 0 : target.hash ? 1 : 0);
}
