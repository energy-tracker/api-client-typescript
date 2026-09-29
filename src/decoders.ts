import type {
  CalculationPointDto,
  DeviceSummaryDto,
  EnvironmentRecordDto,
  MeterReadingDto,
} from './models.js';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('Expected object');
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('Expected string');
  return value;
}
function optionalString(value: unknown): string | null {
  return value == null ? null : string(value);
}
function number(value: unknown, duration = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || (duration && value < 0)) {
    throw new TypeError('Expected finite number' + (duration ? ' >= 0' : ''));
  }
  return value;
}
function date(value: unknown): Date {
  const text = string(value);
  const result = new Date(text);
  if (
    !text.includes('T') ||
    !/(?:Z|[+-]\d{2}:\d{2})$/.test(text) ||
    !Number.isFinite(result.getTime())
  ) {
    throw new TypeError('Expected an ISO timestamp with a UTC offset');
  }
  return result;
}
export function list<T>(decode: (value: unknown) => T): (value: unknown) => T[] {
  return (value) => {
    if (!Array.isArray(value)) throw new TypeError('Expected array');
    return value.map(decode);
  };
}
export function device(value: unknown): DeviceSummaryDto {
  const data = object(value);
  return {
    id: string(data.id),
    name: string(data.name),
    folderPath: string(data.folderPath),
    lastUpdatedAt: data.lastUpdatedAt == null ? null : date(data.lastUpdatedAt),
  };
}
export function reading(value: unknown): MeterReadingDto {
  const data = object(value);
  const decimal = string(data.value);
  if (!/^-?\d+(?:\.\d+)?$/.test(decimal)) throw new TypeError('Expected decimal string');
  return {
    timestamp: date(data.timestamp),
    value: decimal,
    rolloverOffset: number(data.rolloverOffset),
    meterId: string(data.meterId),
    note: optionalString(data.note),
    meterNumber: optionalString(data.meterNumber),
  };
}
export function environment(value: unknown): EnvironmentRecordDto {
  const data = object(value);
  return {
    id: string(data.id),
    title: string(data.title),
    unit: optionalString(data.unit),
    entries: list((entry: unknown) => {
      const item = object(entry);
      return { timestamp: date(item.timestamp), value: number(item.value) };
    })(data.entries),
  };
}
export function calculation(value: unknown): CalculationPointDto {
  const data = object(value);
  return {
    date: date(data.date),
    actualValue: number(data.actualValue),
    actualDuration: number(data.actualDuration, true),
    expectedValue: number(data.expectedValue),
    expectedDuration: number(data.expectedDuration, true),
  };
}
