import type { DefaultValueType } from "./adt/DefaultValue";
import type { FettleValueType } from "./adt/FettleValue";
import type { LoadableType } from "./adt/Loadable";
import type { WrappedValueType } from "./adt/WrappedValue";

export type FettleKey = string;

export type ValueOrUpdater<T> =
  | T
  | DefaultValueType
  | ((prevValue: T) => T | DefaultValueType);
export type SetterOrUpdater<T> = (valOrUpdater: ValueOrUpdater<T>) => void;

export type RawValue<T> =
  | T
  | PromiseLike<T>
  | WrappedValueType<T>
  | LoadableType<T>
  | FettleValueType<T>;

export type GetFettleValue = <T>(state: FettleValueType<T>) => T;
export type SetFettleValue = <T>(
  state: FettleValueType<T>,
  valOrUpdater: ValueOrUpdater<T>
) => void;
export type ResetFettleValue = <T>(state: FettleValueType<T>) => void;

type Primitive = undefined | null | boolean | number | string;

export interface HasToJSON<T> {
  toJSON(): T;
}

export type SerializableParam =
  | Primitive
  | HasToJSON<SerializableParam>
  | Iterable<SerializableParam>
  | ReadonlyArray<SerializableParam>
  | ReadonlySet<SerializableParam>
  | ReadonlyMap<SerializableParam, SerializableParam>
  | Readonly<{ [key: string]: SerializableParam }>;
