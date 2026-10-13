import type { ChartType, Column } from '@/shared/types';
import type { Component } from '@/lib/dom';
import { el } from '@/lib/dom';

export interface ColumnSelectorState {
  columns: Column[];
  xColumn: string | null;
  yColumns: string[];
  chartType: ChartType;
}

export interface ColumnSelectorCallbacks {
  onXChange: (name: string) => void;
  onYToggle: (name: string, checked: boolean) => void;
}

export function createColumnSelector(
  state: ColumnSelectorState,
  cb: ColumnSelectorCallbacks
): Component {
  const root = el('div', { class: 'flex flex-col gap-3' });

  const xSelect = el('select', {
    class:
      'bg-bg border border-border rounded-md px-2 py-1.5 text-sm text-fg w-full focus:outline-none focus:ring-1 focus:ring-accent'
  });
  xSelect.addEventListener('change', () => cb.onXChange(xSelect.value));

  const xSection = el('div', { class: 'flex flex-col gap-1' }, [
    el('label', { class: 'text-xs text-fg-muted' }, ['X axis']),
    xSelect
  ]);

  const yList = el('div', {
    class: 'flex flex-col gap-1 max-h-[300px] overflow-y-auto'
  });
  const ySection = el('div', { class: 'flex flex-col gap-1' }, [
    el('label', { class: 'text-xs text-fg-muted' }, ['Y series']),
    yList
  ]);

  root.append(xSection, ySection);

  if (state.columns.length === 0) {
    xSelect.appendChild(el('option', { value: '' }, ['(no columns)']));
  } else {
    for (const c of state.columns) {
      xSelect.appendChild(
        el('option', { value: c.name, selected: c.name === state.xColumn }, [
          `${c.name} · ${c.type}`
        ])
      );
    }
    if (state.xColumn) xSelect.value = state.xColumn;
  }

  const numeric = state.columns.filter((c) => c.type === 'number');
  const yCandidates =
    state.chartType === 'pie'
      ? state.columns
      : numeric.length > 0
        ? numeric
        : state.columns;

  if (yCandidates.length === 0) {
    yList.appendChild(
      el('div', { class: 'text-fg-muted text-xs' }, ['No plottable columns'])
    );
  } else {
    for (const c of yCandidates) {
      const id = `y-${c.index}`;
      const checked = state.yColumns.includes(c.name);

      const input = el('input', {
        type: 'checkbox',
        id,
        checked,
        class: 'accent-accent m-0'
      });
      input.addEventListener('change', () => cb.onYToggle(c.name, input.checked));

      const row = el(
        'label',
        {
          for: id,
          class:
            'flex items-center gap-2 px-1.5 py-1 rounded-md cursor-pointer hover:bg-bg-elev-2 text-sm'
        },
        [
          input,
          el('span', {}, [c.name]),
          el('span', { class: 'text-fg-muted text-xs' }, [c.type])
        ]
      );
      yList.appendChild(row);
    }
  }

  return { el: root };
}