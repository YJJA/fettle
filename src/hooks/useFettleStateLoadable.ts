import useFettleValueLoadable from "./useFettleValueLoadable";
import useSetFettleState from "./useSetFettleState";

import type { LoadableType } from "../adt/Loadable";
import type { ReadWriteFettleValue } from "../adt/FettleValue";
import type { SetterOrUpdater } from "../types";

export default function useFettleStateLoadable<T>(
  state: ReadWriteFettleValue<T>
): [LoadableType<T>, SetterOrUpdater<T>] {
  return [useFettleValueLoadable(state), useSetFettleState(state)];
}
