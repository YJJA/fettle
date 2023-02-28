import { isFunction, isPromiseLike } from "payload-is";

import Loadable from "../adt/Loadable.js";
import FettleError from "../adt/FettleError.js";
import FettleValue from "../adt/FettleValue.js";
import DefaultValue from "../adt/DefaultValue.js";
import WrappedValue from "../adt/WrappedValue.js";
import FettleNode from "../core/FettleNode.js";
import FettleCore from "../core/FettleCore.js";

import type { LoadableType, LoadingLoadable } from "../adt/Loadable";
import type { StoreType } from "../core/FettleStore";
import type {
  FettleValueType,
  ReadOnlyFettleValue,
  ReadWriteFettleValue,
} from "../adt/FettleValue";
import type { DefaultValueType } from "../adt/DefaultValue";
import type { NodeWrites } from "../core/FettleNode";
import type {
  FettleKey,
  GetFettleValue,
  RawValue,
  ResetFettleValue,
  SetFettleValue,
  ValueOrUpdater,
} from "../types";

type ExecutionID = number;

type DepValues = Map<FettleKey, LoadableType<any>>;

type ExecutionInfo<T> = {
  depValuesDiscoveredSoFarDuringAsyncWork: DepValues;
  loadingLoadable: LoadingLoadable<T>;
  executionID: ExecutionID;
};

const getNewExecutionID: () => ExecutionID = (() => {
  let executionID = 0;
  return () => executionID++;
})();

class Canceled {}
namespace Canceled {
  export const CANCELED = new Canceled();

  export function is(obj: unknown): obj is Canceled {
    return obj instanceof Canceled;
  }
}

interface ReadOnlySelectorOptions<T> {
  key: string;
  get: (opts: { get: GetFettleValue }) => RawValue<T>;
}

interface ReadWriteSelectorOptions<T> extends ReadOnlySelectorOptions<T> {
  set: (
    opts: { get: GetFettleValue; set: SetFettleValue; reset: ResetFettleValue },
    value: T | DefaultValueType
  ) => void;
}

export type SelectorOptions<T> =
  | ReadWriteSelectorOptions<T>
  | ReadOnlySelectorOptions<T>;

