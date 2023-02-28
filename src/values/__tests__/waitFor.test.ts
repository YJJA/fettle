import { act, waitFor } from "@testing-library/react";
import { assert } from "console";
import { FettleValueType } from "../../adt/FettleValue";
import FettleCore from "../../core/FettleCore";
import FettleStore, { StoreType } from "../../core/FettleStore";
import { flushPromisesAndTimers } from "../../__test_utils__/shared";
import selector from "../selector";
import {
  noWait,
  waitForAll,
  waitForAllSettled,
  waitForAny,
  waitForNone,
} from "../waitFor";

let store: StoreType;

beforeAll(() => {
  store = FettleStore.createStore();
});

function getLoadable<T>(fettleValue: FettleValueType<T>) {
  return FettleCore.getStateLoadable<T>(store, fettleValue.key);
}

function getState<T>(
  fettleValue: FettleValueType<T>
): "loading" | "hasValue" | "hasError" {
  return getLoadable(fettleValue).state;
}

function getValue<T>(fettleValue: FettleValueType<T>) {
  const loadable = getLoadable(fettleValue);
  if (loadable.state !== "hasValue") {
    throw new Error(`expected atom "${fettleValue.key}" to have a value`);
  }
  return loadable.contents;
}

function getPromise<T>(fettleValue: FettleValueType<T>): Promise<T> {
  const loadable = getLoadable(fettleValue);
  if (loadable.state !== "loading") {
    throw new Error(`expected atom "${fettleValue.key}" to be a promise`);
  }
  return loadable.toPromise();
}

let id = 0;
function createAsyncSelector<T = any, S = any>(dep?: FettleValueType<S>) {
  let resolve: (value: T) => void = () => assert(false, "bug in test code");
  let reject: (err: any) => void = () => assert(false, "bug in test code");
  let evaluated = false;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  const sel = selector({
    key: `createAsyncSelector${id++}`,
    get: ({ get }) => {
      evaluated = true;
      if (dep != null) {
        get(dep);
      }
      return promise;
    },
  });

  return [sel, resolve, reject, () => evaluated] as const;
}

test("noWait - resolve", async () => {
  const [dep, resolve] = createAsyncSelector<number>();
  const pTest = expect(getValue(noWait(dep)).toPromise()).resolves.toBe(42);

  expect(getValue(noWait(dep)).contents).toBeInstanceOf(Promise);
  resolve(42);
  await flushPromisesAndTimers();
  expect(getValue(noWait(dep)).contents).toBe(42);
  await pTest;
});

test("noWait - reject", async () => {
  const [dep, _resolve, reject] = createAsyncSelector();
  class MyError extends Error {}

  const pTest = expect(
    getValue(noWait(dep)).toPromise()
  ).rejects.toBeInstanceOf(MyError);
  expect(getValue(noWait(dep)).contents).toBeInstanceOf(Promise);
  reject(new MyError());
  await flushPromisesAndTimers();
  expect(getValue(noWait(dep)).contents).toBeInstanceOf(MyError);
  await pTest;
});

