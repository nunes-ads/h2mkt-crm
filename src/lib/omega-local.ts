import { useCallback, useMemo, useRef, useSyncExternalStore, type SetStateAction } from "react";

/** Prototype settings only. No credentials, live contact history or access enforcement. */
export function useLocalDemo<T>(key: string, initial: T) {
  const initialRef = useRef(initial);
  initialRef.current = initial;
  const store = useMemo(() => {
    const fallback = initialRef.current;
    let value = fallback;
    let raw: string | null = null;
    let memoryOnly = false;
    const read = () => {
      if (typeof window === "undefined" || memoryOnly) return value;
      try {
        const next = localStorage.getItem(key);
        if (next !== raw) {
          raw = next;
          try {
            value = next === null ? fallback : (JSON.parse(next) as T);
          } catch {
            value = fallback;
          }
        }
      } catch {
        memoryOnly = true;
      }
      return value;
    };
    const notify = () => window.dispatchEvent(new CustomEvent("omega-demo", { detail: key }));
    const persist = () => {
      try {
        raw = JSON.stringify(value);
        localStorage.setItem(key, raw);
        memoryOnly = false;
        notify();
        return true;
      } catch {
        memoryOnly = true;
        notify();
        return false;
      }
    };
    return {
      read,
      server: () => fallback,
      write: (next: SetStateAction<T>) => {
        const previous = read();
        value = typeof next === "function" ? (next as (previous: T) => T)(previous) : next;
        persist();
      },
      save: () => {
        read();
        return persist();
      },
      subscribe: (listener: () => void) => {
        const sync = (event: Event) => {
          if (
            event instanceof CustomEvent
              ? event.detail === key
              : event instanceof StorageEvent && (event.key === key || event.key === null)
          )
            listener();
        };
        window.addEventListener("omega-demo", sync);
        window.addEventListener("storage", sync);
        return () => {
          window.removeEventListener("omega-demo", sync);
          window.removeEventListener("storage", sync);
        };
      },
    };
  }, [key]);
  const value = useSyncExternalStore(store.subscribe, store.read, store.server);
  return [value, store.write, store.save] as const;
}

const runtime = new Map<string, unknown>();
const listeners = new Set<() => void>();
/** Temporary UI cache; the provider/database remains the source of truth. */
export function useRuntimeState<T>(key: string, initial: T) {
  const read = useCallback(() => (runtime.get(key) as T | undefined) ?? initial, [key, initial]);
  const subscribe = useCallback((listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  const value = useSyncExternalStore(subscribe, read, () => initial);
  const set = useCallback(
    (next: SetStateAction<T>) => {
      runtime.set(key, typeof next === "function" ? (next as (old: T) => T)(read()) : next);
      listeners.forEach((listener) => listener());
    },
    [key, read],
  );
  return [value, set, () => false] as const;
}
export function clearRuntimeState() {
  runtime.clear();
  listeners.forEach((listener) => listener());
}
