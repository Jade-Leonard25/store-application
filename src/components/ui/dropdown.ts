/**
 * Spreadsheet Grapher — Dropdown menu
 * Copyright (c) 2026 <Your Company>. All rights reserved.
 * SPDX-License-Identifier: UNLICENSED
 */

import { cva } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import { el } from '@/lib/dom';
import { position, type Align } from '@/lib/position';
import { useState, type State } from '@/lib/state';

/* ---------------------------------------------------------------------------
 * Entry types
 * ------------------------------------------------------------------------ */

export interface DropdownItemDef {
  type: 'item';
  label: string;
  icon?: Node;
  shortcut?: string;
  variant?: 'default' | 'danger';
  checked?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export interface DropdownSeparatorDef {
  type: 'separator';
}

export interface DropdownLabelDef {
  type: 'label';
  text: string;
}

export type DropdownEntry =
  | DropdownItemDef
  | DropdownSeparatorDef
  | DropdownLabelDef;

/* ---------------------------------------------------------------------------
 * Styles
 * ------------------------------------------------------------------------ */

const panelVariants = cva(
  [
    'fixed z-50 py-1 flex flex-col',
    'rounded-md border border-border bg-bg-elev',
    'shadow-lg shadow-black/20'
  ],
  {
    variants: {
      size: {
        sm: 'min-w-[160px]',
        md: 'min-w-[200px]',
        lg: 'min-w-[280px]'
      }
    },
    defaultVariants: { size: 'md' }
  }
);

const itemVariants = cva(
  [
    'flex items-center gap-2 px-2.5 py-1.5 mx-1',
    'rounded-sm text-sm cursor-pointer select-none',
    'outline-none transition-colors duration-100 ease-press',
    'focus:bg-bg-elev-2'
  ],
  {
    variants: {
      variant: {
        default: 'text-fg',
        danger: 'text-danger'
      },
      disabled: {
        true: 'opacity-50 cursor-not-allowed pointer-events-none',
        false: ''
      }
    },
    defaultVariants: { variant: 'default', disabled: false }
  }
);

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------ */

export interface CreateDropdownOptions {
  trigger: HTMLElement;
  getEntries: () => DropdownEntry[];
  align?: Align;
  size?: 'sm' | 'md' | 'lg';
  offset?: number;
  matchWidth?: boolean;
}

export interface DropdownComponent {
  /** The trigger element. Mount this into your layout. */
  el: HTMLElement;
  /** Programmatically open. */
  open(): void;
  /** Programmatically close. `restoreFocus` defaults to true. */
  close(restoreFocus?: boolean): void;
  /** Flip open/closed. */
  toggle(): void;
  /**
   * Reactive open state. Subscribe to style the trigger, close sibling
   * dropdowns, or block background interactions while open.
   *
   * Read `isOpen.get()` for the current value. `subscribe` does NOT fire
   * immediately — read the current value once at setup if you need it.
   */
  isOpen: State<boolean>;
  destroy(): void;
}

let uid = 0;

export function createDropdown(opts: CreateDropdownOptions): DropdownComponent {
  const {
    trigger,
    getEntries,
    align = 'start',
    size = 'md',
    offset = 4,
    matchWidth = false
  } = opts;

  const panelId = `dropdown-${++uid}`;

  /* -----------------------------------------------------------------------
   * Reactive state — the only state consumers can observe.
   * --------------------------------------------------------------------- */

  const isOpen = useState(false);

  /* -----------------------------------------------------------------------
   * Local state — DOM refs and keyboard bookkeeping. Nothing outside this
   * closure reads these, so they stay plain variables. Wrapping them in
   * `useState` would add a subscriber Set and an Object.is check per write
   * for zero benefit.
   * --------------------------------------------------------------------- */

  let panel: HTMLElement | null = null;
  let itemNodes: HTMLElement[] = [];
  let focused = -1;
  let typeBuffer = '';
  let typeTimeout: number | undefined;

  /* -----------------------------------------------------------------------
   * Trigger setup
   * --------------------------------------------------------------------- */

  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', panelId);

  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    toggle();
  });

  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      open();
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && !isNativeActivatable(trigger)) {
      e.preventDefault();
      open();
    }
  });

  /* -----------------------------------------------------------------------
   * isOpen subscription — drives panel lifecycle and trigger ARIA.
   *
   * All open/close side effects flow through this one subscriber:
   *   set(true)  → mount panel, position it, focus first item
   *   set(false) → unmount panel, detach global listeners
   *
   * `open()`, `close()`, and `toggle()` just write to isOpen. They never
   * touch the DOM directly, which means every state transition goes through
   * one code path — no drift between programmatic and user-driven changes.
   * --------------------------------------------------------------------- */

  const unsubscribe = isOpen.subscribe((open, wasOpen) => {
    if (open === wasOpen) return;
    trigger.setAttribute('aria-expanded', String(open));
    if (open) mountPanel();
    else unmountPanel();
  });

  /* -----------------------------------------------------------------------
   * Public controls — thin wrappers over isOpen.set()
   * --------------------------------------------------------------------- */

  function open(): void {
    isOpen.set(true);
  }

  function close(restoreFocus = true): void {
    if (!isOpen.get()) return;
    isOpen.set(false);
    // Focus restoration happens here, not in the subscriber, so it applies
    // only when close() was called explicitly. If a consumer writes
    // `isOpen.set(false)` directly, focus stays wherever it is.
    if (restoreFocus) trigger.focus();
  }

  function toggle(): void {
    isOpen.set((prev) => !prev);
  }

  /* -----------------------------------------------------------------------
   * Panel lifecycle
   * --------------------------------------------------------------------- */

  function mountPanel(): void {
    panel = buildPanel();
    panel.id = panelId;
    panel.className = cn(panelVariants({ size }));
    panel.setAttribute('role', 'menu');
    panel.setAttribute('aria-labelledby', ensureTriggerId());

    document.body.appendChild(panel);
    position(panel, trigger, { align, offset, matchWidth });

    if (!prefersReducedMotion() && typeof panel.animate === 'function') {
      panel.animate(
        [
          { opacity: 0, transform: 'scale(0.96)' },
          { opacity: 1, transform: 'scale(1)' }
        ],
        { duration: 100, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'none' }
      );
    }

    document.addEventListener('pointerdown', onDocPointerDown, true);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);

    const first = firstEnabledIndex();
    if (first >= 0) focusItem(first);
    else panel.focus();
  }

  function unmountPanel(): void {
    if (!panel) return;

    document.removeEventListener('pointerdown', onDocPointerDown, true);
    window.removeEventListener('scroll', onScrollOrResize, true);
    window.removeEventListener('resize', onScrollOrResize);

    panel.remove();
    panel = null;
    itemNodes = [];
    focused = -1;
    typeBuffer = '';
    if (typeTimeout) window.clearTimeout(typeTimeout);
  }

  /* -----------------------------------------------------------------------
   * Panel construction
   * --------------------------------------------------------------------- */

  function buildPanel(): HTMLElement {
    const p = el('div', { tabIndex: -1 });
    p.addEventListener('keydown', onPanelKeydown);

    for (const entry of getEntries()) {
      if (entry.type === 'separator') {
        p.appendChild(
          el('div', { class: 'my-1 mx-1 border-t border-border', role: 'separator' })
        );
        continue;
      }

      if (entry.type === 'label') {
        p.appendChild(
          el(
            'div',
            {
              class:
                'px-3.5 pt-1.5 pb-1 text-[11px] uppercase tracking-wider text-fg-muted select-none'
            },
            [entry.text]
          )
        );
        continue;
      }

      p.appendChild(buildItem(entry));
    }

    return p;
  }

  function buildItem(def: DropdownItemDef): HTMLElement {
    const left = def.icon ?? (def.checked ? checkIcon() : null);

    const node = el(
      'div',
      {
        role: 'menuitem',
        tabIndex: -1,
        'aria-disabled': def.disabled ? 'true' : undefined,
        'data-disabled': def.disabled ? '' : undefined,
        class: itemVariants({ variant: def.variant, disabled: def.disabled })
      },
      [
        left ? el('span', { class: 'shrink-0 flex items-center w-4' }, [left]) : null,
        el('span', { class: 'flex-1 min-w-0 truncate' }, [def.label]),
        def.shortcut
          ? el('span', { class: 'ml-4 text-xs text-fg-muted font-mono shrink-0' }, [
              def.shortcut
            ])
          : null
      ]
    );

    if (!def.disabled) {
      node.addEventListener('click', () => {
        close();
        def.onSelect();
      });
    }

    itemNodes.push(node);
    return node;
  }

  /* -----------------------------------------------------------------------
   * Keyboard
   * --------------------------------------------------------------------- */

  function onPanelKeydown(e: KeyboardEvent): void {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        moveFocus(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveFocus(-1);
        break;
      case 'Home':
        e.preventDefault();
        focusItem(firstEnabledIndex());
        break;
      case 'End':
        e.preventDefault();
        focusItem(lastEnabledIndex());
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Tab':
        close(false);
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          typeAhead(e.key);
        }
    }
  }

  function moveFocus(delta: number): void {
    if (itemNodes.length === 0) return;
    let next = focused;
    for (let step = 0; step < itemNodes.length; step++) {
      next = (next + delta + itemNodes.length) % itemNodes.length;
      if (!itemNodes[next].hasAttribute('data-disabled')) {
        focusItem(next);
        return;
      }
    }
  }

  function focusItem(index: number): void {
    const node = itemNodes[index];
    if (!node) return;
    focused = index;
    node.focus();
  }

  function firstEnabledIndex(): number {
    return itemNodes.findIndex((n) => !n.hasAttribute('data-disabled'));
  }

  function lastEnabledIndex(): number {
    for (let i = itemNodes.length - 1; i >= 0; i--) {
      if (!itemNodes[i].hasAttribute('data-disabled')) return i;
    }
    return -1;
  }

  function typeAhead(char: string): void {
    typeBuffer += char.toLowerCase();
    if (typeTimeout) window.clearTimeout(typeTimeout);
    typeTimeout = window.setTimeout(() => (typeBuffer = ''), 500);

    const start = focused < 0 ? 0 : focused + 1;
    for (let i = 0; i < itemNodes.length; i++) {
      const idx = (start + i) % itemNodes.length;
      const node = itemNodes[idx];
      if (node.hasAttribute('data-disabled')) continue;
      const text = (node.textContent ?? '').trim().toLowerCase();
      if (text.startsWith(typeBuffer)) {
        focusItem(idx);
        return;
      }
    }
  }

  /* -----------------------------------------------------------------------
   * Global listeners
   * --------------------------------------------------------------------- */

  function onDocPointerDown(e: PointerEvent): void {
    const t = e.target as Node | null;
    if (!t) return;
    if (panel?.contains(t)) return;
    if (trigger.contains(t)) return;
    close(false); // outside-click: don't steal focus back to the trigger
  }

  function onScrollOrResize(): void {
    if (panel) position(panel, trigger, { align, offset, matchWidth });
  }

  /* -----------------------------------------------------------------------
   * Helpers
   * --------------------------------------------------------------------- */

  function ensureTriggerId(): string {
    let id = trigger.id;
    if (!id) {
      id = `dropdown-trigger-${++uid}`;
      trigger.id = id;
    }
    return id;
  }

  /* -----------------------------------------------------------------------
   * Public surface
   * --------------------------------------------------------------------- */

  return {
    el: trigger,
    open,
    close,
    toggle,
    isOpen,
    destroy() {
      unsubscribe();
      if (isOpen.get()) unmountPanel();
      trigger.replaceWith(trigger.cloneNode(true));
    }
  };
}

/* ---------------------------------------------------------------------------
 * Shared helpers
 * ------------------------------------------------------------------------ */

function checkIcon(): Node {
  return el('span', { class: 'text-accent' }, ['✓']);
}

function isNativeActivatable(node: HTMLElement): boolean {
  return node instanceof HTMLButtonElement || node instanceof HTMLAnchorElement;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}