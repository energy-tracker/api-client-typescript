import { tokenStatus } from '../decoders.js';
import type { RequestOptions, TokenStatusDto } from '../models.js';
import type { Transport } from '../transport.js';

export class TokenResource {
  constructor(private readonly transport: Transport) {}

  /** Needs no scope and changes no data. Limited to 5 requests per 5 minutes; do not poll. */
  async status(options: RequestOptions = {}): Promise<TokenStatusDto> {
    return this.transport.request(
      { method: 'GET', path: '/v1/token/status', status: 200, signal: options.signal },
      tokenStatus,
    );
  }
}
