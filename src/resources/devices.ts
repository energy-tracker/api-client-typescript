import { device, list } from '../decoders.js';
import type { DeviceQuery, DeviceSummaryDto } from '../models.js';
import { timestamp } from '../serialization.js';
import type { Transport } from '../transport.js';

export class DeviceResource {
  constructor(private readonly transport: Transport) {}

  async listStandard(options: DeviceQuery = {}): Promise<DeviceSummaryDto[]> {
    return this.list('standard', options);
  }
  async listVirtual(options: DeviceQuery = {}): Promise<DeviceSummaryDto[]> {
    return this.list('virtual', options);
  }
  private list(kind: 'standard' | 'virtual', options: DeviceQuery): Promise<DeviceSummaryDto[]> {
    const query: Record<string, string> = {};
    if (options.name != null) query.name = options.name;
    if (options.folderPath != null) query.folderPath = options.folderPath;
    if (options.updatedAfter != null) query.updatedAfter = timestamp(options.updatedAfter);
    if (options.updatedBefore != null) query.updatedBefore = timestamp(options.updatedBefore);
    return this.transport.request(
      { method: 'GET', path: `/v1/devices/${kind}`, status: 200, query, signal: options.signal },
      list(device),
    );
  }
}
