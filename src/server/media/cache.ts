const MAX_CACHE_BYTES = 12 * 1024 * 1024;
const MAX_CACHED_IMAGE_BYTES = 1024 * 1024;
const MAX_CACHE_ITEMS = 24;
const CACHE_TTL_MS = 120_000;
const MAX_CONCURRENT_PROCESSING = 2;
const MAX_QUEUED_PROCESSING = 24;

const cache = new Map<string, { bytes: Uint8Array; expiresAt: number }>();
const inFlight = new Map<string, Promise<Uint8Array>>();
const processingQueue: Array<() => void> = [];
let cacheBytes = 0;
let activeProcessing = 0;

function schedule<T>(create: () => Promise<T>): Promise<T> {
  if (activeProcessing >= MAX_CONCURRENT_PROCESSING && processingQueue.length >= MAX_QUEUED_PROCESSING) {
    return Promise.reject(new Error('Image processing capacity exceeded'));
  }
  return new Promise((resolve, reject) => {
    const start = () => {
      activeProcessing += 1;
      Promise.resolve().then(create).then(resolve, reject).finally(() => {
        activeProcessing -= 1;
        processingQueue.shift()?.();
      });
    };
    if (activeProcessing < MAX_CONCURRENT_PROCESSING) start();
    else processingQueue.push(start);
  });
}

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
  const work = schedule(create).then((bytes) => {
    store(key, bytes);
    return bytes;
  }).finally(() => inFlight.delete(key));
  inFlight.set(key, work);
  return work;
}
