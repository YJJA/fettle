import selectorFamily from "./selectorFamily";

import type { ReadOnlyFettleValue } from "../adt/FettleValue";
import type { SerializableParam } from "../types";

type ConstantSelectorType = <T extends SerializableParam>(
  params: T
) => ReadOnlyFettleValue<T>;

const constantSelector: ConstantSelectorType = selectorFamily<any, any>({
  key: "__constant",
  get: (constant) => () => constant,
});

export default function constSelector<T extends SerializableParam>(
  constant: T
): ReadOnlyFettleValue<T> {
  return constantSelector(constant);
}
