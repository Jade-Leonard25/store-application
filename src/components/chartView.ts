import { Chart, registerables } from 'chart.js';
import type { ChartConfiguration } from 'chart.js';
import type { Component } from '@/lib/dom';
import { el } from '@/lib/dom';

Chart.register(...registerables);

export interface ChartViewComponent extends Component {
  render(config: ChartConfiguration | null): void;
  toDataURL(): string | null;
  destroy(): void;
}

export function createChartView(): ChartViewComponent {
  const canvas = el('canvas', { class: 'w-full h-full block' });
  const empty = el(
    'div',
    {
      class:
        'absolute inset-0 flex items-center justify-center text-fg-muted pointer-events-none'
    },
    ['Select an X column and at least one Y column']
  );
  const root = el('div', { class: 'relative flex-1 min-h-[260px] p-4 bg-bg' }, [
    canvas,
    empty
  ]);

  let chart: Chart | null = null;
  let lastType: string | null = null;

  const ro = new ResizeObserver(() => chart?.resize());
  ro.observe(root);

  function destroyChart(): void {
    if (chart) {
      chart.destroy();
      chart = null;
      lastType = null;
    }
  }

  return {
    el: root,

    render(config) {
      if (!config) {
        destroyChart();
        canvas.classList.add('hidden');
        empty.classList.remove('hidden');
        return;
      }

      canvas.classList.remove('hidden');
      empty.classList.add('hidden');

      const nextType = String(config.type);
      if (chart && nextType !== lastType) destroyChart();

      if (chart) {
        chart.data = config.data as never;
        chart.options = config.options as never;
        chart.update();
      } else {
        chart = new Chart(canvas, config);
        lastType = nextType;
      }
    },

    toDataURL() {
      return chart ? chart.toBase64Image() : null;
    },

    destroy() {
      ro.disconnect();
      destroyChart();
    }
  };
}