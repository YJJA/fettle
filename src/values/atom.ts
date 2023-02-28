import { isPromiseLike } from "payload-is";

import Loadable from "../adt/Loadable.js";
import DefaultValue from "../adt/DefaultValue.js";
import FettleValue from "../adt/FettleValue.js";
import WrappedValue from "../adt/WrappedValue.js";
import FettleNode from "../core/FettleNode.js";
import FettleCore from "../core/FettleCore.js";
import selector from "./selector.js";

import type { FettleValueType, ReadWriteFettleValue } from "../adt/FettleValue";
import type { LoadableType } from "../adt/Loadable";
import type { DefaultValueType } from "../adt/DefaultValue";
import type { NodeWrites } from "../core/FettleNode";
import type { StoreType } from "../core/FettleStore";
import type { FettleKey, RawValue } from "../types";

type AtomWithFallbackOptions<T> = {
  key: FettleKey;
  default: FettleValueType<T>;
};

function atomWithFallback<T>(options: AtomWithFallbackOptions<T>) {
  const base = atom<T | DefaultValueType>({
    key: options.key,
    default: DefaultValue.DEFAULT_VALUE,
  });

  return selector({
    key: `${options.key}__withFallback`,
    get: ({ get }) => {
      const baseValue = get(base);
      return DefaultValue.isDefaultValue(baseValue)
        ? options.default
        : baseValue;
    },
    set: ({ set }, valOrUpdater) => {
      set(base, valOrUpdater);
    },
  });
}

interface AtomOptionsWithoutDefault<T> {
  key: FettleKey;
}

interface AtomOptionsWithDefault<T> extends AtomOptionsWithoutDefault<T> {
  default: RawValue<T>;
}

export type AtomOptions<T> =
  | AtomOptionsWithoutDefault<T>
  | AtomOptionsWithDefault<T>;

function atom<T>(options: AtomOptionsWithDefault<T>): ReadWriteFettleValue<T>;
function atom<T>(
  options: AtomOptionsWithoutDefault<T>
): ReadWriteFettleValue<T>;
function atom<T>(options: AtomOptions<T>): FettleValueType<T> {
  const key = options.key;
  const optionsDefault =
    "default" in options ? options.default : new Promise<T>(() => {});
  let fettleValue: FettleValueType<T>;

  if (FettleValue.isFettleValue(optionsDefault)) {
    return atomWithFallback({ key: key, default: optionsDefault });
  }

  let liveStoresCount = 0;

  function unwrapPromise(promise: PromiseLike<T>) {
    return Loadable.withPromise(
      promise.then(
        (value) => {
          defaultLoadable = Loadable.withValue(value);
          return value;
        },
        (error) => {
          defaultLoadable = Loadable.withError(error);
          return error;
        }
      )
    );
  }

  let defaultLoadable: LoadableType<T> = isPromiseLike(optionsDefault)
    ? unwrapPromise(optionsDefault)
    : Loadable.isLoadable(optionsDefault)
    ? optionsDefault.state === "loading"
      ? unwrapPromise(optionsDefault.contents)
      : optionsDefault
    : Loadable.withValue(WrappedValue.unwrap(optionsDefault));

  function init(store: StoreType) {
    if (defaultLoadable.state === "loading") {
      defaultLoadable.contents.finally(() => {
        if (!store.hasCache(key)) {
          FettleCore.markStateModified(store, fettleValue);
        }
      });
    }

    liveStoresCount++;
    return () => {
      liveStoresCount--;
    };
  }

  function get(store: StoreType) {
    const loadable = store.getCache<T>(key);
    return loadable ?? defaultLoadable;
  }

  function set(store: StoreType, newValue: T | DefaultValueType): NodeWrites {
    const cache = store.getCache<T>(key);
    const writes: NodeWrites = new Map();
    if (cache) {
      if (cache.state === "hasValue" && cache.contents === newValue) {
        return writes;
      }
    } else if (DefaultValue.isDefaultValue(newValue)) {
      return writes;
    }
    return writes.set(key, Loadable.withValue(newValue));
  }

  fettleValue = FettleNode.registerNode<T>({
    key,
    type: "atom",
    init,
    get,
    set,
  });

  return fettleValue;
}

namespace atom {
  export const value = WrappedValue.wrap;
}

export default atom;
