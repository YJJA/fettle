import { createContext, createElement, useContext, useRef } from "react";
import FettleStore from "../core/FettleStore";

import type { PropsWithChildren } from "react";
import type { StoreType } from "./FettleStore";

const Context = createContext(FettleStore.createStore());

export function useStore() {
  return useContext(Context);
}

export type FettleRootProps = PropsWithChildren<{}>;

export default function FettleRoot({ children }: FettleRootProps) {
  const storeRef = useRef<StoreType>();

  if (!storeRef.current) {
    storeRef.current = FettleStore.createStore();
  }

  return createElement(Context.Provider, { value: storeRef.current }, children);
}
