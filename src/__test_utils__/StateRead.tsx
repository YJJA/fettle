import React from "react";
import useFettleValue from "../hooks/useFettleValue.js";

import type { FettleValueType } from "../adt/FettleValue";

export type StateReadProps<T> = {
  state: FettleValueType<T>;
};

export default function StateRead<T extends string>({
  state,
}: StateReadProps<T>) {
  const res = useFettleValue(state);

  return <div data-testid="state-read">{res}</div>;
}
