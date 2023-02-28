import useFettleValue from "./useFettleValue";
import useSetFettleState from "./useSetFettleState";

import type { ReadWriteFettleValue } from "../adt/FettleValue";
import type { SetterOrUpdater } from "../types";

export default function useFettleState<T>(
  state: ReadWriteFettleValue<T>
): [T, SetterOrUpdater<T>] {
  return [useFettleValue(state), useSetFettleState(state)];
}