// TRUTH TABLE
// Dependencies        waitForNone         waitForAny        waitForAll      waitForAllSettled
// [loading, loading]  [Promise, Promise]  Promise           Promise         Promise
// [value, loading]    [value, Promise]    [value, Promise]  Promise         Promise
// [value, value]      [value, value]      [value, value]    [value, value]  [value, value]
test("waitFor - resolve to values", async () => {
  const [depA, resolveA] = createAsyncSelector();
  const [depB, resolveB] = createAsyncSelector();
  const deps = [depA, depB];

  // Test for initial values
  // watiForNone returns loadables with promises that resolve to their values
  expect(getValue(waitForNone(deps)).every((r) => r.state === "loading")).toBe(
    true
  );
  const depTest0 = expect(
    getValue(waitForNone(deps))[0].promiseMaybe()
  ).resolves.toBe(0);
  const depTest1 = expect(
    getValue(waitForNone(deps))[1].promiseMaybe()
  ).resolves.toBe(1);
  // waitForAny returns a promise that resolves to the state with the next
  // resolved value.  So, that includes the first value and a promise for the second.
  expect(getLoadable(waitForAny(deps)).contents).toBeInstanceOf(Promise);

  // const anyTest0 = expect(
  //   getPromise(waitForAny(deps)).then((value) => {
  //     expect(value.valueMaybe()).toEqual(0);
  //     return value.valueMaybe();
  //   })
  // ).resolves.toEqual(0);

  // const anyTest1 = expect(
  //   getPromise(waitForAny(deps)).then((value) => {
  //     expect(value[1].promiseMaybe()).toBeInstanceOf(Promise);
  //     return value[1].promiseMaybe();
  //   })
  // ).resolves.toBe(1);

  // waitForAll returns a promise that resolves to the actual values
  expect(getLoadable(waitForAll(deps)).contents).toBeInstanceOf(Promise);
  const allTest0 = expect(getPromise(waitForAll(deps))).resolves.toEqual([
    0, 1,
  ]);

  // Resolve the first dep
  resolveA(0);
  await flushPromisesAndTimers();
  expect(getValue(waitForNone(deps))[0].contents).toBe(0);
  expect(getValue(waitForNone(deps))[1].contents).toBeInstanceOf(Promise);
  // expect(getValue(waitForAny(deps))[0].contents).toBe(0);
  // expect(getValue(waitForAny(deps))[1].contents).toBeInstanceOf(Promise);
  expect(getLoadable(waitForAll(deps)).contents).toBeInstanceOf(Promise);

  const allTest1 = expect(getPromise(waitForAll(deps))).resolves.toEqual([
    0, 1,
  ]);

  // Resolve the second dep
  resolveB(1);
  await flushPromisesAndTimers();
  expect(getValue(waitForNone(deps))[0].contents).toBe(0);
  expect(getValue(waitForNone(deps))[1].contents).toBe(1);
  // expect(getValue(waitForAny(deps))[0].contents).toBe(0);
  // expect(getValue(waitForAny(deps))[1].contents).toBe(1);
  expect(getValue(waitForAll(deps))[0]).toBe(0);
  expect(getValue(waitForAll(deps))[1]).toBe(1);

  await depTest0;
  await depTest1;
  // await anyTest0;
  // await anyTest1;
  await allTest0;
  await allTest1;
});

// TRUTH TABLE
// Dependencies        waitForNone         waitForAny        waitForAll    waitForAllSettled
// [loading, loading]  [Promise, Promise]  Promise           Promise       Promise
// [error, loading]    [Error, Promise]    [Error, Promise]  Error         Promise
// [error, error]      [Error, Error]      [Error, Error]    Error         [Error, Error]
test("waitFor - rejected", async () => {
  const [depA, _resolveA, rejectA] = createAsyncSelector();
  const [depB, _resolveB, rejectB] = createAsyncSelector();
  const deps = [depA, depB];

  class Error1 extends Error {}
  class Error2 extends Error {}

  // All deps Loading Tests
  expect(getState(waitForNone(deps))).toEqual("hasValue");
  expect(getLoadable(waitForNone(deps)).contents).toBeInstanceOf(Array);
  expect(getValue(waitForNone(deps))[0].contents).toBeInstanceOf(Promise);
  expect(getValue(waitForNone(deps))[1].contents).toBeInstanceOf(Promise);

  expect(getState(waitForAny(deps))).toEqual("loading");
  expect(getLoadable(waitForAny(deps)).contents).toBeInstanceOf(Promise);
  // const anyTest0 = expect(
  //   getPromise(waitForAny(deps)).then((res) => {
  //     expect(res[0].contents).toBeInstanceOf(Error1);
  //     expect(res[1].contents).toBeInstanceOf(Promise);
  //     return "success";
  //   })
  // ).resolves.toEqual("success");

  expect(getState(waitForAll(deps))).toEqual("loading");
  expect(getLoadable(waitForAll(deps)).contents).toBeInstanceOf(Promise);
  const allTest0 = expect(
    getPromise(waitForAll(deps)).catch((err) => {
      expect(err).toBeInstanceOf(Error1);
      return "failure";
    })
  ).resolves.toEqual("failure");

  expect(getState(waitForAllSettled(deps))).toEqual("loading");
  expect(getLoadable(waitForAllSettled(deps)).contents).toBeInstanceOf(Promise);
  const allSettledTest0 = expect(
    getPromise(waitForAllSettled(deps)).then((res) => {
      expect(res[0].status).toBe("rejected");
      expect(res[1].status).toBe("rejected");
      return "success";
    })
  ).resolves.toEqual("success");

  // depA Rejected tests
  rejectA(new Error1());
  await flushPromisesAndTimers();

  expect(getState(waitForNone(deps))).toEqual("hasValue");
  expect(getLoadable(waitForNone(deps)).contents).toBeInstanceOf(Array);
  expect(getValue(waitForNone(deps))[0].contents).toBeInstanceOf(Error1);
  expect(getValue(waitForNone(deps))[1].contents).toBeInstanceOf(Promise);

  expect(getState(waitForAny(deps))).toEqual("loading");
  // expect(getLoadable(waitForAny(deps)).contents).toBeInstanceOf(Array);
  // expect(getValue(waitForAny(deps))[0].contents).toBeInstanceOf(Error1);
  // expect(getValue(waitForAny(deps))[1].contents).toBeInstanceOf(Promise);

  expect(getState(waitForAll(deps))).toEqual("hasError");
  expect(getLoadable(waitForAll(deps)).contents).toBeInstanceOf(Error1);

  expect(getState(waitForAllSettled(deps))).toEqual("loading");
  expect(getLoadable(waitForAllSettled(deps)).contents).toBeInstanceOf(Promise);
  const allSettledTest1 = expect(
    getPromise(waitForAllSettled(deps)).then((res) => {
      expect(res[0].status).toBe("rejected");
      expect(res[1].status).toBe("rejected");
      return "success";
    })
  ).resolves.toEqual("success");

  // depB Rejected tests
  rejectB(new Error2());
  await flushPromisesAndTimers();

  expect(getState(waitForNone(deps))).toEqual("hasValue");
  expect(getLoadable(waitForNone(deps)).contents).toBeInstanceOf(Array);
  expect(getValue(waitForNone(deps))[0].contents).toBeInstanceOf(Error1);
  expect(getValue(waitForNone(deps))[1].contents).toBeInstanceOf(Error2);

  // expect(getState(waitForAny(deps))).toEqual("hasValue");
  // expect(getLoadable(waitForAny(deps)).contents).toBeInstanceOf(Array);
  // expect(getValue(waitForAny(deps))[0].contents).toBeInstanceOf(Error1);
  // expect(getValue(waitForAny(deps))[1].contents).toBeInstanceOf(Error2);

  expect(getState(waitForAll(deps))).toEqual("hasError");
  expect(getLoadable(waitForAll(deps)).contents).toBeInstanceOf(Error1);

  expect(getState(waitForAllSettled(deps))).toEqual("hasValue");
  expect(getLoadable(waitForAllSettled(deps)).contents).toBeInstanceOf(Array);

  expect(getValue(waitForAllSettled(deps))[0].status).toBe("rejected");
  expect(getValue(waitForAllSettled(deps))[1].status).toBe("rejected");

  // await anyTest0;
  await allTest0;
  await allSettledTest0;
  await allSettledTest1;
});

