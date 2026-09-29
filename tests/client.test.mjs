import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import * as api from '../dist/index.mjs';
import { readBody, serve } from './helpers.mjs';

const client = (options = {}) =>
  new api.EnergyTrackerClient({ accessToken: 'test-token', ...options });

test('CommonJS and ESM share class identities', () => {
  const cjs = createRequire(import.meta.url)('../dist/cjs/index.js');
  for (const name of Object.keys(api)) assert.equal(api[name], cjs[name]);
});
for (const name of ['timeout', 'calculationTimeout']) {
  for (const value of [0, -1, NaN, Infinity, true, '60', 2_147_484]) {
    test(`${name} rejects ${String(value)}`, () =>
      assert.throws(() => client({ [name]: value }), api.ValidationError));
  }
}
for (const url of [
  'not-a-url',
  'file:///tmp/test',
  'https://user:pass@example.com',
  'https://example.com/?token=x',
  'https://example.com/#fragment',
]) {
  test(`reject unsafe base URL ${url}`, () =>
    assert.throws(() => client({ baseUrl: url }), api.ValidationError));
}
for (const value of [123.45, NaN, Infinity, 'NaN', 'Infinity', '', '1e3']) {
  test(`reject lossy or invalid decimal input ${String(value)}`, async () => {
    let requests = 0;
    await assert.rejects(
      () =>
        client({
          fetch: async () => {
            requests++;
          },
        }).meterReadings.create('device', { value }),
      api.ValidationError,
    );
    assert.equal(requests, 0);
  });
}
for (const [value, expected] of [
  ['-0.000', '0'],
  ['000123.4500', '123.45'],
  ['9999999999.999999', '9999999999.999999'],
  ['-12.3400', '-12.34'],
]) {
  test(`decimal normalization ${value}`, async (t) => {
    let actual;
    const baseUrl = await serve(t, async (req, res) => {
      actual = JSON.parse(await readBody(req));
      res.writeHead(204).end();
    });
    await client({ baseUrl }).meterReadings.create('device', { value });
    assert.deepEqual(actual, { value: expected });
  });
}
test('IDs cannot change the endpoint path', async (t) => {
  let path;
  const baseUrl = await serve(t, (req, res) => {
    path = req.url;
    res.writeHead(200, { 'Content-Type': 'application/json' }).end('[]');
  });
  await client({ baseUrl }).meterReadings.list('a/b?#');
  assert.equal(path, '/v3/devices/standard/a%2Fb%3F%23/meter-readings');
  for (const id of ['', '.', '..'])
    await assert.rejects(() => client().meterReadings.list(id), api.ValidationError);
});
test('invalid Dates and nonfinite environment values fail locally', async () => {
  await assert.rejects(
    () => client().calculations.dailyValues('device', { from: new Date(NaN) }),
    api.ValidationError,
  );
  await assert.rejects(
    () => client().calculations.extrapolations('device', { interval: 'decade' }),
    api.ValidationError,
  );
  for (const value of [NaN, Infinity, true]) {
    await assert.rejects(
      () => client().environments.createEntry('device', 'environment', { value }),
      api.ValidationError,
    );
  }
});
test('network errors retain cause without HTTP status', async () => {
  const cause = new TypeError('Connection failed');
  await assert.rejects(
    () =>
      client({
        fetch: async () => {
          throw cause;
        },
      }).devices.listStandard(),
    (error) => {
      assert.ok(error instanceof api.NetworkError);
      assert.equal(error.statusCode, null);
      assert.equal(error.cause, cause);
      return true;
    },
  );
});
for (const status of [200, 429, 503]) {
  test(`timeout covers streaming HTTP ${status} body and does not retry`, async (t) => {
    let requests = 0;
    const baseUrl = await serve(t, (req, res) => {
      requests++;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.write('[');
    });
    await assert.rejects(
      () => client({ baseUrl, timeout: 0.2 }).devices.listStandard(),
      (error) => {
        assert.ok(error instanceof api.TimeoutError);
        assert.equal(error.statusCode, null);
        return true;
      },
    );
    assert.equal(requests, 1);
  });
}
test('calculations use their own timeout', async (t) => {
  const baseUrl = await serve(t, async (req, res) => {
    await delay(100);
    res.writeHead(200, { 'Content-Type': 'application/json' }).end('[]');
  });
  const apiClient = client({ baseUrl, timeout: 0.02, calculationTimeout: 2 });
  await assert.rejects(() => apiClient.devices.listStandard(), api.TimeoutError);
  assert.deepEqual(await apiClient.calculations.dailyValues('device'), []);
  assert.deepEqual(
    await apiClient.calculations.extrapolations('device', { interval: 'month' }),
    [],
  );
});
for (const status of [200, 503]) {
  test(`caller cancellation is preserved for HTTP ${status} and before requests`, async (t) => {
    const controller = new AbortController();
    const reason = new Error('Caller cancelled');
    const baseUrl = await serve(t, (req, res) => {
      res.writeHead(status);
      res.write('[');
    });
    const apiClient = client({
      baseUrl,
      fetch: async (...args) => {
        const response = await fetch(...args);
        setImmediate(() => controller.abort(reason));
        return response;
      },
    });
    await assert.rejects(
      () => apiClient.devices.listStandard({ signal: controller.signal }),
      (error) => error === reason,
    );
    let calls = 0;
    await assert.rejects(
      () =>
        client({
          fetch: async () => {
            calls++;
          },
        }).devices.listVirtual({ signal: controller.signal }),
      (error) => error === reason,
    );
    assert.equal(calls, 0);
  });
}

