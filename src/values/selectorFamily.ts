import selector from "./selector.js";

import type {
  FettleValueType,
  ReadOnlyFettleValue,
  ReadWriteFettleValue,
} from "../adt/FettleValue";
import type {
  FettleKey,
  GetFettleValue,
  RawValue,
  ResetFettleValue,
  SerializableParam,
  SetFettleValue,
  ValueOrUpdater,
} from "../types";

interface ReadOnlySelectorFamilyOptions<T, P extends SerializableParam> {
  key: string;
  get: (param: P) => (opts: { get: GetFettleValue }) => RawValue<T>;
}

interface ReadWriteSelectorFamilyOptions<T, P extends SerializableParam>
  extends ReadOnlySelectorFamilyOptions<T, P> {
  set: (
    param: P
  ) => (
    opts: { get: GetFettleValue; set: SetFettleValue; reset: ResetFettleValue },
    value: ValueOrUpdater<T>
  ) => void;
}

export type SelectorFamilyOptions<T, P extends SerializableParam> =
  | ReadWriteSelectorFamilyOptions<T, P>
  | ReadOnlySelectorFamilyOptions<T, P>;

function selectorFamily<T, P extends SerializableParam>(
  options: ReadWriteSelectorFamilyOptions<T, P>
): (param: P) => ReadWriteFettleValue<T>;
function selectorFamily<T, P extends SerializableParam>(
  options: ReadOnlySelectorFamilyOptions<T, P>
): (param: P) => ReadOnlyFettleValue<T>;
function selectorFamily<T, P extends SerializableParam>(
  options: SelectorFamilyOptions<T, P>
): (param: P) => FettleValueType<T> {
  const familyCache = new Map<string, FettleValueType<any>>();
  function hasCache(key: FettleKey) {
    return familyCache.has(key);
  }
  function setCache<T>(state: FettleValueType<T>) {
    familyCache.set(state.key, state);
    return state;
  }
  function getCache<T>(key: FettleKey) {
    return familyCache.get(key) as FettleValueType<T>;
  }

  return (param: P) => {
    const key = `${options.key}__${JSON.stringify(param)}`;
    if (hasCache(key)) {
      return getCache(key);
    }

    if ("set" in options) {
      return setCache(
        selector({
          key,
          get: options.get(param),
          set: options.set(param),
        })
      );
    }
    return setCache(
      selector({
        key,
        get: options.get(param),
      })
    );
  };
}

export default selectorFamily;
