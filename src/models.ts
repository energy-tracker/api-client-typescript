export const SortDirection = { ASC: 'asc', DESC: 'desc' } as const;
export type SortDirection = (typeof SortDirection)[keyof typeof SortDirection];
export const CsvDelimiter = { COMMA: 'comma', SEMICOLON: 'semicolon', TAB: 'tab' } as const;
export type CsvDelimiter = (typeof CsvDelimiter)[keyof typeof CsvDelimiter];
export const DateFormat = {
  ISO: 'iso',
  DATE_TIME: 'date_time',
  UNIX: 'unix',
  UNIX_MS: 'unix_ms',
} as const;
export type DateFormat = (typeof DateFormat)[keyof typeof DateFormat];
export const ExportColumn = {
  DATE: 'date',
  VALUE: 'value',
  NOTE: 'note',
  METER_ID: 'meter_id',
  METER_NUMBER: 'meter_number',
} as const;
export type ExportColumn = (typeof ExportColumn)[keyof typeof ExportColumn];
export const CalculationInterval = {
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
  QUARTER: 'quarter',
  YEAR: 'year',
} as const;
export type CalculationInterval = (typeof CalculationInterval)[keyof typeof CalculationInterval];
export const ExtrapolationMethod = { STANDARD: 'standard' } as const;
export type ExtrapolationMethod = (typeof ExtrapolationMethod)[keyof typeof ExtrapolationMethod];

export interface DeviceSummaryDto {
  readonly id: string;
  readonly name: string;
  readonly folderPath: string;
  readonly lastUpdatedAt: Date | null;
}
export interface MeterReadingDto {
  readonly timestamp: Date;
  /** Decimal string; never converted through a JavaScript number. */
  readonly value: string;
  readonly rolloverOffset: number;
  readonly meterId: string;
  readonly note: string | null;
  readonly meterNumber: string | null;
}
export interface CreateMeterReadingDto {
  /** Plain decimal string without exponent, e.g. "123.456789". */
  value: string;
  timestamp?: Date | null;
  note?: string | null;
}
export interface TimestampDto {
  timestamp: Date;
}
export interface ExportMeterReadingsDto {
  columns: readonly ExportColumn[];
  includeHeader?: boolean;
  /** Defaults to semicolon; comma and tab can be selected explicitly. */
  delimiter?: CsvDelimiter;
  dateFormat?: DateFormat;
}
export interface EnvironmentEntryDto {
  readonly timestamp: Date;
  readonly value: number;
}
export interface EnvironmentRecordDto {
  readonly id: string;
  readonly title: string;
  readonly unit: string | null;
  readonly entries: readonly EnvironmentEntryDto[];
}
export interface CreateEnvironmentRecordDto {
  title: string;
  unit?: string | null;
}
export interface CreateEnvironmentEntryDto {
  value: number;
  timestamp?: Date | null;
}
export interface CalculationPointDto {
  readonly date: Date;
  readonly actualValue: number;
  /** Seconds backed by readings; may reflect daylight-saving changes. */
  readonly actualDuration: number;
  /** Estimated interval total; do not add actualValue. */
  readonly expectedValue: number;
  readonly expectedDuration: number;
}

export interface RequestOptions {
  signal?: AbortSignal;
}
export interface DeviceQuery extends RequestOptions {
  name?: string;
  folderPath?: string;
  updatedAfter?: Date;
  updatedBefore?: Date;
}
export interface MeterReadingQuery extends RequestOptions {
  meterId?: string;
  from?: Date;
  to?: Date;
  sort?: SortDirection;
}
export interface CreateMeterReadingOptions extends RequestOptions {
  allowRounding?: boolean;
}
export interface CalculationQuery extends RequestOptions {
  from?: Date;
  to?: Date;
  timeZone?: string;
}
export interface ExtrapolationQuery extends CalculationQuery {
  interval: CalculationInterval;
  method?: ExtrapolationMethod;
}