// TRUTH TABLE
// Dependencies        waitForNone         waitForAny        waitForAll    waitForAllSettled
// [loading, loading]  [Promise, Promise]  Promise           Promise       Promise
// [value, loading]    [value, Promise]    [value, Promise]  Promise       Promise
// [value, error]      [value, Error]      [value, Error]    Error         [value, Error]
test("waitFor - resolve then reject", async () => {
  const [depA, resolveA, _rejectA] = createAsyncSelector();
  const [depB, _resolveB, rejectB] = createAsyncSelector();
  const deps = [depA, depB];

  class Error2 extends Error {}

  // All deps Loading Tests
  expect(getState(waitForNone(deps))).toEqual("hasValue");
  expect(getLoadable(waitForNone(deps)).contents).toBeInstanceOf(Array);
  expect(getValue(waitForNone(deps))[0].contents).toBeInstanceOf(Promise);
  expect(getValue(waitForNone(deps))[1].contents).toBeInstanceOf(Promise);

  expect(getState(waitForAny(deps))).toEqual("loading");
  expect(getLoadable(waitForAny(deps)).contents).toBeInstanceOf(Promise);
  // const anyTest0 = expect(
  //   getPromise(waitForAny(deps)).then((res) => {
  //     expect(res[0].contents).toEqual(1);
  //     expect(res[1].contents).toBeInstanceOf(Promise);
  //     return "success";
  //   })
  // ).resolves.toEqual("success");

  expect(getState(waitForAll(deps))).toEqual("loading");
  expect(getLoadable(waitForAll(deps)).contents).toBeInstanceOf(Promise);
  const allTest0 = expect(
    getPromise(waitForAll(deps)).catch((err) => {
      expect(err).toBeInstanceOf(Error2);
      return "failure";
    })
  ).resolves.toEqual("failure");

  expect(getState(waitForAllSettled(deps))).toEqual("loading");
  expect(getLoadable(waitForAllSettled(deps)).contents).toBeInstanceOf(Promise);
  const allSettledTest0 = expect(
    getPromise(waitForAllSettled(deps)).then((res) => {
      expect(res[0].status).toEqual("fulfilled");
      expect(res[1].status).toEqual("rejected");
      return "success";
    })
  ).resolves.toEqual("success");

  // depA Resolves tests
  resolveA(1);
  await flushPromisesAndTimers();

  expect(getState(waitForNone(deps))).toEqual("hasValue");
  expect(getLoadable(waitForNone(deps)).contents).toBeInstanceOf(Array);
  expect(getValue(waitForNone(deps))[0].contents).toEqual(1);
  expect(getValue(waitForNone(deps))[1].contents).toBeInstanceOf(Promise);

  expect(getState(waitForAny(deps))).toEqual("hasValue");
  // expect(getLoadable(waitForAny(deps)).contents).toBeInstanceOf(Array);
  // expect(getValue(waitForAny(deps))[0].contents).toEqual(1);
  // expect(getValue(waitForAny(deps))[1].contents).toBeInstanceOf(Promise);

  expect(getState(waitForAll(deps))).toEqual("loading");
  expect(getLoadable(waitForAll(deps)).contents).toBeInstanceOf(Promise);
  const allTest1 = expect(getPromise(waitForAll(deps))).rejects.toBeInstanceOf(
    Error2
  );

  expect(getState(waitForAllSettled(deps))).toEqual("loading");
  expect(getLoadable(waitForAllSettled(deps)).contents).toBeInstanceOf(Promise);
  const allSettledTest1 = expect(
    getPromise(waitForAllSettled(deps)).then((res) => {
      expect(res[0].status).toEqual("fulfilled");
      expect(res[1].status).toEqual("rejected");
      return "success";
    })
  ).resolves.toEqual("success");

  // depB Rejected tests
  rejectB(new Error2());
  await flushPromisesAndTimers();

  expect(getState(waitForNone(deps))).toEqual("hasValue");
  expect(getLoadable(waitForNone(deps)).contents).toBeInstanceOf(Array);
  expect(getValue(waitForNone(deps))[0].contents).toEqual(1);
  expect(getValue(waitForNone(deps))[1].contents).toBeInstanceOf(Error2);

  expect(getState(waitForAny(deps))).toEqual("hasValue");
  // expect(getLoadable(waitForAny(deps)).contents).toBeInstanceOf(Array);
  // expect(getValue(waitForAny(deps))[0].contents).toEqual(1);
  // expect(getValue(waitForAny(deps))[1].contents).toBeInstanceOf(Error2);

  expect(getState(waitForAll(deps))).toEqual("hasError");
  expect(getLoadable(waitForAll(deps)).contents).toBeInstanceOf(Error2);

  expect(getState(waitForAllSettled(deps))).toEqual("hasValue");
  expect(getLoadable(waitForAllSettled(deps)).contents).toBeInstanceOf(Array);

  expect(getValue(waitForAllSettled(deps))[0].status).toEqual("fulfilled");
  expect(getValue(waitForAllSettled(deps))[1].status).toEqual("rejected");

  // await anyTest0;
  await allTest0;
  await allTest1;
  await allSettledTest0;
  await allSettledTest1;
});

