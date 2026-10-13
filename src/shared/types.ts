/**
 * Spreadsheet Grapher — data model
 * Copyright (c) 2026 <Your Company>. All rights reserved.
 * SPDX-License-Identifier: UNLICENSED
 *
 * Types only: no DOM, no Node, no runtime imports.
 * Safe to import from main, preload, renderer, and tests.
 *
 * Conventions
 *  - Your original types are unchanged. Everything new is additive and
 *    optional, so existing code keeps compiling.
 *  - Columns are identified by `Column.name`. `normalizeHeaders()` in
 *    dataset.ts guarantees names are unique and non-empty.
 *  - Rows are positional arrays aligned to `columns` (not keyed objects).
 */

/* ===========================================================================
 * Core cells and columns (original)
 * ======================================================================== */

export type Cell = string | number | boolean | Date | null;
export type ColumnType = 'number' | 'date' | 'boolean' | 'category' | 'text';
export type ChartType = 'line' | 'bar' | 'area' | 'scatter' | 'pie';

/** ISO 8601 string, e.g. "2026-10-08T12:00:00.000Z". Safe for JSON. */
export type ISODateString = string;

/** Component order used to read dates; 'ymd' means ISO-style. */
export type DateOrder = 'ymd' | 'mdy' | 'dmy';

export type NumberFormat = 'plain' | 'currency' | 'percent';

export interface Column {
  /** Unique, non-empty. Used as the column's key everywhere. */
  name: string;
  index: number;
  type: ColumnType;
  nullCount: number;
  uniqueCount: number;
  min?: number;
  max?: number;

  /** Header exactly as found in the file; may be blank or duplicated. */
  originalName?: string;

  /**
   * 0..1. For number/date/boolean: share of non-null cells that parsed.
   * For text/category: 1 minus the best typed share, so a low value means
   * "mixed content". Show a warning below ~0.9.
   */
  typeConfidence?: number;
  /** Non-null cells that did NOT match the column's type (typed columns only). */
  invalidCount?: number;
  /** A lower bound when uniqueCapped is true. */
  uniqueCapped?: boolean;
  /** First few distinct non-null values, as strings, for previews. */
  sampleValues?: string[];

  // number columns
  mean?: number;
  median?: number;
  numberFormat?: NumberFormat;

  // date columns (ISO 8601, UTC)
  dateMin?: ISODateString;
  dateMax?: ISODateString;
  dateOrder?: DateOrder;

  // user-editable presentation (not set by the detector)
  /** Label shown in the UI. Defaults to `name`. */
  displayName?: string;
  /** What the detector chose, kept when the user overrides `type`. */
  detectedType?: ColumnType;
  /** Number or date format string, e.g. "#,##0.00" or "yyyy-MM-dd". */
  format?: string;
  /** Currency code when numberFormat === 'currency', e.g. "USD". */
  currency?: string;
  /** Hide from the column pickers and table. */
  hidden?: boolean;
}

/* ===========================================================================
 * Source file metadata and parse diagnostics
 * ======================================================================== */

export type SourceFormat = 'csv' | 'tsv' | 'xlsx' | 'xls';

export interface SourceInfo {
  fileName: string;
  /** Absolute path; main process only. Never persist in shareable files. */
  filePath?: string;
  format: SourceFormat;
  sizeBytes: number;
  /** SHA-256: detect changed files and cache parse results. */
  contentHash?: string;
  importedAt: ISODateString;
  /** CSV/TSV only */
  csv?: {
    delimiter: string;
    encoding: 'utf-8' | 'utf-16le' | 'windows-1252' | 'iso-8859-1';
    hadBom: boolean;
  };
  /** Excel only */
  excel?: {
    sheetNames: string[];
    activeSheetIndex: number;
    date1904: boolean;
  };
}

export type ParseIssueCode =
  | 'DUPLICATE_HEADER'
  | 'EMPTY_HEADER'
  | 'NO_HEADER_DETECTED'
  | 'RAGGED_ROW'
  | 'MIXED_TYPES'
  | 'TRUNCATED'
  | 'FORMULA_ERROR'
  | 'MERGED_CELLS'
  | 'ENCODING_GUESSED';

export interface ParseIssue {
  severity: 'info' | 'warning' | 'error';
  code: ParseIssueCode;
  /** Safe to show to the user. */
  message: string;
  /** 1-based position in the source sheet, when applicable. */
  row?: number;
  /** Column.name, when the issue belongs to one column. */
  column?: string;
}

/* ===========================================================================
 * Parsed input and dataset
 * ======================================================================== */

export interface ParsedSheet {
  name: string;
  headers: string[];
  rows: Cell[][];
  /** Problems found while reading this sheet. */
  issues?: ParseIssue[];
}

export interface ParsedWorkbook {
  fileName: string;
  sheets: ParsedSheet[];
  source?: SourceInfo;
}

export interface Dataset {
  /** Used in routes (`/dataset/:id`). buildDataset should assign one. */
  id?: string;
  fileName: string;
  sheetName: string;
  headers: string[];
  columns: Column[];
  rows: Cell[][];
  rowCount: number;

