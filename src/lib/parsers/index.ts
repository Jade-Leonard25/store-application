import type { ParsedWorkbook } from '@/shared/types';
import { parseCsv } from './csvParser';
import { parseExcel } from './excelParser';

export async function parseFile(
  fileName: string,
  bytes: Uint8Array
): Promise<ParsedWorkbook> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.csv') || lower.endsWith('.tsv')) {
    return parseCsv(bytes, fileName);
  }
  if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm')) {
    return parseExcel(bytes, fileName);
  }
  return parseCsv(bytes, fileName);
}

export { parseCsv, parseExcel };