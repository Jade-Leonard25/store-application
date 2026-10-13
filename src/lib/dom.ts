/**
 * Spreadsheet Grapher — DOM helpers
 * Copyright (c) 2026 <Your Company>. All rights reserved.
 * SPDX-License-Identifier: UNLICENSED
 *
 * Small, typed, safe-by-default element builders.
 *
 *   el('button', { class: 'btn', onclick: save }, ['Save'])
 *   el('span', 'Hello')                         // children-only form
 *   el('select', { value: 'b' }, [options])     // value applied AFTER children
 *
 * Safety rules (spreadsheet contents are untrusted input):
 *   - Strings become text nodes. innerHTML / outerHTML / srcdoc throw.
 *   - Inline handler strings (onclick="...") throw. Pass functions.
 *   - javascript: / vbscript: / data:text/html URLs are dropped with a warning.
 */

import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/* ---------------------------------------------------------------------------
 * Classes
 * ------------------------------------------------------------------------ */

export type { ClassValue };

/** Joins class values (strings, arrays, {name: bool}) and resolves Tailwind conflicts. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------ */

/** A UI piece. `S` is the state type its `update()` receives. */
export interface Component<S = unknown> {
  readonly el: HTMLElement;
  update?(state: S): void;
  /** Release anything outside the element: store subscriptions, observers, charts. */
  destroy?(): void;
}

/**
 * Anything that can be a child. Falsy values are skipped, so
 * `[cond && el('b')]` works. Components are unwrapped to their `.el`.
 */
export type Child =
  | Node
  | { readonly el: Node }
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly Child[];

type Primitive = string | number | boolean | null | undefined;

type StyleMap = {
  [K in keyof CSSStyleDeclaration as CSSStyleDeclaration[K] extends string
    ? K
    : never]?: string | null;
} & { [cssVar: `--${string}`]: string | null | undefined };

/** Properties we replace with our own safer or friendlier versions. */
type ReplacedProps =
  | 'style'
  | 'className'
  | 'classList'
  | 'dataset'
  | 'innerHTML'
  | 'outerHTML'
  | 'innerText'
  | 'children'
  | 'childNodes'
  | 'attributes'
  | 'part';
/**
 * HTML attribute names whose lowercase form differs from the DOM property
 * name. `el('div', { tabindex: -1 })` and `el('div', { tabIndex: -1 })`
 * both compile — and both set the right thing.
 */
type HtmlAttributeAliases = Partial<
  Record<
    | 'tabindex' | 'readonly' | 'maxlength' | 'minlength'
    | 'autofocus' | 'contenteditable' | 'spellcheck' | 'autocomplete'
    | 'crossorigin' | 'srcset' | 'sizes' | 'datetime' | 'usemap'
    | 'colspan' | 'rowspan' | 'cellpadding' | 'cellspacing'
    | 'enctype' | 'formaction' | 'formmethod' | 'formnovalidate' | 'formtarget',
    string | number | boolean
  >
>;

/** Attributes for `el(tag, attrs)`. Typos and wrong value types are compile errors. */
export type Attrs<K extends keyof HTMLElementTagNameMap> = Partial<
  Omit<HTMLElementTagNameMap[K], ReplacedProps>
> & {
  class?: ClassValue;
  style?: string | StyleMap;
  dataset?: Record<string, Primitive>;
  for?: string;
  ref?: (node: HTMLElementTagNameMap[K]) => void;
} & HtmlAttributeAliases
  & { [attr: `data-${string}`]: Primitive }
  & { [attr: `aria-${string}`]: Primitive };

export type SvgAttrs = Record<string, Primitive | ClassValue | EventListener>;

/* ---------------------------------------------------------------------------
 * Security
 * ------------------------------------------------------------------------ */

const FORBIDDEN_KEYS = new Set(['innerhtml', 'outerhtml', 'srcdoc', 'insertadjacenthtml']);
const URL_KEYS = new Set(['href', 'src', 'action', 'formaction', 'xlink:href', 'data', 'poster']);
``
/** Browsers ignore tabs/newlines inside a scheme ("java\tscript:"), so strip first. */
function isUnsafeUrl(value: string): boolean {
  // eslint-disable-next-line no-control-regex
  const compact = value.replace(/[\u0000-\u0020]/g, '');
  return /^(?:javascript|vbscript):/i.test(compact) || /^data:text\/html/i.test(compact);
}

/* ---------------------------------------------------------------------------
 * Attribute application
 * ------------------------------------------------------------------------ */

const PROPERTY_ALIASES: Record<string, string> = { for: 'htmlFor' };

/** Boolean -> presence attribute (readonly, hidden). Anything else -> string. */
function setAttr(node: Element, key: string, value: unknown): void {
  if (typeof value === 'boolean') node.toggleAttribute(key, value);
  else node.setAttribute(key, String(value));
}

