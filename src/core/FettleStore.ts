import type { LoadableType } from "../adt/Loadable";
import type { FettleKey } from "../types";

export type SubscribeCallback = () => void;
export type UnsubscribeCallback = () => void;
export type CleanupCallback = () => void;

export interface StoreType {
  setCache<T>(key: FettleKey, value: LoadableType<T>): void;
  hasCache(key: FettleKey): boolean;
  getCache<T>(key: FettleKey): LoadableType<T> | undefined;
  delCache(key: FettleKey): void;

  setCleanup(key: FettleKey, callback: CleanupCallback): void;
  hasCleanup(key: FettleKey): boolean;
  getCleanup(key: FettleKey): CleanupCallback | undefined;

  dirty(key: FettleKey): void;
  dirtyClear(): void;
  getDownstreamKeys(): Set<FettleKey>;
  setDepkeys(key: FettleKey, newDepkeys: Set<FettleKey>): void;

  emit(key: FettleKey): void;
  subscribe(key: FettleKey, callback: SubscribeCallback): UnsubscribeCallback;
  unsubscribe(key: FettleKey, callback: SubscribeCallback): void;
}

namespace FettleStore {
  export function createStore(): StoreType {
    const cacheMap = new Map<FettleKey, LoadableType<any>>();
    const dirtyKeySet = new Set<FettleKey>();
    const depkeyMap = new Map<FettleKey, Set<FettleKey>>();
    const reverseDepkeyMap = new Map<FettleKey, Set<FettleKey>>();
    const cleanupMap = new Map<FettleKey, () => void>();
    const listerMap = new Map<FettleKey, SubscribeCallback[]>();

    function setCache<T>(key: FettleKey, value: LoadableType<T>) {
      cacheMap.set(key, value);
    }
    function hasCache<T>(key: FettleKey) {
      return cacheMap.has(key);
    }
    function getCache<T>(key: FettleKey) {
      return (cacheMap as Map<string, LoadableType<T>>).get(key);
    }
    function delCache(key: FettleKey) {
      cacheMap.delete(key);
    }

    function setCleanup(key: FettleKey, callback: CleanupCallback) {
      cleanupMap.set(key, callback);
    }
    function hasCleanup(key: FettleKey) {
      return cleanupMap.has(key);
    }
    function getCleanup(key: FettleKey) {
      return cleanupMap.get(key);
    }

    function dirty(key: FettleKey) {
      dirtyKeySet.add(key);
    }
    function dirtyClear() {
      dirtyKeySet.clear();
    }

    function getDownstreamKeys() {
      const keysSet = new Set<FettleKey>();
      dirtyKeySet.forEach((key) => {
        keysSet.add(key);
        const reverseDepkey = reverseDepkeyMap.get(key);
        if (reverseDepkey) {
          for (const rdk of reverseDepkey) {
            if (!keysSet.has(rdk)) {
              keysSet.add(rdk);
            }
          }
        }
      });
      return keysSet;
    }

    function differenceSets<T>(first: Set<T>, second: Set<T>) {
      const ret = new Set<T>();
      for (const value of first) {
        if (second.has(value)) {
          continue;
        }
        ret.add(value);
      }
      return ret;
    }

    function setDepkeys(key: FettleKey, newDepkeys: Set<FettleKey>) {
      const oldDepkeys = depkeyMap.get(key);
      depkeyMap.set(key, newDepkeys);
      const addedDeps =
        oldDepkeys == null
          ? newDepkeys
          : differenceSets(newDepkeys, oldDepkeys);

      for (const dep of addedDeps) {
        const subSet = reverseDepkeyMap.get(dep) ?? new Set<FettleKey>();
        subSet.add(key);
        reverseDepkeyMap.set(dep, subSet);
      }

      if (oldDepkeys) {
        const removedDeps = differenceSets(oldDepkeys, newDepkeys);
        for (const dep of removedDeps) {
          const subSet = reverseDepkeyMap.get(dep);
          if (!subSet) {
            return;
          }
          subSet.delete(key);
          if (!subSet.size) {
            reverseDepkeyMap.delete(dep);
          }
        }
      }
    }

    function emit(key: FettleKey) {
      const cbs = listerMap.get(key) ?? [];
      cbs.forEach((callback) => callback());
    }

    function subscribe(
      key: FettleKey,
      callback: SubscribeCallback
    ): UnsubscribeCallback {
      const cbs = listerMap.get(key) ?? [];
      cbs.push(callback);
      listerMap.set(key, cbs);
      return () => {
        unsubscribe(key, callback);
      };
    }

    function unsubscribe(key: FettleKey, callback: SubscribeCallback) {
      let callbacks = listerMap.get(key);
      if (!callbacks?.length) {
        return;
      }
      const idx = callbacks.findIndex((cb) => cb === callback);
      if (idx === -1) {
        return;
      }
      callbacks = [...callbacks.slice(0, idx), ...callbacks.slice(idx + 1)];
      if (callbacks.length) {
        listerMap.set(key, callbacks);
      } else {
        listerMap.delete(key);
      }
    }

    return {
      hasCache,
      delCache,
      setCache,
      getCache,

      setCleanup,
      hasCleanup,
      getCleanup,

      dirty,
      dirtyClear,
      getDownstreamKeys,
      setDepkeys,

      emit,
      subscribe,
      unsubscribe,
    };
  }
}

export default FettleStore;
