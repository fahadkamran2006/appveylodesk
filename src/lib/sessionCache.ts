// Simple module-level session cache.
// Pages seed their state from this cache so navigating back renders instantly,
// then refresh silently in the background (stale-while-revalidate).
const cache = new Map<string, unknown>();

export function getCache<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function setCache<T>(key: string, value: T): void {
  cache.set(key, value);
}

export function clearCache(prefix?: string): void {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}
