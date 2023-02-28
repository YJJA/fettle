class BaseDefaultValue {}

export type DefaultValueType = BaseDefaultValue;

namespace DefaultValue {
  export const DEFAULT_VALUE = new BaseDefaultValue();

  export function isDefaultValue(
    payload: unknown
  ): payload is DefaultValueType {
    return payload instanceof BaseDefaultValue;
  }
}

export default DefaultValue;
