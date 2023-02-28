import FettleError from "../adt/FettleError";
import selectorFamily from "./selectorFamily";

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
