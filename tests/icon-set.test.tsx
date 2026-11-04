import { readFileSync } from 'node:fs';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CgButton, CgIcon } from '../src';
import { fluentIconAccentPaths, fluentIconPaths } from '../src/vendor/fluent-icons/icons';
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
    for (const data of [...Object.values(fluentIconPaths), ...Object.values(fluentIconAccentPaths)]) {
      expect(data).toMatch(/^[MmLlHhVvCcSsQqTtAaZz0-9 ,.-]+$/u);
    }
    const manifest = JSON.parse(readFileSync('src/vendor/fluent-icons/integrity-manifest.json', 'utf8')) as { package: string; version: string; icons: number };
    expect(manifest).toMatchObject({ package: '@fluentui/svg-icons', version: '1.1.345', icons: Object.keys(fluentIconPaths).length });
    expect(readFileSync('src/vendor/fluent-icons/LICENSE', 'utf8')).toContain('MIT License');
  });
});
