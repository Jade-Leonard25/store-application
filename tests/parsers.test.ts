import { describe, it, expect } from 'vitest';
import { parseCsv } from '../src/lib/parsers/csvParser';

describe('CSV Parser', () => {
  it('parses basic CSV content correctly', () => {
    const csvContent = 'Name,Age,Salary\nAlice,30,70000\nBob,25,50000';
    const bytes = new TextEncoder().encode(csvContent);
    const result = parseCsv(bytes, 'employees.csv');

    expect(result.fileName).toBe('employees.csv');
    expect(result.sheets).toHaveLength(1);
    expect(result.sheets[0].headers).toEqual(['Name', 'Age', 'Salary']);
    expect(result.sheets[0].rows).toHaveLength(2);
    expect(result.sheets[0].rows[0]).toEqual(['Alice', '30', '70000']);
    expect(result.sheets[0].rows[1]).toEqual(['Bob', '25', '50000']);
  });

  it('handles empty CSV input gracefully', () => {
    const bytes = new TextEncoder().encode('');
    const result = parseCsv(bytes, 'empty.csv');

    expect(result.sheets[0].headers).toEqual([]);
    expect(result.sheets[0].rows).toEqual([]);
  });

  it('handles CSV with UTF-8 BOM correctly', () => {
    const csvContent = 'Region,Sales\nNorth,100\nSouth,200';
    const utf8Bytes = new TextEncoder().encode(csvContent);
    // Prepend UTF-8 BOM: 0xEF, 0xBB, 0xBF
    const bomBytes = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8Bytes]);

    const result = parseCsv(bomBytes, 'sales.csv');
    expect(result.sheets[0].headers).toEqual(['Region', 'Sales']);
    expect(result.sheets[0].rows[0]).toEqual(['North', '100']);
  });

  it('handles blank headers by assigning fallback names', () => {
    const csvContent = ',Price,\nItem1,20,Extra';
    const bytes = new TextEncoder().encode(csvContent);
    const result = parseCsv(bytes, 'items.csv');

    expect(result.sheets[0].headers).toEqual(['Column 1', 'Price', 'Column 3']);
    expect(result.sheets[0].rows[0]).toEqual(['Item1', '20', 'Extra']);
  });

  it('pads ragged rows with null values', () => {
    const csvContent = 'A,B,C\n1,2\n3,4,5,6';
    const bytes = new TextEncoder().encode(csvContent);
    const result = parseCsv(bytes, 'ragged.csv');

    // Row 1 only has 2 cells, column C should be null
    expect(result.sheets[0].rows[0]).toEqual(['1', '2', null]);
  });
});

