const MAX_CACHE_BYTES = 12 * 1024 * 1024;
const MAX_CACHED_IMAGE_BYTES = 1024 * 1024;
const MAX_CACHE_ITEMS = 24;
const CACHE_TTL_MS = 120_000;

const cache = new Map<string, { bytes: Uint8Array; expiresAt: number }>();
const inFlight = new Map<string, Promise<Uint8Array>>();
let cacheBytes = 0;

function remove(key: string) {
  const entry = cache.get(key);
  if (entry) {
    cacheBytes -= entry.bytes.byteLength;
    cache.delete(key);
  }
}

function cached(key: string): Uint8Array | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    remove(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, entry);
  return entry.bytes;
}

function store(key: string, bytes: Uint8Array) {
  if (bytes.byteLength > MAX_CACHED_IMAGE_BYTES) return;
  remove(key);
  while (cache.size >= MAX_CACHE_ITEMS || cacheBytes + bytes.byteLength > MAX_CACHE_BYTES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) return;
    remove(oldest);
  }
  cache.set(key, { bytes, expiresAt: Date.now() + CACHE_TTL_MS });
  cacheBytes += bytes.byteLength;
}

export async function getOrCreateOptimizedImage(
  key: string,
  create: () => Promise<Uint8Array>,
): Promise<Uint8Array> {
  const existing = cached(key);
  if (existing) return existing;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const work = create().then((bytes) => {
    store(key, bytes);
    return bytes;
  }).finally(() => inFlight.delete(key));
  inFlight.set(key, work);
  return work;
}