// TRUTH TABLE
// Dependencies        waitForNone         waitForAny        waitForAll    waitForAllSettled
// [loading, loading]  [Promise, Promise]  Promise           Promise       Promise
// [error, loading]    [Error, Promise]    [Error, Promsie]  Error         Promise
// [error, value]      [Error, value]      [Error, value]    Error         [Error, value]
test("waitFor - reject then resolve", async () => {
  const [depA, _resolveA, rejectA] = createAsyncSelector();
  const [depB, resolveB, _rejectB] = createAsyncSelector();
  const deps = [depA, depB];

  class Error1 extends Error {}

  // All deps Loading Tests
  expect(getState(waitForNone(deps))).toEqual("hasValue");
  expect(getLoadable(waitForNone(deps)).contents).toBeInstanceOf(Array);
  expect(getValue(waitForNone(deps))[0].contents).toBeInstanceOf(Promise);
  expect(getValue(waitForNone(deps))[1].contents).toBeInstanceOf(Promise);

  expect(getState(waitForAny(deps))).toEqual("loading");
  expect(getLoadable(waitForAny(deps)).contents).toBeInstanceOf(Promise);
  // const anyTest0 = expect(
  //   getPromise(waitForAny(deps)).then((res) => {
  //     expect(res[0].contents).toBeInstanceOf(Error1);
  //     expect(res[1].contents).toBeInstanceOf(Promise);
  //     return "success";
  //   })
  // ).resolves.toEqual("success");

  expect(getState(waitForAll(deps))).toEqual("loading");
  expect(getLoadable(waitForAll(deps)).contents).toBeInstanceOf(Promise);
  const allTest0 = expect(
    getPromise(waitForAll(deps)).catch((err) => {
      expect(err).toBeInstanceOf(Error1);
      return "failure";
    })
  ).resolves.toEqual("failure");

  expect(getState(waitForAllSettled(deps))).toEqual("loading");
  expect(getLoadable(waitForAllSettled(deps)).contents).toBeInstanceOf(Promise);
  const allSettledTest0 = expect(
    getPromise(waitForAllSettled(deps)).then((res) => {
      expect(res[0].status).toEqual("rejected");
      expect(res[1].status).toEqual("fulfilled");
      return "success";
    })
  ).resolves.toEqual("success");

  // depA Rejects tests
  rejectA(new Error1());
  await flushPromisesAndTimers();

  expect(getState(waitForNone(deps))).toEqual("hasValue");
  expect(getLoadable(waitForNone(deps)).contents).toBeInstanceOf(Array);
  expect(getValue(waitForNone(deps))[0].contents).toBeInstanceOf(Error1);
  expect(getValue(waitForNone(deps))[1].contents).toBeInstanceOf(Promise);

  expect(getState(waitForAny(deps))).toEqual("loading");
  // expect(getLoadable(waitForAny(deps)).contents).toBeInstanceOf(Array);
  // expect(getValue(waitForAny(deps))[0].contents).toBeInstanceOf(Error1);
  // expect(getValue(waitForAny(deps))[1].contents).toBeInstanceOf(Promise);

  expect(getState(waitForAll(deps))).toEqual("hasError");
  expect(getLoadable(waitForAll(deps)).contents).toBeInstanceOf(Error1);

  expect(getState(waitForAllSettled(deps))).toEqual("loading");
  expect(getLoadable(waitForAllSettled(deps)).contents).toBeInstanceOf(Promise);
  const allSettledTest1 = expect(
    getPromise(waitForAllSettled(deps)).then((res) => {
      expect(res[0].status).toEqual("rejected");
      expect(res[1].status).toEqual("fulfilled");
      return "success";
    })
  ).resolves.toEqual("success");

  // depB Resolves tests
  resolveB(1);
  await flushPromisesAndTimers();

  expect(getState(waitForNone(deps))).toEqual("hasValue");
  expect(getLoadable(waitForNone(deps)).contents).toBeInstanceOf(Array);
  expect(getValue(waitForNone(deps))[0].contents).toBeInstanceOf(Error1);
  expect(getValue(waitForNone(deps))[1].contents).toEqual(1);

  expect(getState(waitForAny(deps))).toEqual("hasValue");
  // expect(getLoadable(waitForAny(deps)).contents).toBeInstanceOf(Array);
  // expect(getValue(waitForAny(deps))[0].contents).toBeInstanceOf(Error1);
  // expect(getValue(waitForAny(deps))[1].contents).toEqual(1);

  expect(getState(waitForAll(deps))).toEqual("hasError");
  expect(getLoadable(waitForAll(deps)).contents).toBeInstanceOf(Error1);

  expect(getState(waitForAllSettled(deps))).toEqual("hasValue");
  expect(getLoadable(waitForAllSettled(deps)).contents).toBeInstanceOf(Array);
  expect(getValue(waitForAllSettled(deps))[0].status).toEqual("rejected");
  expect(getValue(waitForAllSettled(deps))[1].status).toEqual("fulfilled");

  // await anyTest0;
  await allTest0;
  await allSettledTest0;
  await allSettledTest1;
});

test("waitForAll - Evaluated concurrently", async () => {
  const [depA, resolveA, _rejectA, evaluatedA] = createAsyncSelector();
  const [depB, _resolveB, _rejectB, evaluatedB] = createAsyncSelector();
  const deps = [depA, depB];

  expect(evaluatedA()).toBe(false);
  expect(evaluatedB()).toBe(false);

  getPromise(waitForAll(deps));
  await flushPromisesAndTimers();

  // Confirm dependencies were evaluated in parallel
  expect(evaluatedA()).toBe(true);
  expect(evaluatedB()).toBe(true);

  resolveA(0);
  getPromise(waitForAll(deps));
  await flushPromisesAndTimers();

  expect(evaluatedA()).toBe(true);
  expect(evaluatedB()).toBe(true);
});

test("waitForAll - mixed sync and async deps", async () => {
  const [depA, resolveA] = createAsyncSelector();
  const depB = selector({
    key: "mydepkeyB",
    get: () => 1,
  });

  const deps = [depA, depB];

  const allTest = expect(getPromise(waitForAll(deps))).resolves.toEqual([0, 1]);

  resolveA(0);
  await flushPromisesAndTimers();

  expect(getValue(waitForAll(deps))).toEqual([0, 1]);

  await allTest;
});