for (const [status, ErrorType] of [
  [400, api.ValidationError],
  [401, api.AuthenticationError],
  [403, api.ForbiddenError],
  [404, api.ResourceNotFoundError],
  [409, api.ConflictError],
  [429, api.RateLimitError],
  [503, api.ServiceUnavailableError],
  [500, api.EnergyTrackerAPIError],
  [201, api.EnergyTrackerAPIError],
]) {
  test(`HTTP ${status} survives a failed response body`, async () => {
    const cause = new Error('Response stream disconnected');
    const response = new Response(
      new ReadableStream({
        start(stream) {
          stream.error(cause);
        },
      }),
      {
        status,
        headers: { 'Retry-After': '20' },
      },
    );
    await assert.rejects(
      () => client({ fetch: async () => response }).devices.listStandard(),
      (error) => {
        assert.equal(error.constructor, ErrorType);
        assert.equal(error.statusCode, status);
        assert.equal(error.cause, cause);
        assert.deepEqual(error.apiMessage, []);
        if (status === 429) assert.equal(error.retryAfter, 20);
        return true;
      },
    );
  });
}

test('invalid message entries cannot mask HTTP status or retry-after', async (t) => {
  const baseUrl = await serve(t, (req, res) =>
    res
      .writeHead(429, {
        'Content-Type': 'application/json',
        'Retry-After': '20',
      })
      .end(
        JSON.stringify({
          message: ['Rate limited', { toString: null }, null, 42, false, ['nested']],
        }),
      ),
  );
  await assert.rejects(
    () => client({ baseUrl }).devices.listStandard(),
    (error) => {
      assert.ok(error instanceof api.RateLimitError);
      assert.equal(error.statusCode, 429);
      assert.equal(error.retryAfter, 20);
      assert.deepEqual(error.apiMessage, ['Rate limited']);
      return true;
    },
  );
});

test('an interrupted success body remains a network error', async () => {
  const cause = new Error('Response stream disconnected');
  const response = new Response(
    new ReadableStream({
      start(stream) {
        stream.error(cause);
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
  await assert.rejects(
    () => client({ fetch: async () => response }).devices.listStandard(),
    (error) => {
      assert.ok(error instanceof api.NetworkError);
      assert.equal(error.statusCode, null);
      assert.equal(error.cause, cause);
      return true;
    },
  );
});

test('a truncated HTTP error from the server keeps its status', async (t) => {
  const baseUrl = await serve(t, (req, res) => {
    res.writeHead(503, { 'Content-Type': 'application/json', 'Content-Length': '1000' });
    res.write('{"message":');
    setTimeout(() => res.destroy(), 20);
  });
  await assert.rejects(
    () => client({ baseUrl }).devices.listStandard(),
    (error) => {
      assert.ok(error instanceof api.ServiceUnavailableError);
      assert.equal(error.statusCode, 503);
      assert.ok(error.cause instanceof Error);
      return true;
    },
  );
});
const point = {
  date: '2026-09-01T00:00:00Z',
  actualValue: 1,
  actualDuration: 2,
  expectedValue: 3,
  expectedDuration: 4,
};
for (const body of [
  {},
  [null],
  [{ ...point, date: 'invalid' }],
  [{ ...point, date: '2026-09-01' }],
  [{ ...point, actualValue: true }],
  [{ ...point, expectedDuration: -1 }],
  [{ ...point, actualDuration: '2' }],
  [{ date: point.date }],
]) {
  test(`malformed calculation response ${JSON.stringify(body)}`, async (t) => {
    const baseUrl = await serve(t, (req, res) =>
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(body)),
    );
    await assert.rejects(
      () => client({ baseUrl }).calculations.dailyValues('device'),
      (error) => {
        assert.equal(error.constructor, api.EnergyTrackerAPIError);
        assert.equal(error.statusCode, 200);
        assert.ok(error.cause instanceof TypeError);
        return true;
      },
    );
  });
}
test('meter-reading response must preserve a decimal string', async (t) => {
  const baseUrl = await serve(t, (req, res) =>
    res
      .writeHead(200, { 'Content-Type': 'application/json' })
      .end(
        JSON.stringify([
          { timestamp: point.date, value: 123.45, rolloverOffset: 0, meterId: 'meter' },
        ]),
      ),
  );
  await assert.rejects(
    () => client({ baseUrl }).meterReadings.list('device'),
    api.EnergyTrackerAPIError,
  );
});
test('CSV error responses still expose API messages', async (t) => {
  const baseUrl = await serve(t, (req, res) =>
    res
      .writeHead(400, { 'Content-Type': 'text/plain' })
      .end(JSON.stringify({ message: ['Invalid columns'] })),
  );
  await assert.rejects(
    () => client({ baseUrl }).meterReadings.export('device', { columns: ['value'] }),
    (error) => {
      assert.ok(error instanceof api.ValidationError);
      assert.deepEqual(error.apiMessage, ['Invalid columns']);
      return true;
    },
  );
});
