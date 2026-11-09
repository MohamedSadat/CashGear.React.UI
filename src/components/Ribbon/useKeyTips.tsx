import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useStableCallback } from '../../hooks';
import { cx } from '../../utils';
import styles from './CgRibbon.module.css';
import type { CgRibbonTab } from './CgRibbon.types';
import { assignKeyTips, matchKeyTip } from './keyTips';
import type { KeyTipEntry } from './keyTips';

type Level = 'tabs' | 'commands';

interface Target {
  tip: string;
  element: HTMLElement;
  /** A tab opens its commands' tips; anything else is run, which ends them. */
  tab: boolean;
}

interface Badge {
  tip: string;
  x: number;
  y: number;
}

/** A key's letter or digit by where it is on the keyboard, so another layout types the same tips. */
function keyOf(event: KeyboardEvent) {
  const code = /^(?:Key([A-Z])|Digit([0-9])|Numpad([0-9]))$/.exec(event.code);
  if (code) return code[1] ?? code[2] ?? code[3] ?? null;
  return /^[a-z0-9]$/i.test(event.key) ? event.key.toUpperCase() : null;
}

const MODIFIERS = new Set(['Shift', 'Control', 'Meta', 'CapsLock', 'AltGraph']);

function usable(element: HTMLElement | null): element is HTMLElement {
  if (!element) return false;
  if (element.closest('[hidden]')) return false;
  if (element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true') return false;
  return true;
}

/** Runs what a tip is on: an input takes focus, anything else is clicked. */
function run(element: HTMLElement) {
  const control = element.matches('button, input, select, textarea, [role="button"], [role="combobox"]')
    ? element
    : element.querySelector<HTMLElement>('button, input, select, textarea, [role="button"], [role="combobox"]') ?? element;
  if (control.matches('input, select, textarea, [role="combobox"]')) control.focus();
  else control.click();
}

export function useKeyTips<TData>({ enabled, rootRef, tabs, activeKey, reservedAltKeys, onChange }: {
  enabled: boolean;
  rootRef: RefObject<HTMLDivElement | null>;
  tabs: ReadonlyArray<CgRibbonTab<TData>>;
  activeKey: string | null;
  reservedAltKeys: ReadonlyArray<string> | undefined;
  onChange: ((shown: boolean) => void) | undefined;
}) {
  const [level, setLevel] = useState<Level | null>(null);
  const [typed, setTyped] = useState('');
  const [badges, setBadges] = useState<ReadonlyArray<Badge>>([]);
  const levelRef = useRef<Level | null>(null);
  const typedRef = useRef('');
  const targetsRef = useRef<ReadonlyArray<Target>>([]);

  const collect = useStableCallback((which: Level): Target[] => {
    const root = rootRef.current;
    if (!root) return [];
    if (which === 'tabs') {
      const shown = tabs.filter((tab) => tab.visible !== false && !tab.disabled);
      // Anything else the ribbon holds outside its panels that asks for a tip, such as File.
      const others = [...root.querySelectorAll<HTMLElement>('[data-cg-keytip]')].filter((element) => !element.closest('[role="tabpanel"]'));
      const entries: KeyTipEntry[] = [
        ...others.map((element, index) => ({ id: 'other:' + index, text: element.textContent ?? '', keyTip: element.dataset.cgKeytip ?? '' })),
        ...shown.map((tab) => ({ id: 'tab:' + tab.key, text: tab.text, ...(tab.keyTip !== undefined ? { keyTip: tab.keyTip } : {}) })),
      ];
      const tips = assignKeyTips(entries);
      const headers = [...root.querySelectorAll<HTMLElement>('[data-cg-ribbon-tab]')];
      const out: Target[] = [];
      others.forEach((element, index) => {
        const tip = tips.get('other:' + index);
        if (tip && usable(element)) out.push({ tip, element, tab: false });
      });
      for (const tab of shown) {
        const tip = tips.get('tab:' + tab.key);
        const element = headers.find((header) => header.dataset.cgRibbonTab === tab.key) ?? null;
        if (tip && usable(element)) out.push({ tip, element, tab: true });
      }
      return out;
    }
    const tab = tabs.find((entry) => entry.key === activeKey);
    if (!tab) return [];
    // The tab's commands: in its panel, or over the content when the ribbon is collapsed.
    const panel = document.querySelector<HTMLElement>('[data-cg-ribbon-peek] [data-cg-ribbon-stage]')
      ?? root.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden]) [data-cg-ribbon-stage]');
    if (!panel) return [];
    const groups = tab.groups.filter((group) => group.visible !== false);
    const entries: KeyTipEntry[] = [];
    for (const group of groups) {
      for (const item of group.items) {
        if (item.visible === false) continue;
        entries.push({ id: `item:${group.key}:${item.name}`, text: item.text ?? item.tooltip ?? item.name, ...(item.keyTip !== undefined ? { keyTip: item.keyTip } : {}) });
      }
    }
    // Groups' and launchers' own tips come after the commands', as Office's start with Z and F.
    for (const group of groups) {
      entries.push({ id: 'group:' + group.key, text: group.text, prefix: 'Z', ...(group.keyTip !== undefined ? { keyTip: group.keyTip } : {}) });
      if (group.onLauncherClick) entries.push({ id: 'launcher:' + group.key, text: group.text, prefix: 'F', ...(group.launcherKeyTip !== undefined ? { keyTip: group.launcherKeyTip } : {}) });
    }
    const reserved = groups.some((group) => group.onLauncherClick) ? ['Z', 'F'] : ['Z'];
    const tips = assignKeyTips(entries, reserved);
    const out: Target[] = [];
    for (const group of groups) {
      const frame = [...panel.querySelectorAll<HTMLElement>('[data-cg-ribbon-group]')].find((element) => element.dataset.cgRibbonGroup === group.key);
      if (!frame) continue;
      if (frame.dataset.mode === 'collapsed') {
        const tip = tips.get('group:' + group.key);
        const button = frame.querySelector<HTMLElement>('button');
        if (tip && usable(button)) out.push({ tip, element: button, tab: false });
        continue;
      }
      const named = [...frame.querySelectorAll<HTMLElement>('[data-cg-toolbar-name]')];
      for (const item of group.items) {
        const tip = tips.get(`item:${group.key}:${item.name}`);
        const element = named.find((entry) => entry.dataset.cgToolbarName === item.name) ?? null;
        if (tip && usable(element)) out.push({ tip, element, tab: false });
      }
      const launcher = frame.querySelector<HTMLElement>('[data-cg-ribbon-launcher]');
      const tip = tips.get('launcher:' + group.key);
      if (tip && usable(launcher)) out.push({ tip, element: launcher, tab: false });
    }
    return out;
  });

  const show = useStableCallback((next: Level | null) => {
    const was = levelRef.current;
    levelRef.current = next;
    typedRef.current = '';
    setLevel(next);
    setTyped('');
    if (next === null) targetsRef.current = [];
    if ((was === null) !== (next === null)) onChange?.(next !== null);
  });

  const measure = useStableCallback(() => {
    const which = levelRef.current;
    if (!which) {
      setBadges([]);
      return;
    }
    const targets = collect(which);
    targetsRef.current = targets;
    setBadges(targets.map(({ tip, element }) => {
      const box = element.getBoundingClientRect();
      return { tip, x: box.left + box.width / 2, y: box.bottom };
    }));
  });

  useLayoutEffect(() => {
    measure();
    if (!level) return undefined;
    // Once a newly opened tab has laid its groups out.
    const timer = setTimeout(measure, 80);
    return () => clearTimeout(timer);
  }, [activeKey, level, measure]);

  const activate = useStableCallback((target: Target) => {
    if (target.tab) {
      target.element.click();
      show('commands');
      return;
    }
    show(null);
    run(target.element);
  });

  const reservedKey = (reservedAltKeys ?? []).map((key) => key.toUpperCase()).join('');

  useEffect(() => {
    if (!enabled) {
      if (levelRef.current) show(null);
      return undefined;
    }
    const reserved = new Set(reservedKey);
    let altDown = false;
    let otherKey = false;
    const down = (event: KeyboardEvent) => {
      if (event.key === 'Alt') {
        if (!event.repeat) {
          altDown = true;
          otherKey = false;
        }
        // Keeps the browser from taking a tap of Alt for its own menus.
        event.preventDefault();
        return;
      }
      if (altDown) otherKey = true;
      const current = levelRef.current;
      if (current === null) {
        // Alt and a tab's letter go straight to that tab.
        if (!event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
        const letter = keyOf(event);
        if (!letter || reserved.has(letter)) return;
        const target = collect('tabs').find((entry) => entry.tip === letter);
        if (!target) return;
        event.preventDefault();
        event.stopPropagation();
        activate(target);
        return;
      }
      if (MODIFIERS.has(event.key)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        show(current === 'commands' ? 'tabs' : null);
        return;
      }
      const letter = event.ctrlKey || event.metaKey ? null : keyOf(event);
      if (!letter) {
        // Any other key ends them, and does what it does.
        show(null);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const next = typedRef.current + letter;
      const { exact, more } = matchKeyTip(next, targetsRef.current.map((target) => target.tip));
      const found = exact ? targetsRef.current.find((target) => target.tip === exact) : undefined;
      if (found) {
        activate(found);
      } else if (more) {
        typedRef.current = next;
        setTyped(next);
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.key !== 'Alt') return;
      const tap = altDown && !otherKey;
      altDown = false;
      if (!tap) return;
      event.preventDefault();
      show(levelRef.current ? null : 'tabs');
    };
    const away = () => {
      altDown = false;
      if (levelRef.current) show(null);
    };
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    window.addEventListener('pointerdown', away, true);
    window.addEventListener('blur', away);
    window.addEventListener('resize', away);
    return () => {
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
      window.removeEventListener('pointerdown', away, true);
      window.removeEventListener('blur', away);
      window.removeEventListener('resize', away);
    };
  }, [activate, collect, enabled, reservedKey, show]);

  const layer: ReactNode = level && badges.length && typeof document !== 'undefined'
    ? createPortal(
      <div className={cx(styles.scope, styles.keyTipLayer)} data-cg-ribbon-keytips={level} aria-hidden="true">
        {badges.filter((badge) => badge.tip.startsWith(typed)).map((badge) => (
          <span key={badge.tip} className={styles.keyTip} style={{ left: badge.x, top: badge.y }} data-cg-keytip-badge={badge.tip}>{badge.tip}</span>
        ))}
      </div>,
      document.body,
    )
    : null;

  return { layer, show, shown: level !== null };
}
