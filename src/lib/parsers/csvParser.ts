import Papa from 'papaparse';
import type { Cell, ParsedSheet, ParsedWorkbook } from '@/shared/types';

export function parseCsv(bytes: Uint8Array, fileName: string): ParsedWorkbook {
  const text = decode(bytes);

  const parsed = Papa.parse<string[]>(text, {
    skipEmptyLines: 'greedy',
    dynamicTyping: false
  });

  const rows = (parsed.data as unknown as string[][]).filter((r) =>
    Array.isArray(r)
  );
  const { headers, data } = splitHeader(rows);

  const sheet: ParsedSheet = { name: 'Sheet1', headers, rows: data };
  return { fileName, sheets: [sheet] };
}

function decode(bytes: Uint8Array): string {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  }
  return new TextDecoder('utf-8').decode(bytes);
}

function splitHeader(rows: string[][]): { headers: string[]; data: Cell[][] } {
  if (rows.length === 0) return { headers: [], data: [] };

  const rawHeader = rows[0] ?? [];
  const headers: string[] = [];
  for (let i = 0; i < rawHeader.length; i++) {
    const h = (rawHeader[i] ?? '').trim();
    headers.push(h.length > 0 ? h : `Column ${i + 1}`);
  }

  const data: Cell[][] = rows.slice(1).map((row) => {
    const out: Cell[] = [];
    for (let i = 0; i < headers.length; i++) {
      const v = row[i];
      out.push(v === undefined || v === '' ? null : v);
    }
    return out;
  });

  return { headers, data };
}