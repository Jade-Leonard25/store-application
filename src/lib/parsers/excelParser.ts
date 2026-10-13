import ExcelJS from 'exceljs';
import type { Cell, ParsedSheet, ParsedWorkbook } from '@/shared/types';

export async function parseExcel(
  bytes: Uint8Array,
  fileName: string
): Promise<ParsedWorkbook> {
  const wb = new ExcelJS.Workbook();
  await (wb.xlsx.load as unknown as (b: ArrayBuffer) => Promise<unknown>)(
    bytes.buffer as ArrayBuffer
  );

  const sheets: ParsedSheet[] = [];

  wb.eachSheet((worksheet) => {
    const rawRows: Cell[][] = [];

    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values = row.values as unknown[];
      const arr: Cell[] = [];
      for (let i = 1; i < values.length; i++) {
        arr.push(normalizeCell(values[i]));
      }
      rawRows.push(arr);
    });

    if (rawRows.length === 0) {
      sheets.push({ name: worksheet.name, headers: [], rows: [] });
      return;
    }

    const maxCols = rawRows.reduce((m, r) => Math.max(m, r.length), 0);
    const headerRow = rawRows[0];
    const headers: string[] = [];
    for (let i = 0; i < maxCols; i++) {
      const v = headerRow[i];
      const text = v == null ? '' : String(v).trim();
      headers.push(text.length > 0 ? text : `Column ${i + 1}`);
    }

    const data: Cell[][] = rawRows.slice(1).map((row) => {
      const out: Cell[] = [];
      for (let i = 0; i < maxCols; i++) out.push(row[i] ?? null);
      return out;
    });

    sheets.push({ name: worksheet.name, headers, rows: data });
  });

  return { fileName, sheets };
}

function normalizeCell(v: unknown): Cell {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') {
    return v;
  }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('result' in o) return normalizeCell(o.result);
    if ('text' in o && typeof o.text === 'string') return o.text;
    if ('richText' in o && Array.isArray(o.richText)) {
      return (o.richText as Array<{ text?: string }>)
        .map((r) => r.text ?? '')
        .join('');
    }
    if ('hyperlink' in o) {
      return typeof o.text === 'string' ? o.text : String(o.hyperlink);
    }
    if ('error' in o) return String(o.error);
    return String(v);
  }
  return String(v);
}