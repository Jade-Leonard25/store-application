/**
 * Spreadsheet Grapher — router
 * Copyright (c) 2026 <Your Company>. All rights reserved.
 * SPDX-License-Identifier: UNLICENSED
 *
 * Hash-based routing on top of Navigo. Exposes the current route as a
 * State<RouteState>, so components subscribe to it the same way they
 * subscribe to any other reactive value.
 */

import Navigo from 'navigo';
import { useState, type State } from '@/lib/state';

export interface RouteParams {
  readonly [key: string]: string;
}

export interface RouteState {
  readonly name: string;
  readonly path: string;
  readonly params: RouteParams;
}

/* ---------------------------------------------------------------------------
 * Public state — the single source of truth for "which page are we on".
 * ------------------------------------------------------------------------ */

export const route: State<RouteState> = useState<RouteState>({
  name: 'welcome',
  path: '/',
  params: {}
});

function sameRoute(a: RouteState, b: RouteState): boolean {
  if (a.name !== b.name) return false;
  if (a.path !== b.path) return false;
  const ka = Object.keys(a.params);
  const kb = Object.keys(b.params);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => a.params[k] === b.params[k]);
}

function setRoute(next: RouteState): void {
  if (sameRoute(route.get(), next)) return;
  route.set(next);
}

/* ---------------------------------------------------------------------------
 * Navigo instance — one per app, lives for the lifetime of the process.
 * ------------------------------------------------------------------------ */

const navigo = new Navigo('/', { hash: true });

navigo
  .on('/', () => {
    setRoute({ name: 'welcome', path: '/', params: {} });
  })
  .on('/dataset/:id', ({ data }:any) => {
    const id = data?.id ?? '';
    setRoute({ name: 'dataset', path: `/dataset/${id}`, params: { id } });
  })
  .on('/dataset/:id/sheet/:sheetId', ({ data }:any) => {
    const id = data?.id ?? '';
    const sheetId = data?.sheetId ?? '';
    setRoute({
      name: 'sheet',
      path: `/dataset/${id}/sheet/${sheetId}`,
      params: { id, sheetId }
    });
  })
  .notFound(() => {
    setRoute({ name: 'not-found', path: '/404', params: {} });
  })
  .resolve();

/* ---------------------------------------------------------------------------
 * API
 * ------------------------------------------------------------------------ */

export function navigate(path: string): void {
  navigo.navigate(path);
}

export function isActive(prefix: string): boolean {
  const p = route.get().path;
  return p === prefix || p.startsWith(prefix + '/');
}

export function onRoute(name: string, fn: (r: RouteState) => void): () => void {
  return route.subscribe((r) => {
    if (r.name === name) fn(r);
  });
}

export function destroyRouter(): void {
  navigo.destroy();
}

/* ---------------------------------------------------------------------------
 * Document title — the only place that writes it.
 * ------------------------------------------------------------------------ */

route.subscribe((r) => {
  document.title = titleFor(r);
});

function titleFor(r: RouteState): string {
  switch (r.name) {
    case 'welcome':
      return 'CSV Reader';
    case 'dataset':
      return 'Dataset — CSV Reader';
    case 'sheet':
      return `${r.params.sheetId} — CSV Reader`;
    case 'not-found':
      return 'Not found — CSV Reader';
    default:
      return 'CSV Reader';
  }
}