import { createContext, forwardRef, useContext, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { cx } from '../../utils';
import type {
  CgGridLayoutColumnDescriptor,
  CgGridLayoutItemProps,
  CgGridLayoutProps,
  CgGridLayoutRowDescriptor,
} from './CgGridLayout.types';
import styles from './CgGridLayout.module.css';

const RESERVED_AREA_NAMES = new Set(['auto', 'span', 'none', 'inherit', 'initial', 'unset', 'revert', 'revert-layer']);
const GridLayoutContext = createContext<ReadonlySet<string> | null>(null);

function cssTrack(value: string, name: string): string {
  if (!value.trim() || /[;{}"'\\\r\n<>!@]/u.test(value) || /\/\*|\*\/|(?:url|expression)\s*\(/iu.test(value)) throw new Error(`CgGridLayout ${name} must be one safe CSS track value.`);
  let depth = 0;
  for (const character of value) {
    if (character === '(') depth += 1;
    else if (character === ')') { depth -= 1; if (depth < 0) throw new Error(`CgGridLayout ${name} has unbalanced parentheses.`); }
  }
  if (depth !== 0) throw new Error(`CgGridLayout ${name} has unbalanced parentheses.`);
  return value.trim();
}

function validAreaName(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_-]*$/u.test(name) && !RESERVED_AREA_NAMES.has(name.toLowerCase());
}

interface LayoutDefinition {
  readonly rowTracks: string;
  readonly columnTracks: string;
  readonly areas: string;
  readonly names: ReadonlySet<string>;
}

function buildLayout(rows: ReadonlyArray<CgGridLayoutRowDescriptor>, columns: ReadonlyArray<CgGridLayoutColumnDescriptor>): LayoutDefinition {
  const rowTracks = rows.length ? rows.map((row, index) => cssTrack(row.height ?? 'auto', `rows[${index}].height`)).join(' ') : 'none';
  let columnTracks = columns.length ? columns.map((column, index) => cssTrack(column.width ?? '1fr', `columns[${index}].width`)).join(' ') : 'minmax(0, 1fr)';
  const anyAreas = rows.some((row) => row.areas !== undefined);
  if (!anyAreas) return { rowTracks, columnTracks, areas: 'none', names: new Set() };
  if (rows.some((row) => !row.areas?.trim())) throw new Error('CgGridLayout every row must specify areas when named areas are used.');
  const matrix = rows.map((row) => row.areas!.trim().split(/\s+/u));
  const width = matrix[0]?.length ?? 0;
  if (width === 0 || matrix.some((row) => row.length !== width)) throw new Error('CgGridLayout area rows must have equal nonzero widths.');
  if (columns.length && columns.length !== width) throw new Error('CgGridLayout area rows must match the declared column count.');
  const names = new Set<string>();
  for (const name of matrix.flat()) {
    if (name === '.') continue;
    if (!validAreaName(name)) throw new Error(`CgGridLayout area name "${name}" is invalid.`);
    names.add(name);
  }
  for (const name of names) {
    const cells: Array<readonly [number, number]> = [];
    matrix.forEach((row, rowIndex) => row.forEach((cell, columnIndex) => { if (cell === name) cells.push([rowIndex, columnIndex]); }));
    const rowIndexes = cells.map(([row]) => row);
    const columnIndexes = cells.map(([, column]) => column);
    const height = Math.max(...rowIndexes) - Math.min(...rowIndexes) + 1;
    const rectangleWidth = Math.max(...columnIndexes) - Math.min(...columnIndexes) + 1;
    if (height * rectangleWidth !== cells.length) throw new Error(`CgGridLayout area "${name}" must form one rectangle.`);
  }
  if (!columns.length) columnTracks = `repeat(${width}, minmax(0, 1fr))`;
  return { rowTracks, columnTracks, areas: matrix.map((row) => `"${row.join(' ')}"`).join(' '), names };
}

export const CgGridLayout = forwardRef<HTMLDivElement, CgGridLayoutProps>(function CgGridLayout(
  { rows = [], columns = [], rowGap = 0, columnGap = 0, children, className, style, ...nativeProps },
  ref,
) {
  const layout = useMemo(() => buildLayout(rows, columns), [columns, rows]);
  const layoutStyle: CSSProperties = {
    ...style,
    display: 'grid',
    gridTemplateRows: layout.rowTracks,
    gridTemplateColumns: layout.columnTracks,
    gridTemplateAreas: layout.areas,
    rowGap,
    columnGap,
  };
  return <GridLayoutContext.Provider value={layout.names}>
    <div {...nativeProps} ref={ref} className={cx(styles.root, className)} style={layoutStyle} data-cg-grid-layout="">{children}</div>
  </GridLayoutContext.Provider>;
});

function safeIndex(value: number | undefined, name: string, minimum: number): void {
  if (value === undefined) return;
  if (!Number.isSafeInteger(value) || value < minimum || value === Number.MAX_SAFE_INTEGER) {
    throw new RangeError(`CgGridLayoutItem ${name} must be a safe integer ${minimum === 0 ? 'at least zero' : 'greater than zero'}.`);
  }
}

export const CgGridLayoutItem = forwardRef<HTMLDivElement, CgGridLayoutItemProps>(function CgGridLayoutItem(
  { row, column, rowSpan = 1, columnSpan = 1, area, visible = true, children, className, style, ...nativeProps },
  ref,
) {
  const areaNames = useContext(GridLayoutContext);
  if (!areaNames) throw new Error('CgGridLayoutItem must be rendered inside CgGridLayout.');
  safeIndex(row, 'row', 0);
  safeIndex(column, 'column', 0);
  safeIndex(rowSpan, 'rowSpan', 1);
  safeIndex(columnSpan, 'columnSpan', 1);
  if (row !== undefined && row > Number.MAX_SAFE_INTEGER - rowSpan) throw new RangeError('CgGridLayoutItem row plus rowSpan must remain a safe integer.');
  if (column !== undefined && column > Number.MAX_SAFE_INTEGER - columnSpan) throw new RangeError('CgGridLayoutItem column plus columnSpan must remain a safe integer.');
  if (area !== undefined && (row !== undefined || column !== undefined || rowSpan !== 1 || columnSpan !== 1)) {
    throw new Error('CgGridLayoutItem named and indexed placement cannot be combined.');
  }
  if (area !== undefined && !areaNames.has(area)) throw new Error(`CgGridLayoutItem area "${area}" is not declared by its layout.`);
  if (!visible) return null;
  const placement: CSSProperties = area !== undefined
    ? { gridArea: area }
    : {
        gridRow: `${row === undefined ? 'auto' : row + 1} / span ${rowSpan}`,
        gridColumn: `${column === undefined ? 'auto' : column + 1} / span ${columnSpan}`,
      };
  return <div {...nativeProps} ref={ref} className={cx(styles.item, className)} style={{ ...style, ...placement }} data-cg-grid-layout-item="">{children}</div>;
});
