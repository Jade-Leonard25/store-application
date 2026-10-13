import type { Dataset } from '@/shared/types';
import type { Component } from '@/lib/dom';
import { el } from '@/lib/dom';

const MAX_ROWS = 500;

export interface DataTableComponent extends Component {
  render(dataset: Dataset | null): void;
}

export function createDataTable(): DataTableComponent {
  const info = el('div', {
    class: 'px-3 py-1.5 border-b border-border text-fg-muted text-xs'
  });
  const scroller = el('div', { class: 'flex-1 overflow-auto' });
  const root = el(
    'div',
    {
      class:
        'border-t border-border h-[42%] min-h-[180px] flex flex-col bg-bg-elev'
    },
    [info, scroller]
  );

  function render(dataset: Dataset | null): void {
    if (!dataset) {
      info.textContent = '';
      scroller.replaceChildren();
      return;
    }

    const shown = Math.min(dataset.rows.length, MAX_ROWS);
    info.textContent =
      `${dataset.rowCount.toLocaleString()} rows · ${dataset.columns.length} columns` +
      (shown < dataset.rowCount ? ` · showing first ${shown}` : '');

    const headRow = el('tr');
    for (const c of dataset.columns) {
      headRow.appendChild(
        el(
          'th',
          {
            title: `${c.type} — ${c.uniqueCount} unique`,
            class:
              'sticky top-0 bg-bg-elev-2 border-b border-border px-2.5 py-1.5 text-left font-semibold whitespace-nowrap z-10'
          },
          [c.name]
        )
      );
    }
    const thead = el('thead', {}, [headRow]);

    const tbody = el('tbody');
    for (let i = 0; i < shown; i++) {
      const row = dataset.rows[i];
      const tr = el('tr', { class: 'hover:bg-bg-elev-2' });
      for (let j = 0; j < dataset.columns.length; j++) {
        tr.appendChild(
          el(
            'td',
            {
              class:
                'px-2.5 py-1 border-b border-border whitespace-nowrap text-fg-muted'
            },
            [formatCell(row[j])]
          )
        );
      }
      tbody.appendChild(tr);
    }

    const table = el(
      'table',
      { class: 'border-collapse text-xs font-mono w-max min-w-full' },
      [thead, tbody]
    );
    scroller.replaceChildren(table);
  }

  return { el: root, render };
}

function formatCell(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return String(v);
    return v.toFixed(2);
  }
  return String(v);
}