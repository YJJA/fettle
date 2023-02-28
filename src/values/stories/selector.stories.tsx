import React from "react";
import { Meta } from "@storybook/react";

import { atom, selector, FettleRoot, useFettleState } from "../../index";

export default {
  title: "Example/selector",
  component: FettleRoot,
} as Meta;

const counterState = atom({
  key: "SelectorCounterState",
  default: 10000,
});

const AtomComponent = () => {
  const [count, setCount] = useFettleState(counterState);
  console.log("AtomComponent: ", { count });

  return (
    <div>
      AtomComponent: {count}
      <button onClick={() => setCount((c) => c + 1)}>+</button>
      <button onClick={() => setCount((c) => c - 1)}>-</button>
    </div>
  );
};

const counterSelector = selector({
  key: "SelectorCounterSelector",
  get({ get }) {
    console.log("get.....");
    return get(counterState) / 2;
  },
  set({ set }, value) {
    console.log("set.....");
    if (typeof value === "number") {
      value = value * 2;
    }
    set(counterState, value);
  },
});

const SelectorComponent = () => {
  const [count, setCount] = useFettleState(counterSelector);

  console.log("SelectorComponent: ", { count });

  return (
    <div>
      SelectorComponent: {count}
      <button onClick={() => setCount((c) => c + 1)}>+</button>
      <button onClick={() => setCount((c) => c - 1)}>-</button>
    </div>
  );
};

export const SelectorSync = () => {
  return (
    <FettleRoot>
      <div>SelectorSync</div>
      <AtomComponent />
      <SelectorComponent />
    </FettleRoot>
  );
};

const asyncCounterState = atom({
  key: "asyncCounterState",
  default: new Promise<number>((resolve) => {
    setTimeout(() => {
      resolve(10000);
    }, 2000);
  }),
});

const AsyncAtomComponent = () => {
  const [count, setCount] = useFettleState(asyncCounterState);

  return (
    <div>
      AsyncAtomComponent: {count}
      <button onClick={() => setCount((c) => c + 1)}>+</button>
      <button onClick={() => setCount((c) => c - 1)}>-</button>
    </div>
  );
};

const AsyncCounterSelector = selector<number>({
  key: "AsyncCounterSelector",
  get({ get }) {
    console.log("async get.....");
    const val = get(asyncCounterState);

    console.log(val);

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(val / 2);
      }, 1000);
    });
  },
  set({ set }, value) {
    console.log("async set.....", value);
    if (typeof value === "number") {
      value = value * 2;
    }
    set(asyncCounterState, value);
  },
});

const AsyncSelectorComponent = () => {
  const [count, setCount] = useFettleState(AsyncCounterSelector);

  return (
    <div>
      <span>AsyncSelectorComponent: {count}</span>
      <button onClick={() => setCount((c) => c + 1)}>+</button>
      <button onClick={() => setCount((c) => c - 1)}>-</button>
    </div>
  );
};

export const SelectorAsync = () => {
  return (
    <FettleRoot>
      <div>SelectorAsync</div>
      <React.Suspense fallback={<div>AsyncAtomComponent 加载中。。。。</div>}>
        <AsyncAtomComponent />
      </React.Suspense>
      <React.Suspense
        fallback={<div>AsyncSelectorComponent 加载中。。。。</div>}
      >
        <AsyncSelectorComponent />
      </React.Suspense>
    </FettleRoot>
  );
};
