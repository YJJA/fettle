import React from "react";
import FettleRoot from "../core/FettleRoot.js";
import ErrorBoundary from "./ErrorBoundary.js";

import type { PropsWithChildren } from "react";

export type WrapperRootProps = PropsWithChildren<{}>;

export default function WrapperRoot({ children }: WrapperRootProps) {
  return (
    <FettleRoot>
      <ErrorBoundary>
        <React.Suspense
          fallback={<div data-testid="loading-fallback">loading</div>}
        >
          {children}
        </React.Suspense>
      </ErrorBoundary>
    </FettleRoot>
  );
}
