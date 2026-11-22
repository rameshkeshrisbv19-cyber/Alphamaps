/**
 * Network helpers shared by search, routing and reverse geocoding:
 *  - requestJson(): fetch with timeout, offline detection and friendly error kinds
 *  - createThrottle(): serialises calls to respect provider usage policies
 *  - createCache(): small in-memory LRU-ish cache with a TTL
 */

export type ApiErrorKind = 'offline' | 'network' | 'ratelimit' | 'noroute' | 'service' | 'badrequest';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

export function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}

interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

/** GET/POST JSON with a timeout. Throws ApiError with a user-friendly message. */
export async function requestJson<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = 15000, signal, ...init } = options;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ApiError('offline', "You're offline. Check your connection and try again.");
  }

  // Combine the caller's signal (user cancelled / superseded) with our timeout.
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  const forwardAbort = () => controller.abort();
  signal?.addEventListener('abort', forwardAbort);

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (res.status === 429) {
      throw new ApiError(
        'ratelimit',
        'The service is busy (rate limit reached). Please wait a moment and try again.',
        429,
      );
    }
    if (res.status >= 500) {
      throw new ApiError('service', `The service is temporarily unavailable (HTTP ${res.status}).`, res.status);
    }
    if (!res.ok) {
      throw new ApiError('badrequest', `The request was rejected (HTTP ${res.status}).`, res.status);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (signal?.aborted) throw err; // caller cancelled — they will ignore it
    if (controller.signal.aborted) {
      throw new ApiError('network', 'The request timed out. Check your connection and try again.');
    }
    throw new ApiError('network', "Couldn't reach the server. Check your internet connection.");
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }
}

/**
 * Serialises calls so that at most one starts every `minIntervalMs`.
 * Used to honour the Nominatim / Photon usage policy (≈1 request per second).
 */
export function createThrottle(minIntervalMs: number) {
  let last = 0;
  let queue: Promise<unknown> = Promise.resolve();

  return function run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    const exec = async (): Promise<T> => {
      const wait = last + minIntervalMs - Date.now();
      if (wait > 0) await new Promise((resolve) => window.setTimeout(resolve, wait));
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      last = Date.now();
      return task();
    };
    const next = queue.then(exec, exec);
    queue = next.catch(() => undefined);
    return next;
  };
}

/** Tiny in-memory cache. Evicts the oldest entry when full; entries expire after `ttlMs`. */
export function createCache<V>(maxEntries = 150, ttlMs = 10 * 60_000) {
  const store = new Map<string, { value: V; at: number }>();
  return {
    get(key: string): V | undefined {
      const hit = store.get(key);
      if (!hit) return undefined;
      if (Date.now() - hit.at > ttlMs) {
        store.delete(key);
        return undefined;
      }
      return hit.value;
    },
    set(key: string, value: V): void {
      if (store.size >= maxEntries) {
        const oldest = store.keys().next().value;
        if (oldest !== undefined) store.delete(oldest);
      }
      store.set(key, { value, at: Date.now() });
    },
  };
}
