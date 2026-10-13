/**
 * src/renderer/core/dataset.ts
 *
 * Turns a parsed sheet into a Dataset: normalizes headers, detects each
 * column's type, and computes a profile (stats, null counts, confidence).
 *
 * Pure and synchronous. For very large sheets (1M+ cells), run this inside a
 * Web Worker so the UI thread stays responsive.
 */

import type { Cell, Column, ColumnType, Dataset, ParsedSheet } from '@/shared/types';
import type { DateOrder, NumberFormat } from '@/shared/types';

/* ---------------------------------------------------------------------------
 * Tunables
 * ------------------------------------------------------------------------ */

/** A column is "category" only when it has at most this many distinct values. */
export const CATEGORY_UNIQUE_CAP = 200;
/** Share of non-null cells that must parse as a type for the column to get it. */
export const TYPE_THRESHOLD = 0.9;
/** distinct / non-null must be at or below this for a text column to be a category. */
const MAX_CATEGORY_RATIO = 0.5;
/** Stop tracking distinct values after this many (memory guard for ID columns). */
const UNIQUE_TRACK_LIMIT = 1_000;
const SAMPLE_COUNT = 5;
const MAX_NUMBER_STRING_LENGTH = 40;

/**
 * Strings treated as "no value". Note: "na" collides with real data such as
 * country codes (Namibia) or "North America". Pass your own set via
 * BuildOptions if that matters for your customers.
 */
export const DEFAULT_NULL_TOKENS: ReadonlySet<string> = new Set([
  '',
  'n/a',
  'na',
  'null',
  'nan',
  'none',
  '-',
  '--',
  '#n/a',
  '#null!',
  '#div/0!',
  '#value!',
  '#ref!',
  '#name?',
  '#num!'
]);

export interface BuildOptions {
  nullTokens?: ReadonlySet<string>;
}

/* ---------------------------------------------------------------------------
 * Public API
 * ------------------------------------------------------------------------ */

export function buildDataset(
  fileName: string,
  sheet: ParsedSheet,
  options: BuildOptions = {}
): Dataset {
  const nullTokens = options.nullTokens ?? DEFAULT_NULL_TOKENS;
  const rows = sheet.rows;

  // Rows can be wider than the header row; never silently drop those columns.
  let width = sheet.headers.length;
  for (let i = 0; i < rows.length; i++) {
    const len = rows[i]?.length ?? 0;
    if (len > width) width = len;
  }
  const rawHeaders = Array.from({ length: width }, (_, i) => sheet.headers[i] ?? '');
  const headers = normalizeHeaders(rawHeaders);

  const columns: Column[] = headers.map((name, index) =>
    analyzeColumn(name, rawHeaders[index], index, rows, nullTokens)
  );

  return {
    fileName,
    sheetName: sheet.name,
    headers,
    columns,
    rows,
    rowCount: rows.length
  };
}

/**
 * Makes headers unique and non-empty, case-insensitively.
 * ["A", "a", "", "A"] -> ["A", "a (2)", "Column 3", "A (3)"]
 */
export function normalizeHeaders(headers: readonly string[]): string[] {
  const used = new Set<string>();
  return headers.map((raw, i) => {
    const base = String(raw ?? '').trim() || `Column ${i + 1}`;
    let name = base;
    let n = 1;
    while (used.has(name.toLowerCase())) {
      n++;
      name = `${base} (${n})`;
    }
    used.add(name.toLowerCase());
    return name;
  });
}

/* ---------------------------------------------------------------------------
 * Column analysis (single pass over the rows)
 * ------------------------------------------------------------------------ */

