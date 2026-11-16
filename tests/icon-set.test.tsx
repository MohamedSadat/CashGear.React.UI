import { readFileSync } from 'node:fs';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CgButton, CgIcon } from '../src';
import { fluentIconAccentPaths, fluentIconPaths, fluentIconRtlPaths } from '../src/vendor/fluent-icons/icons';
import type { FluentIconName } from '../src/vendor/fluent-icons/icons';

describe('CgIcon spreadsheet set', () => {
  it('draws filled 20 px icons that follow the text colour, and leaves stroke icons as they were', () => {
    const { container } = render(<><CgIcon name="text-bold" data-testid="bold" /><CgIcon name="search" data-testid="search" /></>);
    const bold = screen.getByTestId('bold');
    expect(bold).toHaveAttribute('viewBox', '0 0 20 20');
    expect(bold).toHaveAttribute('fill', 'currentColor');
    expect(bold).not.toHaveAttribute('stroke');
    expect(bold.querySelector('path')).toHaveAttribute('d', fluentIconPaths['text-bold']);
    const search = screen.getByTestId('search');
    expect(search).toHaveAttribute('viewBox', '0 0 24 24');
    expect(search).toHaveAttribute('fill', 'none');
    expect(search).toHaveAttribute('stroke', 'currentColor');
    expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(2);
  });

  it('labels, sizes and forwards a ref on filled icons the same way as stroke icons', () => {
    const ref = createRef<SVGSVGElement>();
    render(<CgIcon ref={ref} name="freeze-panes" label="Freeze panes" size={32} data-kind="command" />);
    const icon = screen.getByRole('img', { name: 'Freeze panes' });
    expect(icon).toHaveAttribute('width', '32');
    expect(icon).not.toHaveAttribute('aria-hidden');
    expect(ref.current).toBe(icon);
    expect(icon).toHaveAttribute('data-kind', 'command');
  });

  it('fills the colour bar under the three colour icons, and draws no bar when no colour is given', () => {
    render(<><CgIcon name="fill-color" accentColor="#ffc000" data-testid="filled" /><CgIcon name="fill-color" data-testid="empty" /><CgIcon name="text-bold" accentColor="#ffc000" data-testid="no-bar" /></>);
    const accent = screen.getByTestId('filled').querySelector('[data-cg-icon-accent]');
    expect(accent).toHaveAttribute('fill', '#ffc000');
    expect(accent).toHaveAttribute('d', fluentIconAccentPaths['fill-color']);
    expect(screen.getByTestId('filled').lastElementChild).toHaveAttribute('d', fluentIconPaths['fill-color']);
    expect(screen.getByTestId('empty').querySelector('[data-cg-icon-accent]')).toBeNull();
    expect(screen.getByTestId('no-bar').querySelector('[data-cg-icon-accent]')).toBeNull();
  });

  it('covers the formatting commands the brief lists, by name, through a button icon', () => {
    const required: ReadonlyArray<FluentIconName> = [
      'text-bold', 'text-italic', 'text-underline', 'align-left', 'align-center', 'align-right', 'text-wrap', 'cells-merge',
      'border-all', 'border-outside', 'fill-color', 'text-color', 'number-format', 'number-currency', 'number-percent',
      'sort', 'filter', 'chart-column', 'chart-line', 'chart-pie', 'row-insert', 'row-delete', 'column-insert', 'column-delete', 'freeze-panes',
    ];
    for (const name of required) expect(fluentIconPaths[name], name).toMatch(/^M/u);
    const { container } = render(<CgButton icon="sort-ascending">Sort</CgButton>);
    expect(container.querySelector('svg path')).toHaveAttribute('d', fluentIconPaths['sort-ascending']);
  });

  it('ships only plain path data with its licence and pinned source recorded', () => {
    for (const data of [...Object.values(fluentIconPaths), ...Object.values(fluentIconAccentPaths), ...Object.values(fluentIconRtlPaths)]) {
      expect(data).toMatch(/^[MmLlHhVvCcSsQqTtAaZz0-9 ,.-]+$/u);
    }
    const manifest = JSON.parse(readFileSync('src/vendor/fluent-icons/integrity-manifest.json', 'utf8')) as { package: string; version: string; icons: number };
    expect(manifest).toMatchObject({ package: '@fluentui/svg-icons', version: '1.1.345', icons: Object.keys(fluentIconPaths).length });
    expect(readFileSync('src/vendor/fluent-icons/LICENSE', 'utf8')).toContain('MIT License');
  });
});

describe('CgIcon document block set', () => {
  it('names an icon for every document block type', () => {
    const required: ReadonlyArray<FluentIconName> = [
      'text', 'paragraph', 'heading-1', 'heading-2', 'heading-3', 'list-bullet', 'list-number', 'list-todo', 'todo', 'toggle', 'quote',
      'callout', 'code', 'divider', 'image', 'file', 'table', 'database', 'page', 'page-link', 'toc', 'embed', 'chart', 'board', 'bookmark',
      'linked-view', 'sync', 'workbook', 'drag-handle', 'emoji', 'emoji-add', 'mention', 'calendar-month', 'view-list', 'gallery', 'timeline',
    ];
    for (const name of required) expect(fluentIconPaths[name], name).toMatch(/^[Mm]/u);
  });

  it('draws a list in both directions, the right-to-left drawing hidden outside a right-to-left container', () => {
    render(<><CgIcon name="list-number" data-testid="numbers" /><CgIcon name="heading-1" data-testid="heading" /></>);
    const paths = screen.getByTestId('numbers').querySelectorAll('path');
    expect(paths).toHaveLength(2);
    expect(paths[0]).toHaveAttribute('d', fluentIconPaths['list-number']);
    expect(paths[1]).toHaveAttribute('d', fluentIconRtlPaths['list-number']);
    expect(paths[1]).toHaveAttribute('data-cg-icon-rtl');
    expect(paths[1]).not.toBeVisible();
    expect(screen.getByTestId('heading').querySelectorAll('path')).toHaveLength(1);
  });

  it('mirrors the toggle and contents icons like the logical chevrons, and leaves the others', () => {
    render(<><CgIcon name="toggle" data-testid="toggle" /><CgIcon name="toc" data-testid="toc" /><CgIcon name="quote" data-testid="quote" /><CgIcon name="chevron-end" data-testid="chevron" /></>);
    const logical = screen.getByTestId('chevron').getAttribute('class')!.split(' ').find((name) => name.includes('logical'))!;
    expect(screen.getByTestId('toggle')).toHaveClass(logical);
    expect(screen.getByTestId('toc')).toHaveClass(logical);
    expect(screen.getByTestId('quote')).not.toHaveClass(logical);
  });
});
