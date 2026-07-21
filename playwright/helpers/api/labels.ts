// Label API helpers for test cleanup. Fleet's cleanup projects don't wipe
// labels, so CRUD specs self-heal leftover test labels via these.
import { APIRequestContext } from '@playwright/test';
import { apiUrl, authHeaders } from './core';

/**
 * Delete every non-builtin label whose name contains `marker`. Substring
 * match so a renamed "<marker>…-edited" label is swept up alongside its
 * original. Safe to call when nothing matches.
 */
export async function deleteLabelsMatching(
  request: APIRequestContext,
  marker: string,
): Promise<void> {
  const res = await request.get(apiUrl('labels'), {
    headers: authHeaders(),
    params: { per_page: '500' },
  });
  if (!res.ok()) return;
  const body = await res.json();
  const labels = (body.labels ?? []) as Array<{ id: number; name: string; label_type?: string }>;
  await Promise.all(
    labels
      .filter((l) => l.label_type !== 'builtin' && l.name.includes(marker))
      .map((l) =>
        request
          .delete(apiUrl(`labels/id/${l.id}`), { headers: authHeaders() })
          .catch((err) => console.warn(`[deleteLabelsMatching] ${l.id}:`, err)),
      ),
  );
}
