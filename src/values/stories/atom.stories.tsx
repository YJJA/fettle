import React from "react";
import { ComponentStory, ComponentMeta } from "@storybook/react";

import {
  atom,
  FettleRoot,
  useFettleState,
  useFettleValue,
  useFettleValueLoadable,
  useSetFettleState,
} from "../../index";
import ErrorBoundary from "../../__test_utils__/ErrorBoundary";

export default {
  title: "Example/atom",
} as ComponentMeta<typeof FettleRoot>;

const SyncCounterState = atom<number>({
  key: "AtomCounterState",
  default: 10000,
});

const SyncValueComponent = () => {
  const count = useFettleValue(SyncCounterState);
  console.log("useFettleValue: ", { count });

  return <div>useFettleValue: {count}</div>;
};

const SyncSetStateComponent = () => {
  const setCount = useSetFettleState(SyncCounterState);

  return (
    <div>
      useSetFettleState:
      <button onClick={() => setCount((c) => c + 1)}>+</button>
      <button onClick={() => setCount((c) => c - 1)}>-</button>
    </div>
  );
};

const SyncStateComponent = () => {
  const [count, setCount] = useFettleState(SyncCounterState);

  return (
    <div>
      useFettleState: {count}
      <button onClick={() => setCount((c) => c + 1)}>+</button>
      <button onClick={() => setCount((c) => c - 1)}>-</button>
    </div>
  );
};

export const SyncState = () => {
  return (
    <FettleRoot>
      <div>Sync State</div>
      <SyncValueComponent />
      <SyncSetStateComponent />
      <SyncStateComponent />
    </FettleRoot>
  );
};

const AsyncCounterState = atom({
  key: "CounterPromiseState",
  default: new Promise<number>((resolve) => {
    console.log("AsyncCounterState... call once...");
    setTimeout(() => {
      resolve(1000);
    }, 1000);
  }),
});

const AsyncValueComponent = () => {
  const count = useFettleValue(AsyncCounterState);
  console.log("useFettleValue: ", { count });

  return <div>useFettleValue: {count}</div>;
};

const AsyncSetStateComponent = () => {
  const setCount = useSetFettleState(AsyncCounterState);

  return (
    <div>
      useSetFettleState:
      <button onClick={() => setCount((c) => c + 1)}>+</button>
      <button onClick={() => setCount((c) => c - 1)}>-</button>
    </div>
  );
};

const AsyncStateComponent = () => {
  const [count, setCount] = useFettleState(AsyncCounterState);

  return (
    <div>
      useFettleState: {count}
      <button onClick={() => setCount((c) => c + 1)}>+</button>
      <button onClick={() => setCount((c) => c - 1)}>-</button>
    </div>
  );
};

const ErrorBoundaryState = atom<number>({
  key: "ErrorBoundary",
  default: Promise.reject(new Error("ErrorBoundaryState Error")),
});

const ErrorBoundaryStateComponent = () => {
  const count = useFettleValue(ErrorBoundaryState);

  return <div>ErrorBoundaryState: {count}</div>;
};

export const AsyncState = () => {
  return (
    <FettleRoot>
      <div>AsyncState</div>
      <React.Suspense fallback={<div>AsyncValueComponent 加载中。。。。</div>}>
        <AsyncValueComponent />
      </React.Suspense>
      <AsyncSetStateComponent />
      <React.Suspense fallback={<div>AsyncStateComponent 加载中。。。。</div>}>
        <AsyncStateComponent />
      </React.Suspense>

      <ErrorBoundary>
        <React.Suspense fallback={<div>ErrorBoundaryState 加载中。。。。</div>}>
          <ErrorBoundaryStateComponent />
        </React.Suspense>
      </ErrorBoundary>
    </FettleRoot>
  );
};
