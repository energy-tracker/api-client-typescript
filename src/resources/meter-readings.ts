import { list, reading } from '../decoders.js';
import { CsvDelimiter, DateFormat, SortDirection } from '../models.js';
import type {
  CreateMeterReadingDto,
  CreateMeterReadingOptions,
  ExportMeterReadingsDto,
  MeterReadingDto,
  MeterReadingQuery,
  RequestOptions,
} from '../models.js';
import { decimal, segment, timestamp } from '../serialization.js';
import type { Transport } from '../transport.js';

function path(deviceId: string): string {
  return `/v3/devices/standard/${segment(deviceId)}/meter-readings`;
}
function query(options: MeterReadingQuery): Record<string, string> {
  const result: Record<string, string> = {};
  if (options.meterId != null) result.meterId = options.meterId;
  if (options.from != null) result.from = timestamp(options.from);
  if (options.to != null) result.to = timestamp(options.to);
  if (options.sort != null && options.sort !== SortDirection.DESC) result.sort = options.sort;
  return result;
}
export class MeterReadingResource {
  constructor(private readonly transport: Transport) {}

  async list(deviceId: string, options: MeterReadingQuery = {}): Promise<MeterReadingDto[]> {
    return this.transport.request(
      {
        method: 'GET',
        path: path(deviceId),
        status: 200,
        query: query(options),
        signal: options.signal,
      },
      list(reading),
    );
  }
  async create(
    deviceId: string,
    value: CreateMeterReadingDto,
    options: CreateMeterReadingOptions = {},
  ): Promise<void> {
    const body: Record<string, unknown> = { value: decimal(value.value) };
    if (value.timestamp != null) body.timestamp = timestamp(value.timestamp);
    if (value.note != null) body.note = value.note;
    const params: Record<string, string> = {};
    if (options.allowRounding != null) params.allowRounding = String(options.allowRounding);
    await this.transport.request(
      {
        method: 'POST',
        path: path(deviceId),
        status: 204,
        body,
        query: params,
        signal: options.signal,
      },
      () => undefined,
    );
  }
  async delete(deviceId: string, date: Date, options: RequestOptions = {}): Promise<void> {
    await this.transport.request(
      {
        method: 'DELETE',
        path: path(deviceId),
        status: 204,
        body: { timestamp: timestamp(date) },
        signal: options.signal,
      },
      () => undefined,
    );
  }
  async export(
    deviceId: string,
    config: ExportMeterReadingsDto,
    options: MeterReadingQuery = {},
  ): Promise<Uint8Array> {
    const body = {
      columns: [...config.columns],
      includeHeader: config.includeHeader ?? true,
      delimiter: config.delimiter ?? CsvDelimiter.COMMA,
      dateFormat: config.dateFormat ?? DateFormat.ISO,
    };
    return this.transport.request(
      {
        method: 'POST',
        path: path(deviceId) + '/export',
        status: 200,
        body,
        query: query(options),
        bytes: true,
        signal: options.signal,
      },
      (value) => value as Uint8Array,
    );
  }
}
