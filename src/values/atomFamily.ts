import { isFunction } from "payload-is";

import atom from "./atom.js";

import type { FettleValueType, ReadWriteFettleValue } from "../adt/FettleValue";
import type { FettleKey, RawValue, SerializableParam } from "../types";

interface AtomFamilyOptionsWithoutDefault<T, P extends SerializableParam> {
  key: FettleKey;
}

interface AtomFamilyOptionsWithDefault<T, P extends SerializableParam>
  extends AtomFamilyOptionsWithoutDefault<T, P> {
  default: RawValue<T> | ((param: P) => RawValue<T>);
}

export type AtomFamilyOptions<T, P extends SerializableParam> =
  | AtomFamilyOptionsWithoutDefault<T, P>
  | AtomFamilyOptionsWithDefault<T, P>;

function atomFamily<T, P extends SerializableParam>(
  options: AtomFamilyOptionsWithDefault<T, P>
): (param: P) => ReadWriteFettleValue<T>;
function atomFamily<T, P extends SerializableParam>(
  options: AtomFamilyOptionsWithoutDefault<T, P>
): (param: P) => ReadWriteFettleValue<T>;
function atomFamily<T, P extends SerializableParam>(
  options: AtomFamilyOptions<T, P>
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

    if ("default" in options) {
      return setCache(
        atom({
          key,
          default: isFunction(options.default)
            ? options.default(param)
            : options.default,
        })
      );
    }
    return setCache(atom({ key }));
  };
}

export default atomFamily;
