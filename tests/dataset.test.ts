import { describe, it, expect } from 'vitest';
import { buildDataset, normalizeHeaders } from '../src/lib/dataset';
import type { ParsedSheet } from '../src/shared/types';

describe('Header Normalization', () => {
  it('deduplicates identical and case-insensitive headers', () => {
    const headers = ['Sales', 'sales', 'SALES', ''];
    const normalized = normalizeHeaders(headers);
    expect(normalized).toEqual(['Sales', 'sales (2)', 'SALES (3)', 'Column 4']);
  });

  it('trims whitespace and replaces empty names', () => {
    const headers = ['  Age  ', '', '   '];
    const normalized = normalizeHeaders(headers);
    expect(normalized).toEqual(['Age', 'Column 2', 'Column 3']);
  });
});

describe('Dataset Profiler & Type Inference', () => {
  it('correctly classifies numeric and currency columns', () => {
    const sheet: ParsedSheet = {
      name: 'Financials',
      headers: ['Revenue', 'ProfitMargin'],
      rows: [
        ['$1,200.50', '15%'],
        ['$2,450.00', '22%'],
        ['$3,100.25', '18.5%'],
        ['$4,000.00', '30%']
      ]
    };

    const dataset = buildDataset('data.csv', sheet);
    expect(dataset.columns).toHaveLength(2);

    const revenueCol = dataset.columns[0];
    expect(revenueCol.type).toBe('number');
    expect(revenueCol.min).toBe(1200.50);
    expect(revenueCol.max).toBe(4000);

    const marginCol = dataset.columns[1];
    expect(marginCol.type).toBe('number');
    expect(marginCol.min).toBe(15);
    expect(marginCol.max).toBe(30);
  });

  it('correctly classifies boolean columns', () => {
    const sheet: ParsedSheet = {
      name: 'Users',
      headers: ['IsActive', 'Verified'],
      rows: [
        ['true', 'yes'],
        ['false', 'no'],
        ['true', 'yes'],
        ['false', 'no']
      ]
    };

    const dataset = buildDataset('users.csv', sheet);
    expect(dataset.columns[0].type).toBe('boolean');
    expect(dataset.columns[1].type).toBe('boolean');
  });

  it('correctly classifies date columns and infers order', () => {
    const sheet: ParsedSheet = {
      name: 'Dates',
      headers: ['ISO_Date', 'US_Date'],
      rows: [
        ['2026-01-15', '03/25/2026'],
        ['2026-02-15', '04/10/2026'],
        ['2026-03-15', '12/31/2026']
      ]
    };

    const dataset = buildDataset('dates.csv', sheet);
    expect(dataset.columns[0].type).toBe('date');
    expect(dataset.columns[1].type).toBe('date');
  });

  it('filters null and error tokens into null cells', () => {
    const sheet: ParsedSheet = {
      name: 'Errors',
      headers: ['Metric'],
      rows: [
        ['100'],
        ['#N/A'],
        ['#DIV/0!'],
        ['null'],
        ['200']
      ]
    };

    const dataset = buildDataset('errors.csv', sheet);
    const col = dataset.columns[0];
    expect(col.type).toBe('number');
    expect(col.nullCount).toBe(3);
    expect(col.min).toBe(100);
    expect(col.max).toBe(200);
  });
});

