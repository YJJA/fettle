import useFettleValueLoadable from "./useFettleValueLoadable";

import type { FettleValueType } from "../adt/FettleValue";
import type { LoadableType } from "../adt/Loadable";

function handleLoadable<T>(loadable: LoadableType<T>) {
  switch (loadable.state) {
    case "hasValue":
      return loadable.contents;
    case "loading":
      throw loadable.contents;
    case "hasError":
      throw loadable.contents;
  }
}

export default function useFettleValue<T>(state: FettleValueType<T>) {
  const loadable = useFettleValueLoadable(state);
  return handleLoadable(loadable);
}
