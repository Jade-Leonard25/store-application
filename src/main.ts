/**
 * Spreadsheet Grapher — app entry point
 * Copyright (c) 2026 <Your Company>. All rights reserved.
 * SPDX-License-Identifier: UNLICENSED
 */

import '@/style.css';

import type {
  ChartType,
  Dataset,
  ParsedSheet,
  ParsedWorkbook
} from '@/shared/types';
import { createStore } from '@/lib/store';
import { parseFile } from '@/lib/parsers/index';
import { buildDataset } from '@/lib/dataset';
import { buildChartConfig } from '@/lib/chartConfig';
import { el } from '@/lib/dom';
import { route, navigate } from '@/lib/router';
import { toMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { createDashboard } from '@/routers/dashboard';
import { createSheetPicker } from '@/components/sheetPicker';
import { createColumnSelector } from '@/components/columnSelector';
import { createChartTypePicker } from '@/components/chartTypePicker';
import { createChartView } from '@/components/chartView';
import { createDataTable } from '@/components/dataTable';

/* ---------------------------------------------------------------------------
 * App state
 *
 * `workbook` holds every sheet from the file (for the sheet picker).
 * `dataset` is the currently viewed sheet, rebuilt whenever the user
 * switches sheets.
 * ------------------------------------------------------------------------ */

interface AppState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  workbook: ParsedWorkbook | null;
  activeSheet: number;
  dataset: Dataset | null;
  chartType: ChartType;
  xColumn: string | null;
  yColumns: string[];
}

const store = createStore<AppState>({
  status: 'idle',
  error: null,
  workbook: null,
  activeSheet: 0,
  dataset: null,
  chartType: 'line',
  xColumn: null,
  yColumns: []
});

/* ---------------------------------------------------------------------------
 * Shell
 * ------------------------------------------------------------------------ */

const appRoot = document.getElementById('app');
if (!appRoot) throw new Error('#app not found');
appRoot.replaceChildren();

const openBtn = Button({
  variant: 'secondary',
  text: 'Open file',
  onclick: () => openViaDialog()
});

const exportBtn = Button({
  variant: 'secondary',
  text: 'Export PNG',
  onclick: () => exportPng()
});

const themeBtn = Button({
  variant: 'ghost',
  text: 'Theme',
  onclick: () => document.body.classList.toggle('light')
});

const header = el(
  'header',
  {
    class:
      'flex items-center justify-between px-4 py-2.5 bg-bg-elev border-b border-border shrink-0'
  },
  [
    el('div', { class: 'font-semibold flex items-center gap-2' }, [
      '📊 Spreadsheet Grapher'
    ]),
    el('div', { class: 'flex gap-2' }, [themeBtn, exportBtn, openBtn])
  ]
);

const main = el('main', { class: 'flex-1 flex min-h-0 relative' });

const dashboard = createDashboard({
  onFile: (bytes, name) => void loadFile(bytes, name),
  onBrowse: () => openViaDialog()
});

const loading = el(
  'div',
  { class: 'hidden flex-1 items-center justify-center text-fg-muted text-base' },
  ['Parsing…']
);

const sidebar = el('aside', {
  class:
    'hidden w-[260px] shrink-0 border-r border-border bg-bg-elev p-4 overflow-y-auto flex-col'
});

const rightPane = el('section', {
  class: 'hidden flex-1 flex-col min-w-0 min-h-0'
});

const chartView = createChartView();
const dataTable = createDataTable();
rightPane.append(chartView.el, dataTable.el);

const notFound = el(
  'div',
  { class: 'hidden flex-1 flex-col items-center justify-center gap-3 p-6' },
  [
    el('div', { class: 'text-5xl select-none' }, ['🤷']),
    el('h2', { class: 'text-lg font-semibold' }, ['Page not found']),
    Button({
      variant: 'secondary',
      text: 'Back to home',
      onclick: () => navigate('/')
    })
  ]
);

main.append(dashboard.el, loading, sidebar, rightPane, notFound);

const shell = el('div', { class: 'flex flex-col h-full' }, [header, main]);
appRoot.appendChild(shell);

/* ---------------------------------------------------------------------------
 * Show / hide
 * ------------------------------------------------------------------------ */

function show(...nodes: HTMLElement[]): void {
  for (const n of nodes) n.classList.remove('hidden');
}

function hide(...nodes: HTMLElement[]): void {
  for (const n of nodes) n.classList.add('hidden');
}

/* ---------------------------------------------------------------------------
 * render()
 * ------------------------------------------------------------------------ */

function render(): void {
  const s = store.get();
  const r = route.get();

  if (r.name === 'welcome') {
    hide(loading, sidebar, rightPane, notFound);
    show(dashboard.el);
    dashboard.setError(s.error);
    return;
  }

  if (r.name === 'dataset' || r.name === 'sheet') {
    hide(dashboard.el, notFound);

    if (s.status === 'loading') {
      hide(sidebar, rightPane);
      show(loading);
      return;
    }

    if (s.status === 'ready' && s.dataset) {
      hide(loading);
      show(sidebar, rightPane);
      try {
        renderSidebar(s);
        renderChartAndTable(s);
      } catch (err) {
        console.error('Render error:', err);
        store.set({ status: 'error', error: toMessage(err) });
        navigate('/');
      }
      return;
    }

    navigate('/');
    return;
  }

  if (r.name === 'not-found') {
    hide(dashboard.el, loading, sidebar, rightPane);
    show(notFound);
  }
}

