/**
 * Spreadsheet Grapher — reactive state primitive
 * Copyright (c) 2026 <Your Company>. All rights reserved.
 * SPDX-License-Identifier: UNLICENSED
 *
 * Vanilla analogue of React's useState. No hooks, no lifecycle, no re-render.
 * A subscribable value with functional updates and derived children.
 *
 * Use for state shared between components. For state local to a single
 * component, a plain closure variable is simpler and faster.
 */

export type Updater<T> = T | ((prev: T) => T);
export type Setter<T> = (next: Updater<T>) => void;
export type Subscriber<T> = (value: T, prev: T) => void;

export interface State<T> {
  /** Read the current value. */
  get(): T;
  /**
   * Set the value. Accepts either a plain value or an updater function.
   * Notifies subscribers only when the new value differs (`Object.is`) from
   * the previous one — no wasted notifications on identical sets.
   */
  set: Setter<T>;
  /**
   * Register a listener. Returns an unsubscribe function.
   * Does NOT fire immediately — read `state.get()` for the current value.
   */
  subscribe(fn: Subscriber<T>): () => void;
  /**
   * Create a child state that recomputes whenever this one changes.
   * The derived state lives as long as this one does.
   */
  derive<U>(fn: (value: T) => U): State<U>;
}

export function useState<T>(initial: T): State<T> {
  let value = initial;
  const subscribers = new Set<Subscriber<T>>();

  const state: State<T> = {
    get: () => value,

    set: (next) => {
      const resolved =
        typeof next === 'function' ? (next as (prev: T) => T)(value) : next;

      // Bail out early — this is what makes `<input>` bindings and controlled
      // components cheap. Setting the same value is a no-op.
      if (Object.is(resolved, value)) return;

      const prev = value;
      value = resolved;

      // Snapshot subscribers so unsubscribe-during-notify is safe.
      for (const fn of [...subscribers]) fn(value, prev);
    },

    subscribe(fn) {
      subscribers.add(fn);
      return () => {
        subscribers.delete(fn);
      };
    },

    derive(fn) {
      const derived = useState(fn(value));
      state.subscribe((v) => derived.set(fn(v)));
      return derived;
    }
  };

  return state;
}