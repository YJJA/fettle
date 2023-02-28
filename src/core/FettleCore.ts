import { isFunction } from "payload-is";
import FettleError from "../adt/FettleError.js";
import DefaultValue from "../adt/DefaultValue.js";
import FettleNode from "./FettleNode.js";

import type { DefaultValueType } from "../adt/DefaultValue";
import type { FettleValueType, ReadWriteFettleValue } from "../adt/FettleValue";
import type { LoadableType } from "../adt/Loadable";
import type { StoreType } from "./FettleStore";
import type { FettleKey, ValueOrUpdater } from "../types";

type Action<T> =
  | {
      type: "setValue";
      fettleValue: ReadWriteFettleValue<T>;
      valueOrUpdater: ValueOrUpdater<T>;
    }
  | {
      type: "setLoadable";
      fettleValue: ReadWriteFettleValue<T>;
      loadable: LoadableType<T>;
    }
  | {
      type: "markModified";
      fettleValue: FettleValueType<T>;
    };

namespace FettleCore {
  function initializeToStore<T>(store: StoreType, key: FettleKey) {
    if (store.hasCleanup(key)) {
      return;
    }
    const node = FettleNode.getNode<T>(key);
    const cleanup = node.init(store);
    store.setCleanup(key, cleanup);
  }

  export function setNodeValue<T>(
    store: StoreType,
    key: FettleKey,
    newValue: T | DefaultValueType
  ) {
    const node = FettleNode.getNode<T>(key);
    if (!("set" in node)) {
      throw FettleError.readOnly(
        `Attempt to set read-only FettleState: ${key}`
      );
    }
    initializeToStore(store, key);
    return node.set(store, newValue);
  }

  export function getNodeLoadable<T>(
    store: StoreType,
    key: FettleKey
  ): LoadableType<T> {
    const node = FettleNode.getNode<T>(key);
    initializeToStore(store, key);
    return node.get(store);
  }

  export function getStateLoadable<T>(store: StoreType, key: FettleKey) {
    const loadable = getNodeLoadable<T>(store, key);

    if (loadable.state === "loading") {
      loadable.contents.catch(() => {
        return;
      });
    }

    return loadable;
  }

  export function setStateValue<T>(
    store: StoreType,
    fettleValue: ReadWriteFettleValue<T>,
    valueOrUpdater: ValueOrUpdater<T>
  ) {
    queueOrPerformStateUpdate(store, {
      type: "setValue",
      fettleValue,
      valueOrUpdater,
    });
  }

  export function setStateLoadable<T>(
    store: StoreType,
    fettleValue: ReadWriteFettleValue<T>,
    loadable: LoadableType<T>
  ) {
    queueOrPerformStateUpdate(store, {
      type: "setLoadable",
      fettleValue,
      loadable,
    });
  }

  export function markStateModified<T>(
    store: StoreType,
    fettleValue: FettleValueType<T>
  ) {
    queueOrPerformStateUpdate(store, {
      type: "markModified",
      fettleValue,
    });
  }

  export function refreshFettleState<T>(
    store: StoreType,
    { key }: FettleValueType<T>
  ) {
    FettleNode.getNode<T>(key).clearCache?.(store);
  }

  function invalidate(store: StoreType): void {
    const keys = store.getDownstreamKeys();
    for (const key of keys) {
      FettleNode.getNodeMaybe(key)?.invalidate?.(store);
    }
  }

  function notify(store: StoreType) {
    const keys = store.getDownstreamKeys();
    for (const dirtyKey of keys) {
      store.emit(dirtyKey);
    }
  }

  const batchStack: Map<StoreType, Action<any>[]>[] = [];

  export function batch(callback: () => void) {
    const actionsByStore = new Map<StoreType, Action<any>[]>();
    batchStack.push(actionsByStore);
    callback();
    for (const [store, actions] of actionsByStore) {
      applyActionsToStore(store, actions);
    }
    batchStack.pop();
  }

  function writeLoadableToStore<T>(
    store: StoreType,
    key: FettleKey,
    loadable: LoadableType<T>
  ) {
    if (
      loadable.state === "hasValue" &&
      DefaultValue.isDefaultValue(loadable.contents)
    ) {
      store.delCache(key);
    } else {
      store.setCache(key, loadable);
    }
    store.dirty(key);
  }

  function valueFromValueOrUpdater<T>(
    store: StoreType,
    { key }: ReadWriteFettleValue<T>,
    valueOrUpdater: ValueOrUpdater<T>
  ): T | DefaultValueType {
    if (isFunction(valueOrUpdater)) {
      const current = getNodeLoadable<T>(store, key);
      if (current.state === "loading") {
        const msg = `Tried to set atom or selector "${key}" using an updater function while the current state is pending, this is not currently supported.`;
        throw FettleError.err(msg);
      } else if (current.state === "hasError") {
        throw current.contents;
      }
      return valueOrUpdater(current.contents);
    } else {
      return valueOrUpdater;
    }
  }

  function applyAction<T>(store: StoreType, action: Action<T>) {
    if (action.type === "setValue") {
      const { fettleValue, valueOrUpdater } = action;
      const newValue = valueFromValueOrUpdater(
        store,
        fettleValue,
        valueOrUpdater
      );
      const writes = setNodeValue<T>(store, fettleValue.key, newValue);
      for (const [key, loadable] of writes) {
        writeLoadableToStore(store, key, loadable);
      }
    } else if (action.type === "setLoadable") {
      const { fettleValue, loadable } = action;
      writeLoadableToStore(store, fettleValue.key, loadable);
    } else if (action.type === "markModified") {
      const { fettleValue } = action;
      store.dirty(fettleValue.key);
    }
  }

  function applyActionsToStore<T>(store: StoreType, actions: Action<T>[]) {
    for (const action of actions) {
      applyAction(store, action);
    }

    invalidate(store);
    notify(store);
    store.dirtyClear();
  }

  function queueOrPerformStateUpdate<T>(store: StoreType, action: Action<T>) {
    if (batchStack.length) {
      const actionsByStore = batchStack[batchStack.length - 1];
      const actions = actionsByStore.get(store) ?? [];
      actions.push(action);
      actionsByStore.set(store, actions);
    } else {
      applyActionsToStore(store, [action]);
    }
  }
}

export default FettleCore;
