import FettleError from "../adt/FettleError.js";
import selectorFamily from "./selectorFamily.js";

import type { ReadOnlyFettleValue } from "../adt/FettleValue";

const throwingSelector = selectorFamily<any, string>({
  key: "__constant",
  get: (message) => () => {
    throw FettleError.err(message);
  },
});

export default function errorSelector<T>(
  message: string
): ReadOnlyFettleValue<T> {
  return throwingSelector(message);
}
