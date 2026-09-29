# Energy Tracker API client

Typed, asynchronous client for the Energy Tracker public API. Supports Node.js 20+
with CommonJS and ES modules, without runtime dependencies.

```sh
npm install @energy-tracker/api-client
```

```ts
import { EnergyTrackerClient } from '@energy-tracker/api-client';

const client = new EnergyTrackerClient({ accessToken: process.env.ENERGY_TRACKER_TOKEN! });
const devices = await client.devices.listStandard();

await client.meterReadings.create('your-device-id', {
  value: '123.456789',
  timestamp: new Date(),
});
```

For CommonJS, use `const { EnergyTrackerClient } = require('@energy-tracker/api-client')`.
Meter-reading values are **decimal strings**, dates are `Date` objects, and CSV
exports return `Uint8Array`. The server handles calendar boundaries and rounding.

| Resource        | Methods                                                         |
| --------------- | --------------------------------------------------------------- |
| `devices`       | `listStandard`, `listVirtual`                                   |
| `meterReadings` | `list`, `create`, `delete`, `export`                            |
| `environments`  | `list`, `get`, `create`, `delete`, `createEntry`, `deleteEntry` |
| `calculations`  | `dailyValues`, `extrapolations`                                 |

See [API usage](https://github.com/energy-tracker/api-client-typescript/blob/main/docs/api.md) for options and errors.

## Development

```sh
npm ci
npm run check
```

`npm run test:contracts` runs the shared Python/TypeScript contract cases against a
local HTTP server. Their pinned source revision and checksums are recorded in
`contracts/source.json`; no live API or Python installation is needed.

Releases run automatically on matching `v*` tags after all checks pass. See
[release setup](https://github.com/energy-tracker/api-client-typescript/blob/main/docs/releasing.md) for the one-time npm configuration and commands.
