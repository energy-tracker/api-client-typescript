import { calculation, list } from '../decoders.js';
import { ValidationError } from '../errors.js';
import { CalculationInterval, ExtrapolationMethod } from '../models.js';
import type { CalculationPointDto, CalculationQuery, ExtrapolationQuery } from '../models.js';
import { segment, timestamp } from '../serialization.js';
import type { Transport } from '../transport.js';

export class CalculationResource {
  constructor(private readonly transport: Transport) {}

  /** Requires read:daily-values. Calendar normalization is performed by the server. */
  async dailyValues(
    deviceId: string,
    options: CalculationQuery = {},
  ): Promise<CalculationPointDto[]> {
    return this.calculate(deviceId, 'daily-values', options);
  }
  /** Requires read:extrapolation. expectedValue is the full interval estimate. */
  async extrapolations(
    deviceId: string,
    options: ExtrapolationQuery,
  ): Promise<CalculationPointDto[]> {
    const method = options.method ?? ExtrapolationMethod.STANDARD;
    if (
      !Object.values(CalculationInterval).includes(options.interval) ||
      method !== ExtrapolationMethod.STANDARD
    ) {
      throw new ValidationError('Unsupported calculation interval or extrapolation method');
    }
    return this.calculate(deviceId, `extrapolations/${method}/${options.interval}`, options);
  }
  private calculate(
    deviceId: string,
    suffix: string,
    options: CalculationQuery,
  ): Promise<CalculationPointDto[]> {
    const query: Record<string, string> = {};
    if (options.from != null) query.from = timestamp(options.from);
    if (options.to != null) query.to = timestamp(options.to);
    if (options.timeZone != null) query.timeZone = options.timeZone;
    return this.transport.request(
      {
        method: 'GET',
        path: `/v1/devices/standard/${segment(deviceId)}/${suffix}`,
        status: 200,
        query,
        calculation: true,
        signal: options.signal,
      },
      list(calculation),
    );
  }
}
