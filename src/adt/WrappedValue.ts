class BaseWrappedValue<T> {
  constructor(public readonly value: T) {}
}

export type WrappedValueType<T> = BaseWrappedValue<T>;

namespace WrappedValue {
  export function wrap<T>(value: T) {
    return new BaseWrappedValue(value);
  }

  export function unwrap<T>(payload: WrappedValueType<T> | T) {
    return payload instanceof BaseWrappedValue ? payload.value : payload;
  }

  export function isWrappedValue(
    payload: unknown
  ): payload is WrappedValueType<any> {
    return payload instanceof BaseWrappedValue;
  }
}

export default WrappedValue;
