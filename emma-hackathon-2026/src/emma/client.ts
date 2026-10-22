/**
 * Client factory: live REST mode when EMMA_API_KEY is set, deterministic
 * offline mock otherwise. This is the single switch between demo and reality.
 */

import type { EmmaClient } from '../types.js';
import { MockEmmaClient } from './mock.js';
import { EmmaRestClient } from './rest.js';

export const DEFAULT_BASE_URL = 'https://api.emma.ms/v1';

export function createClient(env: NodeJS.ProcessEnv = process.env): EmmaClient {
  const apiKey = env.EMMA_API_KEY;
  if (apiKey && apiKey.length > 0) {
    return new EmmaRestClient({
      baseUrl: env.EMMA_API_BASE_URL ?? DEFAULT_BASE_URL,
      apiKey,
    });
  }
  return new MockEmmaClient();
}