  source?: SourceInfo;
  /** Combined parser and profiler diagnostics. */
  issues?: ParseIssue[];
  /** True when rows were cut at a size limit; see `totalRowCount`. */
  truncated?: boolean;
  /** Rows in the file, which may exceed rowCount if truncated. */
  totalRowCount?: number;
}

/* ===========================================================================
 * Charts
 * ======================================================================== */

export type ChartId = string;
export type SeriesId = string;

/**
 * The minimal selection the sidebar edits today. A ChartSpec is the full,
 * saveable version of this.
 */
export interface ChartSelection {
  type: ChartType;
  xColumn: string | null;
  yColumns: string[];
}

export type Aggregation =
  | 'none'
  | 'sum'
  | 'average'
  | 'count'
  | 'countDistinct'
  | 'min'
  | 'max'
  | 'median';

export type DateGranularity = 'day' | 'week' | 'month' | 'quarter' | 'year';
export type StackMode = 'none' | 'stacked' | 'percent';
export type YAxisSide = 'left' | 'right';

export interface SeriesSpec {
  id: SeriesId;
  /** Column.name */
  column: string;
  /** Legend label override. */
  label?: string;
  aggregation: Aggregation;
  /** Hex or CSS color. If omitted, the theme palette decides. */
  color?: string;
  /** Enables dual-axis charts. */
  yAxis: YAxisSide;
  /** Per-series override for combo charts (bars plus a line). */
  typeOverride?: Extract<ChartType, 'line' | 'bar' | 'area'>;
  visible: boolean;
}

export type AxisScale = 'linear' | 'log' | 'time' | 'category';

export interface AxisSpec {
  title?: string;
  scale: AxisScale;
  min?: number;
  max?: number;
  /** Number or date format string, same syntax as Column.format. */
  tickFormat?: string;
  showGrid: boolean;
  /** Date bucketing when the X column is a date. */
  granularity?: DateGranularity;
}

export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'in'
  | 'contains'
  | 'isNull'
  | 'notNull';

export interface FilterSpec {
  /** Column.name */
  column: string;
  operator: FilterOperator;
  /** Scalar, array (for "in"), or [lo, hi] (for "between"). */
  value?: Cell | Cell[];
}

export interface SortSpec {
  by: 'x' | 'y' | { series: SeriesId };
  direction: 'asc' | 'desc';
}

export interface LimitSpec {
  /** Keep the top N categories; group the rest into "Other" when groupRest. */
  topN: number;
  groupRest: boolean;
}

export interface LegendSpec {
  show: boolean;
  position: 'top' | 'bottom' | 'left' | 'right';
}

export interface ChartSpec {
  /** Bumped when this shape changes, so saved projects can be migrated. */
  schemaVersion: 1;
  id: ChartId;
  title: string;
  subtitle?: string;
  type: ChartType;

  /** Column.name */
  xColumn: string;
  /** Optional split of each series by a category column. */
  groupByColumn?: string;
  series: SeriesSpec[];

  xAxis: AxisSpec;
  yAxisLeft: AxisSpec;
  yAxisRight?: AxisSpec;

  stack: StackMode;
  filters: FilterSpec[];
  sort?: SortSpec;
  limit?: LimitSpec;
  legend: LegendSpec;

  /** Theme token name, not raw colors, so dark mode and branding just work. */
  themeId: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type ChartValidationCode =
  | 'NO_X_COLUMN'
  | 'NO_SERIES'
  | 'NON_NUMERIC_Y'
  | 'TOO_MANY_POINTS'
  | 'TOO_MANY_CATEGORIES'
  | 'PIE_MULTIPLE_SERIES'
  | 'LOG_SCALE_NON_POSITIVE';

export interface ChartValidationIssue {
  severity: 'warning' | 'error';
  code: ChartValidationCode;
  /** Safe to show to the user. */
  message: string;
}

/* ===========================================================================
 * Errors and results (IPC-safe: Error objects don't survive serialization)
 * ======================================================================== */

export type AppErrorCode =
  | 'FILE_NOT_FOUND'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FORMAT'
  | 'CORRUPT_FILE'
  | 'PASSWORD_PROTECTED'
  | 'EMPTY_FILE'
  | 'PARSE_FAILED'
  | 'PERMISSION_DENIED'
  | 'UNKNOWN';

export interface AppError {
  code: AppErrorCode;
  /** Safe to show to the user. */
  message: string;
  /** For logs and support only. Never shown directly in the UI. */
  detail?: string;
}

export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/* ===========================================================================
 * Saved project (future "save session" feature, versioned from day one)
 * ======================================================================== */

export interface ColumnOverride {
  /** Column.name */
  name: string;
  displayName?: string;
  type?: ColumnType;
  format?: string;
  hidden?: boolean;
}

export interface ProjectFile {
  schemaVersion: 1;
  appVersion: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  /** Reference only. The data is re-read from disk, never embedded. */
  source: Pick<SourceInfo, 'fileName' | 'format' | 'contentHash'>;
  sheetName: string;
  columnOverrides: ColumnOverride[];
  charts: ChartSpec[];
}

export interface ElectronAPI {
  openFileDialog: () => Promise<{ name: string; bytes: Uint8Array } | null>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}