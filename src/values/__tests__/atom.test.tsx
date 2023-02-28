import { describe, test, beforeAll } from "@jest/globals";
import React from "react";
import { render, act, screen, waitFor, cleanup } from "@testing-library/react";

import renderer from "react-test-renderer";

import atom from "../atom.js";
import FettleStore, { StoreType } from "../../core/FettleStore.js";
import WrapperRoot from "../../__test_utils__/WrapperRoot.js";
import StateRead from "../../__test_utils__/StateRead.js";
import Loadable, { LoadableType } from "../../adt/Loadable.js";
import FettleValue from "../../adt/FettleValue.js";
import FettleCore from "../../core/FettleCore.js";

import type {
  FettleValueType,
  ReadWriteFettleValue,
} from "../../adt/FettleValue";
import type { ValueOrUpdater } from "../../types";

let store: StoreType;

beforeAll(() => {
  store = FettleStore.createStore();
});

function getValue<T>(fettleValue: FettleValueType<T>) {
  return FettleCore.getStateLoadable<T>(store, fettleValue.key).valueOrThrow();
}

function getError<T>(fettleValue: FettleValueType<T>) {
  return FettleCore.getStateLoadable<T>(store, fettleValue.key).errorOrThrow();
}

function getLoadable<T>(fettleValue: FettleValueType<T>) {
  return FettleCore.getStateLoadable<T>(store, fettleValue.key);
}

function getPromise<T>(fettleValue: FettleValueType<T>) {
  return FettleCore.getStateLoadable<T>(
    store,
    fettleValue.key
  ).promiseOrThrow();
}

function setValue<T>(
  fettleValue: ReadWriteFettleValue<T>,
  value: ValueOrUpdater<T>
) {
  FettleCore.setStateValue<T>(store, fettleValue, value);
}

let id = 0;

function stringAtom() {
  return atom({ key: `StringAtom-${id++}`, default: "DEFAULT" });
}

test("atom can read and write value", () => {
  const state = atom({
    key: "atom can read and write value",
    default: "DEFAULT",
  });

  expect(getValue(state)).toBe("DEFAULT");
  act(() => setValue(state, "VALUE"));
  expect(getValue(state)).toBe("VALUE");
});

test("atom can store null and undefined", () => {
  const fettleValue = atom<string | null | undefined>({
    key: "atom with default for null and undefined",
    default: "DEFAULT",
  });

  expect(getValue(fettleValue)).toBe("DEFAULT");
  act(() => setValue(fettleValue, "VALUE"));
  expect(getValue(fettleValue)).toBe("VALUE");
  act(() => setValue(fettleValue, null));
  expect(getValue(fettleValue)).toBeNull();
  act(() => setValue(fettleValue, undefined));
  expect(getValue(fettleValue)).toBeUndefined();
  act(() => setValue(fettleValue, "VALUE"));
  expect(getValue(fettleValue)).toBe("VALUE");
});

describe("Defaults", () => {
  test("default is optional", () => {
    const fettleValue = atom<string>({ key: "default is optional" });
    expect(getLoadable(fettleValue).state).toBe("loading");
    act(() => setValue(fettleValue, "VALUE"));
    expect(getValue(fettleValue)).toBe("VALUE");
  });

  test("default promise", async () => {
    const state = atom<string>({
      key: "default promise",
      default: Promise.resolve("RESOLVE"),
    });

    render(<StateRead state={state} />, { wrapper: WrapperRoot });

    expect(screen.getByTestId("loading-fallback")).toHaveTextContent("loading");
    await waitFor(() => screen.getByTestId("state-read"));
    expect(screen.getByTestId("state-read")).toHaveTextContent("RESOLVE");
  });

  test("default promise rejection", async () => {
    const fettleValue = atom<string>({
      key: "default promise rejection",
      default: Promise.reject(new Error("REJECT")),
    });

    render(<StateRead state={fettleValue} />, { wrapper: WrapperRoot });

    expect(screen.getByTestId("loading-fallback")).toHaveTextContent("loading");
    await waitFor(() => screen.getByTestId("error-fallback"));
    expect(screen.getByTestId("error-fallback")).toHaveTextContent("error");
  });

  test("atom default ValueLoadable", async () => {
    const fettleValue = atom<string>({
      key: "atom default ValueLoadable",
      default: Loadable.withValue("VALUE"),
    });
    expect(getValue(fettleValue)).toBe("VALUE");
  });

  test("atom default ErrorLoadable", async () => {
    const fettleValue = atom<string>({
      key: "atom default ErrorLoadable",
      default: Loadable.withError(new Error("ERROR")),
    });

    expect(getError(fettleValue)).toBeInstanceOf(Error);
    expect(getError(fettleValue).message).toBe("ERROR");
  });

  test("atom default LoadingLoadable", async () => {
    const fettleValue = atom<string>({
      key: "atom default LoadingLoadable",
      default: Loadable.withPromise(Promise.resolve("VALUE")),
    });

    await expect(getPromise(fettleValue)).resolves.toBe("VALUE");
  });

  test("atom default derived Loadable", async () => {
    const fettleValue = atom<string>({
      key: "atom default derived Loadable",
      default: Loadable.of("A").map((x) => x + "B"),
    });
    expect(getValue(fettleValue)).toBe("AB");
  });

  test("atom default AtomValue Loadable", async () => {
    const fettleValue = atom<LoadableType<string>>({
      key: "atom default AtomValue Loadable",
      default: atom.value(Loadable.of("VALUE")),
    });
    expect(Loadable.isLoadable(getValue(fettleValue))).toBe(true);
    expect(getValue(fettleValue).valueOrThrow()).toBe("VALUE");
  });

  test("atom default AtomValue ErrorLoadable", () => {
    const myAtom = atom({
      key: "atom default AtomValue Loadable Error",
      default: atom.value(Loadable.error("ERROR")),
    });
    expect(Loadable.isLoadable(getValue(myAtom))).toBe(true);
    expect(getValue(myAtom).errorOrThrow()).toBe("ERROR");
  });

  test("atom default AtomValue Atom", () => {
    const otherAtom = stringAtom();
    const myAtom = atom({
      key: "atom default AtomValue Atom",
      default: atom.value(otherAtom),
    });
    expect(FettleValue.isFettleValue(getValue(myAtom))).toBe(true);
  });
});
