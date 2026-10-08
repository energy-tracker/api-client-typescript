import { CalculationResource } from './resources/calculations.js';
import { DeviceResource } from './resources/devices.js';
import { EnvironmentResource } from './resources/environments.js';
import { MeterReadingResource } from './resources/meter-readings.js';
import { TokenResource } from './resources/token.js';
import { Transport } from './transport.js';
import type { ClientOptions } from './transport.js';

export class EnergyTrackerClient {
  readonly devices: DeviceResource;
  readonly meterReadings: MeterReadingResource;
  readonly environments: EnvironmentResource;
  readonly calculations: CalculationResource;
  readonly token: TokenResource;

  constructor(options: ClientOptions) {
    const transport = new Transport(options);
    this.devices = new DeviceResource(transport);
    this.meterReadings = new MeterReadingResource(transport);
    this.environments = new EnvironmentResource(transport);
    this.calculations = new CalculationResource(transport);
    this.token = new TokenResource(transport);
  }
}
