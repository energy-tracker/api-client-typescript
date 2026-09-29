export interface ApiErrorOptions extends ErrorOptions {
  statusCode?: number | null;
  apiMessage?: readonly string[];
}

/** Base error; local validation and transport failures have no HTTP status. */
export class EnergyTrackerAPIError extends Error {
  readonly statusCode: number | null;
  readonly apiMessage: readonly string[];

  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message, options);
    this.name = new.target.name;
    this.statusCode = options.statusCode ?? null;
    this.apiMessage = [...(options.apiMessage ?? [])];
  }
}

export class ValidationError extends EnergyTrackerAPIError {}
export class AuthenticationError extends EnergyTrackerAPIError {}
export class ForbiddenError extends EnergyTrackerAPIError {}
export class ResourceNotFoundError extends EnergyTrackerAPIError {}
export class ConflictError extends EnergyTrackerAPIError {}
export class ServiceUnavailableError extends EnergyTrackerAPIError {}
export class NetworkError extends EnergyTrackerAPIError {}
export class TimeoutError extends EnergyTrackerAPIError {}

export class RateLimitError extends EnergyTrackerAPIError {
  readonly retryAfter: number | null;
  constructor(message: string, options: ApiErrorOptions & { retryAfter?: number | null } = {}) {
    super(message, options);
    this.retryAfter = options.retryAfter ?? null;
  }
}
