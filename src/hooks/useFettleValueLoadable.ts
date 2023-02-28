import { useCallback } from "react";
import { useSyncExternalStore } from "use-sync-external-store/shim";
import { useStore } from "../core/FettleRoot";
import FettleCore from "../core/FettleCore.js";

import type { FettleValueType } from "../adt/FettleValue";
import type { LoadableType } from "../adt/Loadable";
import type { SubscribeCallback } from "../core/FettleStore";

export default function useFettleValueLoadable<T>(
  fettleValue: FettleValueType<T>
): LoadableType<T> {
  const store = useStore();

  const subscribe = useCallback(
    (callback: SubscribeCallback) => {
      return store.subscribe(fettleValue.key, callback);
    },
    [fettleValue]
  );

  const getSnapshot = useCallback(() => {
    return FettleCore.getStateLoadable<T>(store, fettleValue.key);
  }, [fettleValue]);

  return useSyncExternalStore(subscribe, getSnapshot);
}
