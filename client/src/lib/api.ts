export class ApiError extends Error {
  constructor(public status: number, message: string, public fields?: Record<string, string[]>) { super(message); }
}

async function raw(path: string, init: RequestInit) {
  return fetch(`/api${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init });
}

// These must never trigger a silent refresh (they are how you get a session in the first place).
const NO_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout', '/auth/forgot-password', '/auth/reset-password', '/auth/verify-email'];

// One refresh at a time: when several requests fail together they share a single refresh.
let inflight: Promise<boolean> | null = null;
export function refreshSession(): Promise<boolean> {
  if (!inflight) {
    inflight = raw('/auth/refresh', { method: 'POST' }).then((r) => r.ok).catch(() => false).finally(() => { setTimeout(() => { inflight = null; }, 0); });
  }
  return inflight;
}

/** JSON fetch with one automatic silent refresh on 401. */
export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const init: RequestInit = { method: opts.method ?? 'GET', body: opts.body ? JSON.stringify(opts.body) : undefined };
  let res = await raw(path, init);
  if (res.status === 401 && !NO_REFRESH.includes(path) && (await refreshSession())) res = await raw(path, init);
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error?.message ?? 'Something went wrong. Please try again.', data?.error?.fields);
  return data as T;
}

/** Multipart upload (browser sets the boundary header itself). Retries once after a silent refresh. */
export async function upload<T = unknown>(path: string, form: FormData): Promise<T> {
  const send = () => fetch(`/api${path}`, { method: 'POST', body: form, credentials: 'include' });
  let res = await send();
  if (res.status === 401 && (await refreshSession())) res = await send();
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error?.message ?? 'Upload failed.', data?.error?.fields);
  return data as T;
}
