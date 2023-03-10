import { useCallback } from "react";
import { useStore } from "../core/FettleRoot.js";
import FettleCore from "../core/FettleCore.js";

import type { ReadWriteFettleValue } from "../adt/FettleValue";
import type { SetterOrUpdater, ValueOrUpdater } from "../types";

export default function useSetFettleState<T>(
  state: ReadWriteFettleValue<T>
): SetterOrUpdater<T> {
  const store = useStore();

  return useCallback(
    (valOrUpdater: ValueOrUpdater<T>) => {
      FettleCore.setStateValue(store, state, valOrUpdater);
    },
    [state]
  );
}
