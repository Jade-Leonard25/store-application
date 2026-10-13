import type { ChartConfiguration, ChartType as CjsType } from 'chart.js';
import type { Cell, ChartType, Column, Dataset } from '@/shared/types';

const PALETTE = [
  '#58a6ff', '#f78166', '#7ee787', '#d2a8ff',
  '#ffa657', '#79c0ff', '#ff7b72', '#56d364'
];

export interface ChartSelections {
  type: ChartType;
  xColumn: string | null;
  yColumns: string[];
}

export function buildChartConfig(
  dataset: Dataset,
  sel: ChartSelections
): ChartConfiguration | null {
  const xCol = dataset.columns.find((c) => c.name === sel.xColumn);
  const yCols = sel.yColumns
    .map((name) => dataset.columns.find((c) => c.name === name))
    .filter((c): c is Column => Boolean(c));

  if (!xCol || yCols.length === 0) return null;

  const labels = dataset.rows.map((r) => formatLabel(r[xCol.index]));

  const datasets = yCols.map((col, i) => {
    const values = dataset.rows.map((r) => toNumber(r[col.index]));
    const color = PALETTE[i % PALETTE.length];
    const isArea = sel.type === 'area';
    return {
      label: col.name,
      data: values,
      backgroundColor: isArea ? withAlpha(color, 0.25) : color,
      borderColor: color,
      borderWidth: 2,
      tension: 0.25,
      fill: isArea,
      pointRadius: values.length > 200 ? 0 : 2
    };
  });

  const effectiveType: CjsType =
    sel.type === 'area' ? 'line' : (sel.type as CjsType);

  return {
    type: effectiveType,
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 200 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: yCols.length > 1,
          labels: { color: cssVar('--color-fg-muted', '#8b949e') }
        }
      },
      scales:
        effectiveType === 'pie'
          ? undefined
          : {
              x: {
                ticks: {
                  color: cssVar('--color-fg-muted', '#8b949e'),
                  maxRotation: 45,
                  autoSkip: true
                },
                grid: { color: cssVar('--color-border', '#30363d') }
              },
              y: {
                ticks: { color: cssVar('--color-fg-muted', '#8b949e') },
                grid: { color: cssVar('--color-border', '#30363d') }
              }
            }
    }
  };
}

function formatLabel(v: Cell): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

function toNumber(v: Cell): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const int = parseInt(m[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function cssVar(name: string, fallback: string): string {
  if (typeof getComputedStyle !== 'function') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}