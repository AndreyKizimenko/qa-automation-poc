import { test, expect } from '@fixtures';
import type { APIRequestContext } from '@playwright/test';
import { authHeaders, apiUrl } from '@helpers/api';

// Premium-gated endpoints reject the request with HTTP 402 and a
// structured body that names the license requirement. Asserting on the
// message catches both "endpoint changed status" and "endpoint returned
// a generic error instead of the license-specific one" regressions.
const PREMIUM_LICENSE_MESSAGE = 'Requires Fleet Premium license';

interface EndpointCase {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: Record<string, unknown>;
}

const READ_ENDPOINTS: EndpointCase[] = [
  { method: 'GET', path: 'fleets' },
  { method: 'GET', path: 'setup_experience/script?team_id=0' },
  { method: 'GET', path: 'vpp_tokens' },
  { method: 'GET', path: 'abm_tokens' },
];

const MUTATION_ENDPOINTS: EndpointCase[] = [
  { method: 'POST', path: 'fleets', body: { name: 'free-tier-attempt' } },
  { method: 'POST', path: 'teams', body: { name: 'free-tier-attempt' } },
  { method: 'PATCH', path: 'fleets/1', body: { name: 'free-tier-attempt' } },
  { method: 'DELETE', path: 'fleets/1' },
];

async function callEndpoint(request: APIRequestContext, c: EndpointCase) {
  const url = apiUrl(c.path);
  const options = { headers: authHeaders(), data: c.body };
  switch (c.method) {
    case 'GET':    return request.get(url, options);
    case 'POST':   return request.post(url, options);
    case 'PATCH':  return request.patch(url, options);
    case 'DELETE': return request.delete(url, options);
  }
}

test.describe('Free • premium-gated endpoints', { tag: '@free' }, () => {
  for (const c of [...READ_ENDPOINTS, ...MUTATION_ENDPOINTS]) {
    test(`${c.method} /${c.path} → 402 + license-required message`, async ({ request }) => {
      const res = await callEndpoint(request, c);
      expect(res.status(), `${c.method} /${c.path} should reject free with 402`).toBe(402);
      const body = await res.json();
      expect(body.message).toBe(PREMIUM_LICENSE_MESSAGE);
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'base', reason: PREMIUM_LICENSE_MESSAGE }),
        ]),
      );
    });
  }
});