function selector<T>(
  options: ReadWriteSelectorOptions<T>
): ReadWriteFettleValue<T>;
function selector<T>(
  options: ReadOnlySelectorOptions<T>
): ReadOnlyFettleValue<T>;
function selector<T>(options: SelectorOptions<T>): FettleValueType<T> {
  const { key } = options;
  const executionInfoMap: Map<StoreType, ExecutionInfo<T>> = new Map();
  const discoveredDependencyKeys = new Set<FettleKey>();
  let fettleValue: FettleValueType<T>;

  let liveStoresCount = 0;
  function selectorIsLive() {
    return liveStoresCount > 0;
  }

  function getInProgressExecutionInfo(
    store: StoreType
  ): ExecutionInfo<T> | undefined {
    const pendingExecution = getExecutionInfo(store);
    if (!pendingExecution) {
      return pendingExecution;
    }

    function anyDepChanged(execDepValues: DepValues): boolean {
      for (const [depKey, execLoadable] of execDepValues) {
        if (!FettleCore.getNodeLoadable(store, depKey).equal(execLoadable)) {
          return true;
        }
      }
      return false;
    }

    if (
      !anyDepChanged(pendingExecution.depValuesDiscoveredSoFarDuringAsyncWork)
    ) {
      return pendingExecution;
    }
    return undefined;
  }

  function getExecutionInfo(store: StoreType) {
    return executionInfoMap.get(store);
  }

  function setExecutionInfo(
    store: StoreType,
    newExecutionID: ExecutionID,
    loadable: LoadingLoadable<T>,
    depValues: DepValues
  ) {
    executionInfoMap.set(store, {
      depValuesDiscoveredSoFarDuringAsyncWork: depValues,
      executionID: newExecutionID,
      loadingLoadable: loadable,
    });
  }

  function updateExecutionInfoDepValues(
    store: StoreType,
    executionID: ExecutionID,
    depValues: DepValues
  ) {
    if (isLatestExecution(store, executionID)) {
      const executionInfo = getExecutionInfo(store);
      if (executionInfo) {
        executionInfo.depValuesDiscoveredSoFarDuringAsyncWork = depValues;
      }
    }
  }

  function clearExecutionInfo(store: StoreType) {
    executionInfoMap.delete(store);
  }

  function isLatestExecution(
    store: StoreType,
    executionID?: ExecutionID
  ): boolean {
    return executionID === getExecutionInfo(store)?.executionID;
  }

  function updateDeps(
    store: StoreType,
    depKeys: Set<FettleKey>,
    executionID?: ExecutionID
  ): void {
    store.setDepkeys(key, depKeys);
    for (const key of depKeys) {
      discoveredDependencyKeys.add(key);
    }
  }

  let localDepList: Array<[FettleKey, any]> = [];
  let localLoadable: LoadableType<T> | undefined;
  function depValuesToDepList(depValues: DepValues): Array<[FettleKey, any]> {
    return Array.from(depValues.entries()).map(([depKey, valLoadable]) => [
      depKey,
      valLoadable.contents,
    ]);
  }
  function setLocalCache(depValues: DepValues, loadable: LoadableType<T>) {
    localDepList = depValuesToDepList(depValues);
    localLoadable = loadable;
  }
  function getLocalCache(store: StoreType) {
    for (const [depKey, value] of localDepList) {
      if (value !== FettleCore.getNodeLoadable<T>(store, depKey).contents) {
        return undefined;
      }
    }
    return localLoadable;
  }
  function clearLocalCache() {
    localDepList = [];
    localLoadable = undefined;
  }

  function init(_store: StoreType) {
    liveStoresCount++;
    return () => {
      liveStoresCount--;
    };
  }

  function resolveAsync(
    store: StoreType,
    loadable: LoadableType<T>,
    depValues: DepValues,
    executionID: ExecutionID
  ) {
    setLocalCache(depValues, loadable);
    if (isLatestExecution(store, executionID)) {
      clearExecutionInfo(store);
    }
    FettleCore.markStateModified(store, fettleValue);
  }

  function wrapPendingDependencyPromise(
    store: StoreType,
    promise: PromiseLike<T>,
    existingDeps: DepValues,
    executionID: ExecutionID
  ) {
    return promise.then(
      () => {
        if (!selectorIsLive()) {
          clearExecutionInfo(store);
          throw Canceled.CANCELED;
        }

        if (!isLatestExecution(store, executionID)) {
          const executionInfo = getInProgressExecutionInfo(store);
          if (executionInfo) {
            return executionInfo.loadingLoadable.contents;
          }
        }
        const [loadable, depValues] = evaluateSelectorGetter(
          store,
          executionID
        );

        if (loadable.state !== "loading") {
          resolveAsync(store, loadable, depValues, executionID);
        }

        if (loadable.state === "hasError") {
          throw loadable.contents;
        }
        return loadable.contents;
      },
      (error) => {
        if (Canceled.is(error)) {
          throw error;
        }

        if (!selectorIsLive()) {
          clearExecutionInfo(store);
          throw Canceled.CANCELED;
        }

        const loadable = Loadable.withError<T>(error);
        resolveAsync(store, loadable, existingDeps, executionID);
        throw error;
      }
    );
  }

  function wrapResultPromise(
    store: StoreType,
    promise: PromiseLike<T>,
    depValues: DepValues,
    executionID: ExecutionID
  ) {
    return promise.then(
      (value) => {
        if (!selectorIsLive()) {
          clearExecutionInfo(store);
          throw Canceled.CANCELED;
        }

        const loadable = Loadable.withValue(value);
        resolveAsync(store, loadable, depValues, executionID);
        return value;
      },
      (errorOrPromise) => {
        if (!selectorIsLive()) {
          clearExecutionInfo(store);
          throw Canceled.CANCELED;
        }

        if (isPromiseLike(errorOrPromise)) {
          return wrapPendingDependencyPromise(
            store,
            errorOrPromise,
            depValues,
            executionID
          );
        }

        const loadable = Loadable.withError<T>(errorOrPromise);
        resolveAsync(store, loadable, depValues, executionID);
        throw errorOrPromise;
      }
    );
  }

  function evaluateSelectorGetter(
    store: StoreType,
    executionID: ExecutionID
  ): [LoadableType<T>, DepValues] {
    let duringSynchronousExecution = true;
    let loadable: LoadableType<T>;
    const depValues: DepValues = new Map();

    function getDepValue<T>({ key: depKey }: FettleValueType<T>) {
      const depLoadable = FettleCore.getNodeLoadable<T>(store, depKey);

      depValues.set(depKey, depLoadable);

      if (!duringSynchronousExecution) {
        updateDeps(store, new Set(depValues.keys()), executionID);
      }

      switch (depLoadable.state) {
        case "hasValue":
          return depLoadable.contents;
        case "hasError":
          throw depLoadable.contents;
        case "loading":
          throw depLoadable.contents;
      }
      throw FettleError.err("Invalid Loadable state");
    }

    try {
      const rawValue = options.get({ get: getDepValue });
      const value = FettleValue.isFettleValue(rawValue)
        ? getDepValue(rawValue)
        : rawValue;
      loadable = Loadable.isLoadable(value)
        ? value
        : WrappedValue.isWrappedValue(value)
        ? Loadable.withValue(WrappedValue.unwrap(value))
        : Loadable.of(value);

      if (loadable.state === "loading") {
        loadable = Loadable.withPromise(
          wrapResultPromise(store, loadable.contents, depValues, executionID)
        );
      }
    } catch (errorOrPromise) {
      loadable = isPromiseLike(errorOrPromise)
        ? Loadable.withPromise(
            wrapPendingDependencyPromise(
              store,
              errorOrPromise,
              depValues,
              executionID
            )
          )
        : Loadable.withError(errorOrPromise);
    }

    duringSynchronousExecution = false;
    updateExecutionInfoDepValues(store, executionID, depValues);
    updateDeps(store, new Set(depValues.keys()), executionID);

    return [loadable, depValues];
  }

  function getLoadableFromCacheAndUpdateDeps(store: StoreType) {
    let cacheLoadable = store.getCache<T>(key);
    if (cacheLoadable) {
      return cacheLoadable;
    }

    cacheLoadable = getLocalCache(store);
    if (cacheLoadable) {
      store.setCache(key, cacheLoadable);
    }

    return cacheLoadable;
  }

  function invalidate(store: StoreType) {
    store.delCache(key);
  }

  function clearCache(store: StoreType) {
    for (const depKey of discoveredDependencyKeys) {
      const node = FettleNode.getNode(depKey);
      node.clearCache?.(store);
    }
    discoveredDependencyKeys.clear();
    invalidate(store);
    clearLocalCache();
    FettleCore.markStateModified(store, fettleValue);
  }

  function get(store: StoreType) {
    const cacheLoadable = getLoadableFromCacheAndUpdateDeps(store);
    if (cacheLoadable) {
      clearExecutionInfo(store);
      return cacheLoadable;
    }

    const inProgressExecutionInfo = getInProgressExecutionInfo(store);
    if (inProgressExecutionInfo) {
      return inProgressExecutionInfo.loadingLoadable;
    }

    const newExecutionID = getNewExecutionID();
    const [loadable, newDepValues] = evaluateSelectorGetter(
      store,
      newExecutionID
    );

    if (loadable.state === "loading") {
      setExecutionInfo(store, newExecutionID, loadable, newDepValues);
    } else {
      clearExecutionInfo(store);
      store.setCache(key, loadable);
    }
    return loadable;
  }

  if ("set" in options) {
    const optionsSet = options.set;
    const set = (store: StoreType, newValue: T | DefaultValueType) => {
      const writes: NodeWrites = new Map();

      function getDepValue<T>({ key: depKey }: FettleValueType<T>) {
        const depLoadable = FettleCore.getNodeLoadable<T>(store, depKey);

        switch (depLoadable.state) {
          case "hasValue":
            return depLoadable.contents;
          case "hasError":
            throw depLoadable.contents;
          case "loading":
            throw depLoadable.contents;
        }

        throw FettleError.err("Invalid Loadable state");
      }

      function setDepValue<T>(
        depState: FettleValueType<T>,
        valueOrUpdater: ValueOrUpdater<T>
      ) {
        const depKey = depState.key;
        const value = isFunction(valueOrUpdater)
          ? valueOrUpdater(getDepValue(depState))
          : valueOrUpdater;
        const upstreamWrites = FettleCore.setNodeValue(store, depKey, value);
        upstreamWrites.forEach((v, k) => writes.set(k, v));
      }

      function resetDepValue<T>(depState: FettleValueType<T>) {
        setDepValue(depState, DefaultValue.DEFAULT_VALUE);
      }

      optionsSet(
        { get: getDepValue, set: setDepValue, reset: resetDepValue },
        newValue
      );

      return writes;
    };

    fettleValue = FettleNode.registerNode({
      key,
      type: "selector",
      init,
      get,
      set,
      invalidate,
      clearCache,
    });
  } else {
    fettleValue = FettleNode.registerNode({
      key,
      type: "selector",
      init,
      get,
      invalidate,
      clearCache,
    });
  }

  return fettleValue;
}

namespace selector {
  export const value = WrappedValue.wrap;
}

export default selector;
