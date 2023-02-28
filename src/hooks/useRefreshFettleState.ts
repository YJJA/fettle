import { useCallback } from "react";
import { useStore } from "../core/FettleRoot.js";
import FettleCore from "../core/FettleCore.js";

import type { FettleValueType } from "../adt/FettleValue";

export default function useRefreshFettleState<T>(state: FettleValueType<T>) {
  const store = useStore();

  return useCallback(() => {
    FettleCore.refreshFettleState(store, state);
  }, [state]);
}