/* ---------------------------------------------------------------------------
 * Sub-renderers
 * ------------------------------------------------------------------------ */

function sectionLabel(text: string): HTMLElement {
  return el(
    'div',
    {
      class:
        'text-[11px] uppercase tracking-[0.08em] text-fg-muted mt-4 mb-1.5 first:mt-0'
    },
    [text]
  );
}

function renderSidebar(s: AppState): void {
  if (!s.workbook || !s.dataset) return;

  sidebar.replaceChildren();

  if (s.workbook.sheets.length > 1) {
    sidebar.appendChild(sectionLabel('Sheets'));
    sidebar.appendChild(
      createSheetPicker(
        s.workbook.sheets.map((sh) => sh.name),
        s.activeSheet,
        (i) => selectSheet(i)
      ).el
    );
  }

  sidebar.appendChild(sectionLabel('Chart type'));
  sidebar.appendChild(
    createChartTypePicker(s.chartType, (t) => store.set({ chartType: t })).el
  );

  sidebar.appendChild(sectionLabel('Columns'));
  sidebar.appendChild(
    createColumnSelector(
      {
        columns: s.dataset.columns,
        xColumn: s.xColumn,
        yColumns: s.yColumns,
        chartType: s.chartType
      },
      {
        onXChange: (name) => store.set({ xColumn: name }),
        onYToggle: (name, checked) => toggleY(name, checked)
      }
    ).el
  );
}

function renderChartAndTable(s: AppState): void {
  if (!s.dataset) return;

  chartView.render(
    buildChartConfig(s.dataset, {
      type: s.chartType,
      xColumn: s.xColumn,
      yColumns: s.yColumns
    })
  );
  dataTable.render(s.dataset);
}

/* ---------------------------------------------------------------------------
 * Actions
 * ------------------------------------------------------------------------ */

async function openViaDialog(): Promise<void> {
  if (window.electronAPI?.openFileDialog) {
    const res = await window.electronAPI.openFileDialog();
    if (res) {
      await loadFile(res.bytes, res.name);
    }
    return;
  }
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv,.tsv,.xlsx,.xls';
  input.addEventListener('change', async () => {
    const f = input.files?.[0];
    if (!f) return;
    const bytes = new Uint8Array(await f.arrayBuffer());
    await loadFile(bytes, f.name);
  });
  input.click();
}

async function loadFile(bytes: Uint8Array, name: string): Promise<void> {
  store.set({ status: 'loading', error: null });
  try {
    const parsed = await parseFile(name, bytes);
    if (parsed.sheets.length === 0) throw new Error('No sheets found');

    const first = parsed.sheets[0];
    const dataset = buildDataset(parsed.fileName, first);
    const x = guessX(dataset);
    const y = guessY(dataset, x);

    store.set({
      status: 'ready',
      error: null,
      workbook: parsed,
      activeSheet: 0,
      dataset,
      xColumn: x,
      yColumns: y
    });

    const id = dataset.id ?? encodeURIComponent(dataset.fileName);
    navigate(`/dataset/${id}`);
  } catch (err) {
    store.set({ status: 'error', error: toMessage(err) });
  }
}

function selectSheet(index: number): void {
  const s = store.get();
  if (!s.workbook) return;

  const sheet: ParsedSheet | undefined = s.workbook.sheets[index];
  if (!sheet) return;

  const dataset = buildDataset(s.workbook.fileName, sheet);
  const x = guessX(dataset);
  const y = guessY(dataset, x);

  store.set({
    activeSheet: index,
    dataset,
    xColumn: x,
    yColumns: y
  });

  const id = dataset.id ?? encodeURIComponent(dataset.fileName);
  navigate(`/dataset/${id}/sheet/${index}`);
}

function toggleY(name: string, checked: boolean): void {
  const s = store.get();
  const next = checked
    ? Array.from(new Set([...s.yColumns, name]))
    : s.yColumns.filter((n) => n !== name);
  store.set({ yColumns: next });
}

function guessX(d: Dataset): string | null {
  const date = d.columns.find((c) => c.type === 'date');
  if (date) return date.name;
  const cat = d.columns.find((c) => c.type === 'category');
  if (cat) return cat.name;
  return d.columns[0]?.name ?? null;
}

function guessY(d: Dataset, x: string | null): string[] {
  return d.columns
    .filter((c) => c.type === 'number' && c.name !== x)
    .slice(0, 3)
    .map((c) => c.name);
}

function exportPng(): void {
  const url = chartView.toDataURL();
  if (!url) return;
  const a = document.createElement('a');
  a.href = url;
  a.download = 'chart.png';
  a.click();
}

/* ---------------------------------------------------------------------------
 * Wire and render
 * ------------------------------------------------------------------------ */

store.subscribe(() => render());
route.subscribe(() => render());
render();

window.addEventListener('error', (event) => {
  console.error('Global application error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Global unhandled rejection:', event.reason);
});