function applyStyle(node: Element, value: unknown): void {
  const style = (node as HTMLElement | SVGElement).style;
  // CSSOM writes are allowed under strict CSP; setAttribute('style') is not.
  if (typeof value === 'string') {
    style.cssText = value;
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  for (const [prop, v] of Object.entries(value)) {
    if (v == null) continue;
    if (prop.includes('-')) style.setProperty(prop, String(v));
    else (style as unknown as Record<string, string>)[prop] = String(v);
  }
}

function applyAttr(node: Element, key: string, value: unknown, svg: boolean): void {
  if (value == null) return;
  const lower = key.toLowerCase();

  if (FORBIDDEN_KEYS.has(lower)) {
    throw new Error(
      `dom: "${key}" is not allowed. Use children (text nodes) so untrusted data cannot inject markup.`
    );
  }

  if (key === 'class' || key === 'className') {
    const cls = typeof value === 'string' ? value : cn(value as ClassValue);
    if (svg) node.setAttribute('class', cls);
    else (node as HTMLElement).className = cls;
    return;
  }

  if (key === 'style') {
    applyStyle(node, value);
    return;
  }

  if (key === 'dataset') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v != null) (node as HTMLElement).dataset[k] = String(v);
    }
    return;
  }

  if (lower.length > 2 && lower.startsWith('on')) {
    if (typeof value === 'function') {
      node.addEventListener(lower.slice(2), value as EventListener);
      return;
    }
    if (value === false) return; // onclick: cond && handler
    throw new TypeError(
      `dom: "${key}" must be a function. Inline handler strings are blocked.`
    );
  }

  if (URL_KEYS.has(lower) && typeof value === 'string' && isUnsafeUrl(value)) {
    console.warn(`dom: dropped unsafe URL in "${key}"`);
    return;
  }

  // data-* and aria-* are always strings ("false" is meaningful for aria).
  if (lower.startsWith('data-') || lower.startsWith('aria-')) {
    node.setAttribute(key, String(value));
    return;
  }

  if (svg) {
    setAttr(node, key, value);
    return;
  }

  const prop = PROPERTY_ALIASES[key] ?? key;
  if (prop in node) {
    try {
      (node as unknown as Record<string, unknown>)[prop] = value;
      return;
    } catch {
      // Read-only property (e.g. input.list): fall back to the attribute.
    }
  }
  setAttr(node, key, value);
}

/* ---------------------------------------------------------------------------
 * Children
 * ------------------------------------------------------------------------ */

function append(parent: Node, child: Child): void {
  if (child == null || typeof child === 'boolean') return;
  if (typeof child === 'string' || typeof child === 'number') {
    parent.appendChild(document.createTextNode(String(child)));
    return;
  }
  if (child instanceof Node) {
    parent.appendChild(child);
    return;
  }
  if (Array.isArray(child)) {
    for (const c of child as readonly Child[]) append(parent, c);
    return;
  }
  if ('el' in child) parent.appendChild(child.el);
}

/** True for a plain attrs object, false for children (Node, array, string, Component). */
function isAttrs(x: unknown): x is Record<string, unknown> {
  if (x == null || typeof x !== 'object') return false;
  if (Array.isArray(x) || x instanceof Node) return false;
  if ('el' in x && (x as { el: unknown }).el instanceof Node) return false;
  return true;
}

function build<N extends Element>(node: N, a: unknown, b: Child, svg: boolean): N {
  const attrs = isAttrs(a) ? a : undefined;
  const children: Child = attrs ? b : a == null ? b : (a as Child);

  let deferredValue: unknown;
  let ref: ((n: N) => void) | undefined;

  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'ref') ref = v as (n: N) => void;
      // <select value> only works once its <option>s exist.
      else if (k === 'value' && !svg) deferredValue = v;
      else applyAttr(node, k, v, svg);
    }
  }

  append(node, children);

  if (deferredValue != null) {
    if ('value' in node) (node as unknown as { value: string }).value = String(deferredValue);
    else node.setAttribute('value', String(deferredValue));
  }
  ref?.(node);
  return node;
}

/* ---------------------------------------------------------------------------
 * Builders
 * ------------------------------------------------------------------------ */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Attrs<K> | null,
  children?: Child
): HTMLElementTagNameMap[K];
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  children: Child
): HTMLElementTagNameMap[K];
export function el(tag: string, a?: unknown, b?: Child): HTMLElement {
  return build(document.createElement(tag), a, b, false);
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** SVG elements (icons, small graphics). Attributes are always set as attributes. */
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs?: SvgAttrs | null,
  children?: Child
): SVGElementTagNameMap[K];
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  children: Child
): SVGElementTagNameMap[K];
export function svg(tag: string, a?: unknown, b?: Child): SVGElement {
  return build(document.createElementNS(SVG_NS, tag) as SVGElement, a, b, true);
}

/* ---------------------------------------------------------------------------
 * Mounting and lifecycle
 * ------------------------------------------------------------------------ */

/** Replaces all children of `parent`. Accepts the same Child values as el(). */
export function replace(parent: Element, children: Child = []): void {
  const frag = document.createDocumentFragment();
  append(frag, children);
  parent.replaceChildren(frag);
}

export function clear(node: Element): void {
  node.replaceChildren();
}

/** Appends a node or Component and returns an unmount function that also calls destroy(). */
export function mount(parent: Element, child: Node | Component): () => void {
  const node = child instanceof Node ? child : child.el;
  parent.appendChild(node);
  return () => {
    node.parentNode?.removeChild(node);
    if (!(child instanceof Node)) child.destroy?.();
  };
}

export interface Scope {
  /** Register a Component (its destroy() runs) or a cleanup function. Returns it. */
  own<T extends Component | (() => void)>(item: T): T;
  /** Run every registered cleanup, newest first. Safe to call repeatedly. */
  dispose(): void;
}

/**
 * Collects cleanups so a view can be rebuilt without leaking:
 *
 *   const scope = createScope();
 *   function renderSidebar() {
 *     scope.dispose();
 *     replace(sidebar, scope.own(ChartTypePicker(...)));
 *   }
 */
export function createScope(): Scope {
  const items: Array<Component | (() => void)> = [];
  return {
    own(item) {
      items.push(item);
      return item;
    },
    dispose() {
      for (const item of items.splice(0).reverse()) {
        try {
          if (typeof item === 'function') item();
          else item.destroy?.();
        } catch (err) {
          console.error('dom: cleanup failed', err);
        }
      }
    }
  };
}