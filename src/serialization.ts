import { ValidationError } from './errors.js';

export function timestamp(value: Date): string {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new ValidationError('Timestamp must be a valid Date');
  }
  return value.toISOString();
}

export function decimal(value: string): string {
  if (typeof value !== 'string' || !/^-?\d+(?:\.\d+)?$/.test(value)) {
    throw new ValidationError('Meter reading value must be a plain decimal string');
  }
  const [integer = '', fraction = ''] = value.split('.');
  const negative = integer.startsWith('-');
  const digits = integer.replace(/^-/, '').replace(/^0+(?=\d)/, '');
  const trimmed = fraction.replace(/0+$/, '');
  const normalized = trimmed ? `${digits}.${trimmed}` : digits;
  return negative && normalized !== '0' ? `-${normalized}` : normalized;
}

export function finiteValue(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ValidationError('Environment value must be a finite number');
  }
  return value;
}

export function segment(id: string): string {
  if (typeof id !== 'string' || !id || id === '.' || id === '..') {
    throw new ValidationError('Resource ID must be a nonempty path segment');
  }
  return encodeURIComponent(id);
}
