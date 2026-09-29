# API usage

```ts
import {
  CalculationInterval,
  EnergyTrackerClient,
  ExportColumn,
  SortDirection,
} from '@energy-tracker/api-client';

const client = new EnergyTrackerClient({
  accessToken: 'your-token',
  timeout: 10, // Seconds, including response body
  calculationTimeout: 60, // Calculations only
  // baseUrl: 'https://your-proxy.example/public-api',
});
```

All resource methods return promises. Each accepts an optional `signal` through
its final options object. Cancellation preserves the signal's reason. No retries
or redirects are performed automatically. Native `fetch` manages connection
pooling; there is no client-owned session to close. An optional `fetch` constructor
option accepts a compatible implementation, for example to configure a proxy.

## Devices

```ts
const devices = await client.devices.listStandard({
  name: 'Gas',
  folderPath: '/Basement',
  updatedAfter: new Date('2026-01-01T00:00:00Z'),
  updatedBefore: new Date('2026-09-01T00:00:00Z'),
});
const virtual = await client.devices.listVirtual(); // Same filters
```

Returns `DeviceSummaryDto[]`. `lastUpdatedAt` is a `Date` or `null`.

## Meter readings

These operations use API v3 for standard devices.

```ts
const readings = await client.meterReadings.list('device-id', {
  meterId: 'meter-id',
  from: new Date('2026-01-01T00:00:00Z'),
  to: new Date('2026-09-01T00:00:00Z'),
  sort: SortDirection.ASC, // Default: DESC
});
await client.meterReadings.create(
  'device-id',
  {
    value: '9999999999.999999',
    timestamp: new Date(), // Omit to use server time
    note: 'Manual reading',
  },
  { allowRounding: false },
);
await client.meterReadings.delete('device-id', new Date('2026-09-01T00:00:00Z'));
const csv = await client.meterReadings.export(
  'device-id',
  {
    columns: [ExportColumn.DATE, ExportColumn.VALUE],
    includeHeader: true,
    delimiter: 'comma', // Also semicolon, tab
    dateFormat: 'iso', // Also date_time, unix, unix_ms
  },
  { sort: SortDirection.ASC },
); // Same filters as list()
```

Reading values must be plain decimal strings, without an exponent. Formatting
removes redundant zeros without converting to a JavaScript number. Meter precision
and range checks belong to the server; `allowRounding` is sent only when supplied.
Never convert a precise decimal source to `Number` before passing it to the SDK.
Returned `MeterReadingDto.value` preserves the server's decimal string.

## Environments

```ts
const records = await client.environments.list('device-id');
const record = await client.environments.get('device-id', 'environment-id');
const created = await client.environments.create('device-id', { title: 'Temperature', unit: '°C' });
await client.environments.createEntry('device-id', created.id, {
  value: 21.5,
  timestamp: new Date(),
});
await client.environments.deleteEntry('device-id', created.id, new Date('2026-09-01T00:00:00Z'));
await client.environments.delete('device-id', created.id);
```

Environment values are finite JavaScript numbers. The API returns nested
`EnvironmentRecordDto.entries` with `Date` timestamps; optional units are `null`.

## Calculations

```ts
const daily = await client.calculations.dailyValues('device-id', {
  from: new Date('2026-09-01T00:00:00+02:00'),
  timeZone: 'Europe/Berlin',
});
const monthly = await client.calculations.extrapolations('device-id', {
  interval: CalculationInterval.MONTH,
  method: 'standard', // Default and currently the only method
  timeZone: 'Europe/Berlin',
});
```

Both accept optional `from`, `to` and `timeZone`; `from` is inclusive and `to`
exclusive. Dates are serialized with JavaScript's millisecond precision without
calendar rounding. The server applies interval boundaries, date-range limits and
the device's time zone when no override is given. Intervals are `day`, `week`,
`month`, `quarter`, and `year`.

Results are `CalculationPointDto[]` in server order, including terminal zero-duration
points. Durations are seconds; `expectedValue` is the full estimate, not an amount
to add to `actualValue`. Empty input history can produce an empty result. Tokens
need `read:daily-values` or `read:extrapolation`, respectively.

## Errors

All SDK errors extend `EnergyTrackerAPIError`. They expose `statusCode` (`null`
for local or transport failures) and `apiMessage` (the server's message array).

| HTTP status                                | Class                                                    |
| ------------------------------------------ | -------------------------------------------------------- |
| 400                                        | `ValidationError`                                        |
| 401                                        | `AuthenticationError`                                    |
| 403                                        | `ForbiddenError`                                         |
| 404                                        | `ResourceNotFoundError`                                  |
| 409                                        | `ConflictError`                                          |
| 429                                        | `RateLimitError`, with `retryAfter` in seconds or `null` |
| 503                                        | `ServiceUnavailableError`                                |
| Other unexpected status / invalid response | `EnergyTrackerAPIError`                                  |

`TimeoutError` represents a client timeout, `NetworkError` a transport failure.
Only each endpoint's exact success status is accepted. A caller-triggered abort
rejects with the original abort reason rather than an SDK error.
