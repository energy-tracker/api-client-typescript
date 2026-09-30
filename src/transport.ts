import {
  AuthenticationError,
  ConflictError,
  EnergyTrackerAPIError,
  ForbiddenError,
  NetworkError,
  RateLimitError,
  ResourceNotFoundError,
  ServiceUnavailableError,
  TimeoutError,
  ValidationError,
} from './errors.js';

export interface ClientOptions {
  accessToken: string;
  baseUrl?: string;
  /** Total request timeout in seconds, including response body; default 10. */
  timeout?: number;
  /** Separate calculation timeout in seconds; default 60. */
  calculationTimeout?: number;
  /** Optional fetch implementation, e.g. for a proxy or custom dispatcher. */
  fetch?: typeof globalThis.fetch;
}
interface Request {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  status: 200 | 201 | 204;
  query?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal | undefined;
  calculation?: boolean;
  bytes?: boolean;
}

function timeout(value: number): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value * 1000 > 2_147_483_647
  ) {
    throw new ValidationError(
      'Timeout must be a positive, finite number of seconds within the timer range',
    );
  }
  return value * 1000;
}
function messages(data: unknown): string[] {
  if (!data || typeof data !== 'object') return [];
  const value = (data as Record<string, unknown>).message;
  if (typeof value === 'string') return [value];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}
function httpError(
  response: Response,
  data: unknown,
  expected: number,
  cause?: unknown,
): EnergyTrackerAPIError {
  const options = { statusCode: response.status, apiMessage: messages(data), cause };
  switch (response.status) {
    case 400:
      return new ValidationError('Bad Request', options);
    case 401:
      return new AuthenticationError('Unauthorized: check your access token', options);
    case 403:
      return new ForbiddenError('Forbidden: insufficient permissions', options);
    case 404:
      return new ResourceNotFoundError('Not Found', options);
    case 409:
      return new ConflictError('Conflict', options);
    case 429: {
      const header = response.headers.get('retry-after');
      const seconds = header !== null && /^\d+$/.test(header) ? Number(header) : NaN;
      return new RateLimitError('Too Many Requests', {
        ...options,
        retryAfter: Number.isSafeInteger(seconds) ? seconds : null,
      });
    }
    case 503:
      return new ServiceUnavailableError('Service Unavailable', options);
    default:
      return new EnergyTrackerAPIError(
        `Unexpected HTTP status: ${response.status} (expected ${expected})`,
        options,
      );
  }
}

/** Internal HTTP implementation shared by all resources. */
export class Transport {
  readonly #baseUrl: string;
  readonly #accessToken: string;
  readonly #timeout: number;
  readonly #calculationTimeout: number;
  readonly #fetch: typeof globalThis.fetch;

  constructor(options: ClientOptions) {
    this.#timeout = timeout(options.timeout ?? 10);
    this.#calculationTimeout = timeout(options.calculationTimeout ?? 60);
    let url: URL;
    try {
      url = new URL(options.baseUrl ?? 'https://public-api.energy-tracker.best-ios-apps.de');
    } catch (cause) {
      throw new ValidationError('Base URL must be a valid HTTP(S) URL', { cause });
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new ValidationError(
        'Base URL must be an HTTP(S) URL without credentials, query or fragment',
      );
    }
    this.#baseUrl = url.href.replace(/\/+$/, '');
    this.#accessToken = options.accessToken;
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  async request<T>(request: Request, decode: (value: unknown) => T): Promise<T> {
    request.signal?.throwIfAborted();
    const url = new URL(this.#baseUrl + request.path);
    for (const [key, value] of Object.entries(request.query ?? {}))
      url.searchParams.set(key, value);
    const controller = new AbortController();
    const timeoutError = new TimeoutError('Request timed out');
    const abort = () => controller.abort(request.signal?.reason);
    request.signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(
      () => controller.abort(timeoutError),
      request.calculation ? this.#calculationTimeout : this.#timeout,
    );
    try {
      const headers: Record<string, string> = { Authorization: `Bearer ${this.#accessToken}` };
      const init: RequestInit = {
        method: request.method,
        headers,
        redirect: 'manual',
        signal: controller.signal,
      };
      if (request.body !== undefined) {
        headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(request.body);
      }
      const response = await this.#fetch(url, init);
      if (response.status !== request.status) {
        let data: unknown;
        try {
          data = JSON.parse(await response.text());
        } catch (cause) {
          // Keep the known HTTP error when its body is invalid or interrupted.
          throw httpError(response, undefined, request.status, cause);
        }
        throw httpError(response, data, request.status);
      }
      if (response.status === 204) {
        await response.body?.cancel();
        return decode(undefined);
      }
      if (request.bytes) return decode(new Uint8Array(await response.arrayBuffer()));
      const text = await response.text();
      try {
        const contentType = response.headers
          .get('content-type')
          ?.split(';', 1)[0]
          ?.trim()
          .toLowerCase();
        if (contentType !== 'application/json' && !contentType?.endsWith('+json'))
          throw new TypeError('Expected JSON content type');
        const data: unknown = JSON.parse(text);
        if (data === null || typeof data !== 'object')
          throw new TypeError('Expected JSON object or array');
        return decode(data);
      } catch (cause) {
        throw new EnergyTrackerAPIError('Invalid API response', {
          statusCode: response.status,
          cause,
        });
      }
    } catch (cause) {
      if (request.signal?.aborted) throw request.signal.reason;
      if (cause instanceof EnergyTrackerAPIError) throw cause;
      if (controller.signal.reason === timeoutError) throw timeoutError;
      throw new NetworkError('Request failed', { cause });
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener('abort', abort);
    }
  }
}
