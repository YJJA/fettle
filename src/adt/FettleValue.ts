import type { FettleKey } from "../types";

class BaseFettleValue<T> {
  constructor(public readonly key: FettleKey) {}
  public toJSON(): { key: string } {
    return { key: this.key };
  }
}

export class ReadOnlyFettleValue<T> extends BaseFettleValue<T> {}

export class ReadWriteFettleValue<T> extends BaseFettleValue<T> {
  public readonly writable: boolean = true;
}

export type FettleValueType<T> =
  | ReadOnlyFettleValue<T>
  | ReadWriteFettleValue<T>;

namespace FettleValue {
  export function readOnly<T>(key: FettleKey) {
    return new ReadOnlyFettleValue<T>(key);
  }

  export function readWrite<T>(key: FettleKey) {
    return new ReadWriteFettleValue<T>(key);
  }

  export function isFettleValue(
    payload: unknown
  ): payload is FettleValueType<any> {
    return (
      payload instanceof ReadOnlyFettleValue ||
      payload instanceof ReadWriteFettleValue
    );
  }
}

export default FettleValue;
