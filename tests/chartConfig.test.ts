import { describe, it, expect } from 'vitest';
import { buildChartConfig } from '../src/lib/chartConfig';
import type { Dataset } from '../src/shared/types';

describe('Chart Configuration Builder', () => {
  const mockDataset: Dataset = {
    fileName: 'test.csv',
    sheetName: 'Sheet1',
    headers: ['Date', 'Revenue', 'Expenses'],
    rowCount: 3,
    rows: [
      ['2026-01-01', 100, 80],
      ['2026-01-02', 150, 90],
      ['2026-01-03', 200, 110]
    ],
    columns: [
      { name: 'Date', index: 0, type: 'date', nullCount: 0, uniqueCount: 3 },
      { name: 'Revenue', index: 1, type: 'number', nullCount: 0, uniqueCount: 3, min: 100, max: 200 },
      { name: 'Expenses', index: 2, type: 'number', nullCount: 0, uniqueCount: 3, min: 80, max: 110 }
    ]
  };

  it('generates a valid Line chart configuration', () => {
    const config = buildChartConfig(mockDataset, {
      type: 'line',
      xColumn: 'Date',
      yColumns: ['Revenue', 'Expenses']
    });

    expect(config).not.toBeNull();
    expect(config?.type).toBe('line');
    expect(config?.data.labels).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
    expect(config?.data.datasets).toHaveLength(2);
    expect(config?.data.datasets[0].label).toBe('Revenue');
    expect(config?.data.datasets[0].data).toEqual([100, 150, 200]);
  });

  it('generates a valid Bar chart configuration', () => {
    const config = buildChartConfig(mockDataset, {
      type: 'bar',
      xColumn: 'Date',
      yColumns: ['Revenue']
    });

    expect(config).not.toBeNull();
    expect(config?.type).toBe('bar');
    expect(config?.data.datasets).toHaveLength(1);
    expect(config?.data.datasets[0].data).toEqual([100, 150, 200]);
  });

  it('maps Area chart to line type with filled background', () => {
    const config = buildChartConfig(mockDataset, {
      type: 'area',
      xColumn: 'Date',
      yColumns: ['Revenue']
    });

    expect(config).not.toBeNull();
    expect(config?.type).toBe('line');
    expect((config?.data.datasets[0] as { fill?: boolean }).fill).toBe(true);
  });

  it('returns null if no X column or Y columns are selected', () => {
    const noX = buildChartConfig(mockDataset, {
      type: 'line',
      xColumn: null,
      yColumns: ['Revenue']
    });
    expect(noX).toBeNull();

    const noY = buildChartConfig(mockDataset, {
      type: 'line',
      xColumn: 'Date',
      yColumns: []
    });
    expect(noY).toBeNull();
  });
});

