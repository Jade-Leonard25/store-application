/**
 * Spreadsheet Grapher — popover positioning
 * Copyright (c) 2026 <Your Company>. All rights reserved.
 * SPDX-License-Identifier: UNLICENSED
 *
 * Positions a fixed-positioned panel relative to an anchor element.
 * Used by dropdowns, tooltips, and popovers.
 */

export type Align = 'start' | 'end';
export type Side = 'bottom' | 'top';

export interface PositionOptions {
  /** Horizontal alignment against the anchor. Default 'start'. */
  align?: Align;
  /** Preferred vertical side. Flips if the panel doesn't fit. Default 'bottom'. */
  side?: Side;
  /** Gap between anchor and panel, in px. Default 4. */
  offset?: number;
  /** Minimum distance from viewport edges, in px. Default 8. */
  margin?: number;
  /** Flip to the other side when the panel doesn't fit. Default true. */
  flip?: boolean;
  /** Force the panel to be at least as wide as the anchor. Default false. */
  matchWidth?: boolean;
}

/**
 * Position a fixed-positioned popover relative to an anchor element.
 *
 * Both elements must already be in the DOM and measurable — the panel
 * needs a non-zero size for the flip/clamp math to work. Call again on
 * scroll and resize to keep the panel anchored.
 */
export function position(
  panel: HTMLElement,
  anchor: HTMLElement,
  opts: PositionOptions = {}
): void {
  const align = opts.align ?? 'start';
  const offset = opts.offset ?? 4;
  const margin = opts.margin ?? 8;
  const shouldFlip = opts.flip ?? true;

  const a = anchor.getBoundingClientRect();
  const p = panel.getBoundingClientRect();

  // --- Vertical ---
  let side: Side = opts.side ?? 'bottom';
  let top = side === 'bottom' ? a.bottom + offset : a.top - offset - p.height;

  if (shouldFlip) {
    const spaceBelow = window.innerHeight - a.bottom - offset - margin;
    const spaceAbove = a.top - offset - margin;

    if (side === 'bottom' && p.height > spaceBelow && spaceAbove > spaceBelow) {
      side = 'top';
      top = a.top - offset - p.height;
    } else if (side === 'top' && p.height > spaceAbove && spaceBelow > spaceAbove) {
      side = 'bottom';
      top = a.bottom + offset;
    }
  }

  // --- Horizontal ---
  let left = align === 'start' ? a.left : a.right - p.width;
  const maxLeft = window.innerWidth - p.width - margin;
  left = Math.max(margin, Math.min(left, maxLeft));

  // --- Apply ---
  panel.style.position = 'fixed';
  panel.style.top = `${Math.round(top)}px`;
  panel.style.left = `${Math.round(left)}px`;

  if (opts.matchWidth) {
    panel.style.minWidth = `${Math.round(a.width)}px`;
  }
}