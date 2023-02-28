import Loadable from "../adt/Loadable";
import WrappedValue from "../adt/WrappedValue";
import selectorFamily from "./selectorFamily";

import type { FettleValueType, ReadOnlyFettleValue } from "../adt/FettleValue";
import type { LoadableType } from "../adt/Loadable";

type UnwrapFettleValue<T> = T extends FettleValueType<infer V> ? V : never;

type NoWaitType = <T>(
  param: FettleValueType<T>
) => ReadOnlyFettleValue<LoadableType<T>>;

export const noWait: NoWaitType = selectorFamily({
  key: "__noWait",
  get:
    (dependency) =>
    ({ get }) => {
      return WrappedValue.wrap(Loadable.run(() => get(dependency)));
    },
});

type WaitForAllType = {
  <T extends readonly unknown[] | []>(params: T): ReadOnlyFettleValue<
    {
      [P in keyof T]: UnwrapFettleValue<T[P]>;
    }
  >;
  <T extends FettleValueType<any>>(params: Iterable<T>): ReadOnlyFettleValue<
    UnwrapFettleValue<T>[]
  >;
};

export const waitForAll: WaitForAllType = selectorFamily({
  key: "__waitForAll",
  get:
    (dependencies) =>
    ({ get }) => {
      const loadables = Array.from(dependencies).map((dep) =>
        Loadable.run(() => get(dep))
      );
      return Loadable.all(loadables);
    },
});

type WaitForAllSettledType = {
  <T extends readonly unknown[] | []>(params: T): ReadOnlyFettleValue<
    {
      [P in keyof T]: PromiseSettledResult<UnwrapFettleValue<T[P]>>;
    }
  >;
  <T extends FettleValueType<any>>(params: Iterable<T>): ReadOnlyFettleValue<
    PromiseSettledResult<UnwrapFettleValue<T>>[]
  >;
};

export const waitForAllSettled: WaitForAllSettledType = selectorFamily({
  key: "__waitForAllSettled",
  get:
    (dependencies) =>
    ({ get }) => {
      const loadables = Array.from(dependencies).map((dep) =>
        Loadable.run(() => get(dep))
      );
      return Loadable.allSettled(loadables);
    },
});

type WaitForNoneType = {
  <T extends readonly unknown[] | []>(params: T): ReadOnlyFettleValue<
    {
      [P in keyof T]: LoadableType<UnwrapFettleValue<T[P]>>;
    }
  >;
  <T extends FettleValueType<any>>(params: Iterable<T>): ReadOnlyFettleValue<
    LoadableType<UnwrapFettleValue<T>>[]
  >;
};

export const waitForNone: WaitForNoneType = selectorFamily({
  key: "__waitForNone",
  get:
    (dependencies) =>
    ({ get }) => {
      return Array.from(dependencies).map((dep) =>
        Loadable.run(() => get(dep))
      );
    },
});

type WaitForRaceType = {
  <T extends readonly unknown[] | []>(params: T): ReadOnlyFettleValue<
    UnwrapFettleValue<T[number]>
  >;
  <T extends FettleValueType<any>>(params: Iterable<T>): ReadOnlyFettleValue<
    UnwrapFettleValue<T>
  >;
};

export const waitForRace: WaitForRaceType = selectorFamily({
  key: "__waitForRace",
  get:
    (dependencies) =>
    ({ get }) => {
      const loadables = Array.from(dependencies).map((dep) =>
        Loadable.run(() => get(dep))
      );
      return Loadable.race(loadables);
    },
});

type WaitForAnyType = {
  <T extends readonly unknown[] | []>(params: T): ReadOnlyFettleValue<
    UnwrapFettleValue<T[number]>
  >;
  <T extends FettleValueType<any>>(params: Iterable<T>): ReadOnlyFettleValue<
    UnwrapFettleValue<T>
  >;
};

export const waitForAny: WaitForAnyType = selectorFamily({
  key: "__waitForAny",
  get:
    (dependencies) =>
    ({ get }) => {
      const loadables = Array.from(dependencies).map((dep) =>
        Loadable.run(() => get(dep))
      );
      return Loadable.any(loadables);
    },
});