function analyzeColumn(
  name: string,
  originalName: string,
  index: number,
  rows: Cell[][],
  nullTokens: ReadonlySet<string>
): Column {
  let nullCount = 0;
  let nonNull = 0;

  // numbers
  let numberCount = 0;
  let currencyCount = 0;
  let percentCount = 0;
  let sum = 0;
  const numbers: number[] = [];

  // booleans
  let booleanCount = 0;

  // dates that are unambiguous (Date objects and ISO strings)
  let directDates = 0;
  let directMin = Infinity;
  let directMax = -Infinity;

  // dates like 03/04/2024 where day/month order must be inferred per column
  let slashSeen = 0;
  let mdyValid = 0;
  let dmyValid = 0;
  let mdyOnly = 0; // valid ONLY as month-first, e.g. 12/25/2024
  let dmyOnly = 0; // valid ONLY as day-first, e.g. 25/12/2024
  let mdyMin = Infinity;
  let mdyMax = -Infinity;
  let dmyMin = Infinity;
  let dmyMax = -Infinity;

  const unique = new Set<string>();
  let uniqueCapped = false;
  const samples: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const v = rows[i]?.[index] ?? null;

    if (isNullish(v, nullTokens)) {
      nullCount++;
      continue;
    }
    nonNull++;

    if (!uniqueCapped) {
      const key =
        v instanceof Date ? v.toISOString() : typeof v === 'string' ? v.trim() : String(v);
      if (!unique.has(key)) {
        unique.add(key);
        if (samples.length < SAMPLE_COUNT) samples.push(key);
        if (unique.size >= UNIQUE_TRACK_LIMIT) uniqueCapped = true;
      }
    }

    if (v instanceof Date) {
      const t = v.getTime();
      directDates++;
      if (t < directMin) directMin = t;
      if (t > directMax) directMax = t;
      continue;
    }

    if (typeof v === 'boolean') {
      booleanCount++;
      continue;
    }

    const num = parseNumber(v);
    if (num) {
      numberCount++;
      sum += num.value;
      numbers.push(num.value);
      if (num.format === 'currency') currencyCount++;
      else if (num.format === 'percent') percentCount++;
      continue;
    }

    if (typeof v !== 'string') continue;
    const t = v.trim();

    if (BOOLEAN_RE.test(t)) {
      booleanCount++;
      continue;
    }

    const iso = parseIsoDate(t);
    if (iso !== null) {
      directDates++;
      if (iso < directMin) directMin = iso;
      if (iso > directMax) directMax = iso;
      continue;
    }

    const slash = parseSlashDate(t);
    if (slash) {
      slashSeen++;
      if (slash.mdy !== null) {
        mdyValid++;
        if (slash.mdy < mdyMin) mdyMin = slash.mdy;
        if (slash.mdy > mdyMax) mdyMax = slash.mdy;
      }
      if (slash.dmy !== null) {
        dmyValid++;
        if (slash.dmy < dmyMin) dmyMin = slash.dmy;
        if (slash.dmy > dmyMax) dmyMax = slash.dmy;
      }
      if (slash.mdy !== null && slash.dmy === null) mdyOnly++;
      if (slash.dmy !== null && slash.mdy === null) dmyOnly++;
    }
  }

  /* ---- decide slash-date order: use hard evidence, else default month-first */
  let slashOrder: 'mdy' | 'dmy' = 'mdy';
  if (dmyOnly > 0 && mdyOnly === 0) slashOrder = 'dmy';
  else if (mdyOnly > 0 && dmyOnly === 0) slashOrder = 'mdy';
  else if (dmyValid > mdyValid) slashOrder = 'dmy';

  const slashDates = slashOrder === 'mdy' ? mdyValid : dmyValid;
  const dateCount = directDates + slashDates;

  /* ---- pick a type */
  const ratio = (n: number) => (nonNull === 0 ? 0 : n / nonNull);
  const candidates: Array<[ColumnType, number]> = [
    ['number', numberCount],
    ['date', dateCount],
    ['boolean', booleanCount]
  ];

  let type: ColumnType = 'text';
  let typedCount = 0;
  let bestTypedRatio = 0;
  for (const [t, count] of candidates) {
    const r = ratio(count);
    if (r > bestTypedRatio) bestTypedRatio = r;
    if (r > TYPE_THRESHOLD && count > typedCount) {
      type = t;
      typedCount = count;
    }
  }

  if (
    type === 'text' &&
    nonNull > 0 &&
    !uniqueCapped &&
    unique.size <= CATEGORY_UNIQUE_CAP &&
    unique.size / nonNull <= MAX_CATEGORY_RATIO
  ) {
    type = 'category';
  }

  const isTyped = type === 'number' || type === 'date' || type === 'boolean';

  // Typed columns: share that parsed. Text/category: how un-typed it really is.
  // Low confidence means "mixed", so the UI can warn instead of guessing.
  const typeConfidence = nonNull === 0 ? 1 : isTyped ? ratio(typedCount) : 1 - bestTypedRatio;

  const column: Column = {
    name,
    originalName,
    index,
    type,
    typeConfidence,
    nullCount,
    invalidCount: isTyped ? nonNull - typedCount : 0,
    uniqueCount: unique.size,
    uniqueCapped,
    sampleValues: samples
  };

  /* ---- type-specific stats */
  if (type === 'number' && numberCount > 0) {
    numbers.sort((a, b) => a - b);
    const mid = numbers.length >> 1;
    column.min = numbers[0];
    column.max = numbers[numbers.length - 1];
    column.mean = sum / numberCount;
    column.median = numbers.length % 2 ? numbers[mid] : (numbers[mid - 1] + numbers[mid]) / 2;
    column.numberFormat = pickNumberFormat(numberCount, currencyCount, percentCount);
  }

  if (type === 'date') {
    const sMin = slashOrder === 'mdy' ? mdyMin : dmyMin;
    const sMax = slashOrder === 'mdy' ? mdyMax : dmyMax;
    const lo = Math.min(directMin, slashDates > 0 ? sMin : Infinity);
    const hi = Math.max(directMax, slashDates > 0 ? sMax : -Infinity);
    if (Number.isFinite(lo) && Number.isFinite(hi)) {
      column.dateMin = new Date(lo).toISOString();
      column.dateMax = new Date(hi).toISOString();
    }
    const dateOrder: DateOrder = slashSeen > 0 ? slashOrder : 'ymd';
    column.dateOrder = dateOrder;
  }

  return column;
}

