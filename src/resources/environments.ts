import { environment, list } from '../decoders.js';
import type {
  CreateEnvironmentEntryDto,
  CreateEnvironmentRecordDto,
  EnvironmentRecordDto,
  RequestOptions,
} from '../models.js';
import { finiteValue, segment, timestamp } from '../serialization.js';
import type { Transport } from '../transport.js';

function path(deviceId: string, environmentId?: string): string {
  const base = `/v1/devices/standard/${segment(deviceId)}/environments`;
  return environmentId === undefined ? base : `${base}/${segment(environmentId)}`;
}
export class EnvironmentResource {
  constructor(private readonly transport: Transport) {}
  async list(deviceId: string, options: RequestOptions = {}): Promise<EnvironmentRecordDto[]> {
    return this.transport.request(
      { method: 'GET', path: path(deviceId), status: 200, signal: options.signal },
      list(environment),
    );
  }
  async get(
    deviceId: string,
    environmentId: string,
    options: RequestOptions = {},
  ): Promise<EnvironmentRecordDto> {
    return this.transport.request(
      { method: 'GET', path: path(deviceId, environmentId), status: 200, signal: options.signal },
      environment,
    );
  }
  async create(
    deviceId: string,
    record: CreateEnvironmentRecordDto,
    options: RequestOptions = {},
  ): Promise<EnvironmentRecordDto> {
    const body: Record<string, unknown> = { title: record.title };
    if (record.unit != null) body.unit = record.unit;
    return this.transport.request(
      { method: 'POST', path: path(deviceId), status: 201, body, signal: options.signal },
      environment,
    );
  }
  async delete(
    deviceId: string,
    environmentId: string,
    options: RequestOptions = {},
  ): Promise<void> {
    await this.transport.request(
      {
        method: 'DELETE',
        path: path(deviceId, environmentId),
        status: 204,
        signal: options.signal,
      },
      () => undefined,
    );
  }
  async createEntry(
    deviceId: string,
    environmentId: string,
    entry: CreateEnvironmentEntryDto,
    options: RequestOptions = {},
  ): Promise<void> {
    const body: Record<string, unknown> = { value: finiteValue(entry.value) };
    if (entry.timestamp != null) body.timestamp = timestamp(entry.timestamp);
    await this.transport.request(
      {
        method: 'POST',
        path: path(deviceId, environmentId),
        status: 204,
        body,
        signal: options.signal,
      },
      () => undefined,
    );
  }
  async deleteEntry(
    deviceId: string,
    environmentId: string,
    date: Date,
    options: RequestOptions = {},
  ): Promise<void> {
    await this.transport.request(
      {
        method: 'DELETE',
        path: path(deviceId, environmentId) + '/entries',
        status: 204,
        body: { timestamp: timestamp(date) },
        signal: options.signal,
      },
      () => undefined,
    );
  }
}
