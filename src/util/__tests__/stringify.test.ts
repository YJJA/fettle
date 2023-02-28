import FettleValue from "../../adt/FettleValue";
import { stringify } from "../stringify";

const noop = () => {};

test("stringify", () => {
  expect(stringify("A")).toEqual('"A"');
  expect(stringify(`A"`)).toEqual('"A\\""');
  expect(stringify(`A\\`)).toEqual('"A\\\\"');

  expect(stringify(1)).toEqual("1");
  expect(stringify(Symbol())).toEqual("Symbol()");
  expect(stringify(Symbol("A"))).toEqual("Symbol(A)");
  expect(stringify(null)).toEqual("null");
  expect(stringify(undefined)).toEqual("");
  expect(stringify(true)).toEqual("true");
  expect(stringify(false)).toEqual("false");
  expect(stringify(BigInt(100))).toEqual("100");

  expect(stringify(noop)).toEqual("__FUNCTION(noop)__");
  expect(stringify(new Promise(() => {}))).toEqual("__PROMISE__");
  expect(stringify(new WeakSet())).toEqual("{}");
  expect(stringify(new WeakMap())).toEqual("{}");

  expect(stringify(new Set())).toEqual("[]");
  expect(stringify(new Set([1, 2, 3]))).toEqual("[1,2,3]");
  expect(stringify(new Map())).toEqual("[]");
  const map = new Map();
  map.set("A", "A");
  map.set("B", "B");
  expect(stringify(map)).toEqual('[["A","A"],["B","B"]]');

  expect(stringify({})).toEqual("{}");
  expect(stringify({ key: "A" })).toEqual('{"key":"A"}');
  expect(stringify({ key: noop })).toEqual('{"key":__FUNCTION(noop)__}');

  expect(stringify([])).toEqual("[]");
  expect(stringify([1, 2, 3])).toEqual("[1,2,3]");
  expect(stringify([{ key: "A" }])).toEqual('[{"key":"A"}]');

  const valueA = FettleValue.readOnly("A");
  const valueB = FettleValue.readOnly("B");

  expect(stringify(valueA)).toEqual(`{"key":"A"}`);
  expect(stringify(valueB)).toEqual(`{"key":"B"}`);
  expect(stringify([valueA, valueB])).toEqual(`[{"key":"A"},{"key":"B"}]`);
});