function pickNumberFormat(total: number, currency: number, percent: number): NumberFormat {
  if (currency / total > 0.5) return 'currency';
  if (percent / total > 0.5) return 'percent';
  return 'plain';
}

/* ---------------------------------------------------------------------------
 * Null handling
 * ------------------------------------------------------------------------ */

function isNullish(v: Cell | null, nullTokens: ReadonlySet<string>): boolean {
  if (v == null) return true;
  if (typeof v === 'string') return nullTokens.has(v.trim().toLowerCase());
  if (typeof v === 'number') return !Number.isFinite(v); // NaN, +/-Infinity
  if (v instanceof Date) return Number.isNaN(v.getTime());
  return false;
}

/* ---------------------------------------------------------------------------
 * Number parsing
 *
 * Handles: 1234, 1,234.50, $1,234.50, (500), -$5, 12%, 1e5, .5,
 *          and unambiguous European formats (1.234,56 and 12,5).
 * Rejects: leading-zero IDs (01234), integers beyond 2^53 (phone/card
 *          numbers), and anything with stray text.
 *
 * Percent values keep their written scale: "12%" -> 12 (not 0.12).
 * ------------------------------------------------------------------------ */

interface ParsedNumber {
  value: number;
  format: NumberFormat;
}

const LEAD_CURRENCY_RE = /^([+-])?\s*[$€£¥₹]\s*/;
const TRAIL_SYMBOL_RE = /\s*([$€£¥₹]|%)$/;
const US_NUMBER_RE =
  /^[+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const EU_NUMBER_RE = /^[+-]?(?:\d{1,3}(?:\.\d{3})+,\d+|\d+,\d{1,2})$/;
const LEADING_ZERO_RE = /^[+-]?0\d/;
const DIGITS_ONLY_RE = /^[+-]?\d+$/;

function parseNumber(v: Cell): ParsedNumber | null {
  if (typeof v === 'number') {
    return Number.isFinite(v) ? { value: v, format: 'plain' } : null;
  }
  if (typeof v !== 'string') return null;

  let t = v.trim();
  if (t.length === 0 || t.length > MAX_NUMBER_STRING_LENGTH) return null;

  let sign = 1;
  let format: NumberFormat = 'plain';

  if (t.startsWith('(') && t.endsWith(')')) {
    sign = -1;
    t = t.slice(1, -1).trim();
  }

  const lead = LEAD_CURRENCY_RE.exec(t);
  if (lead) {
    format = 'currency';
    if (lead[1] === '-') sign = -sign;
    t = t.slice(lead[0].length);
  }

  const trail = TRAIL_SYMBOL_RE.exec(t);
  if (trail) {
    format = trail[1] === '%' ? 'percent' : 'currency';
    t = t.slice(0, trail.index).trim();
  }

  if (t.length === 0 || LEADING_ZERO_RE.test(t)) return null; // zip codes, IDs

  let n: number;
  if (US_NUMBER_RE.test(t)) n = Number(t.replace(/,/g, ''));
  else if (EU_NUMBER_RE.test(t)) n = Number(t.replace(/\./g, '').replace(',', '.'));
  else return null;

  if (!Number.isFinite(n)) return null;
  // Integers too big to be exact are almost always identifiers, not measures.
  if (DIGITS_ONLY_RE.test(t) && !Number.isSafeInteger(n)) return null;

  return { value: sign * n, format };
}

/* ---------------------------------------------------------------------------
 * Boolean + date parsing (anchored and validated)
 * ------------------------------------------------------------------------ */

const BOOLEAN_RE = /^(true|false|yes|no)$/i;

const ISO_RE =
  /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

const SLASH_RE =
  /^(\d{1,2})([/.-])(\d{1,2})\2(\d{2}|\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

/** UTC timestamp, or null if the components aren't a real calendar date/time. */
function utcMs(y: number, mo: number, d: number, h = 0, mi = 0, s = 0): number | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  const ms = Date.UTC(y, mo - 1, d, h, mi, s);
  const dt = new Date(ms);
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
    ? ms
    : null;
}

function parseIsoDate(t: string): number | null {
  if (t.length < 8 || t.length > 35) return null;
  const m = ISO_RE.exec(t);
  if (!m) return null;

  const ms = utcMs(+m[1], +m[2], +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0, m[6] ? +m[6] : 0);
  if (ms === null) return null;

  const tz = m[7];
  if (!tz || tz === 'Z') return ms; // no zone: treat as UTC so charts are stable
  const sign = tz[0] === '-' ? -1 : 1;
  const digits = tz.slice(1).replace(':', '');
  const offsetMs = (+digits.slice(0, 2) * 60 + +digits.slice(2)) * 60_000;
  return ms - sign * offsetMs;
}

interface SlashDate {
  mdy: number | null;
  dmy: number | null;
}

function parseSlashDate(t: string): SlashDate | null {
  if (t.length < 6 || t.length > 25) return null;
  const m = SLASH_RE.exec(t);
  if (!m) return null;

  // "1.2.20" is far more likely a version string than a date.
  if (m[2] === '.' && m[4].length === 2) return null;

  const a = +m[1];
  const b = +m[3];
  let y = +m[4];
  if (m[4].length === 2) y = y < 70 ? 2000 + y : 1900 + y;
  const h = m[5] ? +m[5] : 0;
  const mi = m[6] ? +m[6] : 0;
  const s = m[7] ? +m[7] : 0;

  const mdy = utcMs(y, a, b, h, mi, s);
  const dmy = utcMs(y, b, a, h, mi, s);
  if (mdy === null && dmy === null) return null;
  return { mdy, dmy };
}