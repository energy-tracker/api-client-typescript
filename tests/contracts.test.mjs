import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import * as api from '../dist/index.mjs';
import { readBody, serve } from './helpers.mjs';

const root = new URL('../contracts/', import.meta.url);
const schema = JSON.parse(await readFile(new URL('schema.json', root), 'utf8'));
const ajv = new Ajv({ strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);
const cases = [];
for (const filename of (await readdir(new URL('cases/', root))).sort()) {
  const suite = JSON.parse(await readFile(new URL(`cases/${filename}`, root), 'utf8'));
  assert.ok(validate(suite), JSON.stringify(validate.errors));
  cases.push(...suite.cases);
}
assert.equal(new Set(cases.map((item) => item.id)).size, cases.length);
const dates = new Set([
  'timestamp',
  'date',
  'lastUpdatedAt',
  'from',
  'to',
  'updatedAfter',
  'updatedBefore',
]);
function inputs(value, key) {
  if (dates.has(key) && typeof value === 'string') return new Date(value);
  if (Array.isArray(value)) return value.map((item) => inputs(item));
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, inputs(item, key)]));
  return value;
}
function normalize(value, key) {
  if (value instanceof Uint8Array) return { base64: Buffer.from(value).toString('base64') };
  if (value instanceof Date) return value.toISOString();
  if (dates.has(key) && typeof value === 'string') return new Date(value).toISOString();
  if (Array.isArray(value)) return value.map((item) => normalize(item));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalize(item, key)]),
    );
  return value ?? null;
}
function body(value) {
  if ('json' in value) return Buffer.from(JSON.stringify(value.json));
  if ('base64' in value) return Buffer.from(value.base64, 'base64');
  return Buffer.from(value.text ?? '');
}
const operations = {
  'devices.listStandard': (c, i) => c.devices.listStandard(i),
  'devices.listVirtual': (c, i) => c.devices.listVirtual(i),
  'meterReadings.list': (c, { deviceId, ...i }) => c.meterReadings.list(deviceId, i),
  'meterReadings.create': (c, { deviceId, reading, ...i }) =>
    c.meterReadings.create(deviceId, reading, i),
  'meterReadings.delete': (c, i) => c.meterReadings.delete(i.deviceId, i.timestamp),
  'meterReadings.export': (c, { deviceId, config, ...i }) =>
    c.meterReadings.export(deviceId, config, i),
  'environments.list': (c, i) => c.environments.list(i.deviceId),
  'environments.get': (c, i) => c.environments.get(i.deviceId, i.environmentId),
  'environments.create': (c, i) => c.environments.create(i.deviceId, i.record),
  'environments.delete': (c, i) => c.environments.delete(i.deviceId, i.environmentId),
  'environments.createEntry': (c, i) =>
    c.environments.createEntry(i.deviceId, i.environmentId, i.entry),
  'environments.deleteEntry': (c, i) =>
    c.environments.deleteEntry(i.deviceId, i.environmentId, i.timestamp),
  'calculations.dailyValues': (c, { deviceId, ...i }) => c.calculations.dailyValues(deviceId, i),
  'calculations.extrapolations': (c, { deviceId, ...i }) =>
    c.calculations.extrapolations(deviceId, i),
};
const errors = {
  validation: api.ValidationError,
  authentication: api.AuthenticationError,
  forbidden: api.ForbiddenError,
  notFound: api.ResourceNotFoundError,
  conflict: api.ConflictError,
  rateLimit: api.RateLimitError,
  unavailable: api.ServiceUnavailableError,
  api: api.EnergyTrackerAPIError,
};
assert.deepEqual(new Set(cases.map((item) => item.operation)), new Set(Object.keys(operations)));

for (const item of cases) {
  test(item.id, async (t) => {
    const requests = [];
    const url = await serve(t, async (request, response) => {
      requests.push({
        method: request.method,
        url: new URL(request.url, 'http://localhost'),
        headers: request.headers,
        body: await readBody(request),
      });
      response.writeHead(item.response.status, item.response.headers).end(body(item.response.body));
    });
    const client = new api.EnergyTrackerClient({
      accessToken: 'contract-test-token',
      baseUrl: url + '/public-api/',
    });
    const call = () => operations[item.operation](client, inputs(item.input));
    if ('error' in item.expected) {
      const expected = item.expected.error;
      await assert.rejects(call, (error) => {
        assert.equal(error.constructor, errors[expected.kind]);
        assert.equal(error.statusCode, expected.status);
        assert.deepEqual(error.apiMessage, expected.messages);
        if ('retryAfter' in expected) assert.equal(error.retryAfter, expected.retryAfter);
        return true;
      });
    } else {
      assert.deepEqual(normalize(await call()), normalize(item.expected.result));
    }
    assert.equal(requests.length, 1, 'No retries or redirects');
    const request = requests[0];
    assert.equal(request.method, item.request.method);
    assert.equal(request.url.pathname, '/public-api' + item.request.path);
    assert.equal([...request.url.searchParams].length, Object.keys(item.request.query).length);
    assert.deepEqual(
      normalize(Object.fromEntries(request.url.searchParams)),
      normalize(item.request.query),
    );
    for (const [key, value] of Object.entries(item.request.headers))
      assert.equal(request.headers[key.toLowerCase()], value);
    if ('json' in item.request.body)
      assert.deepEqual(normalize(JSON.parse(request.body)), normalize(item.request.body.json));
    else assert.deepEqual(request.body, body(item.request.body));
  });
}

test('all operations have success and wrong-status coverage', () => {
  for (const operation of Object.keys(operations)) {
    const subset = cases.filter((item) => item.operation === operation);
    assert.ok(subset.some((item) => 'result' in item.expected));
    assert.ok(subset.some((item) => item.id.endsWith('-wrong-status')));
  }
});

test('vendored contracts match the recorded source snapshot', async () => {
  const source = JSON.parse(await readFile(new URL('source.json', root), 'utf8'));
  assert.match(source.commit, /^[a-f0-9]{40}$/);
  assert.deepEqual(
    Object.keys(source.sha256)
      .filter((name) => name.startsWith('cases/'))
      .sort(),
    (await readdir(new URL('cases/', root))).map((name) => `cases/${name}`).sort(),
  );
  for (const [name, expected] of Object.entries(source.sha256)) {
    assert.equal(
      createHash('sha256')
        .update(await readFile(new URL(name, root)))
        .digest('hex'),
      expected,
      name,
    );
  }
});
