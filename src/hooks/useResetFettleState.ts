import { useCallback } from "react";
import DefaultValue from "../adt/DefaultValue";
import { useStore } from "../core/FettleRoot";
import FettleCore from "../core/FettleCore";

import type { ReadWriteFettleValue } from "../adt/FettleValue";

export default function useResetFettleState<T>(
  fettleValue: ReadWriteFettleValue<T>
) {
  const store = useStore();

  return useCallback(() => {
    FettleCore.setStateValue(store, fettleValue, DefaultValue.DEFAULT_VALUE);
  }, [fettleValue]);
}
