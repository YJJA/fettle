import { isNil } from "payload-is";
import FettleValue from "../adt/FettleValue";
import FettleError from "../adt/FettleError";

import type {
  FettleValueType,
  ReadOnlyFettleValue,
  ReadWriteFettleValue,
} from "../adt/FettleValue";
import type { LoadableType } from "../adt/Loadable";
import type { DefaultValueType } from "../adt/DefaultValue";
import type { StoreType } from "../core/FettleStore";
import type { FettleKey } from "../types";

export type NodeWrites = Map<FettleKey, LoadableType<any>>;

export interface ReadOnlyFettleNode<T> {
  key: FettleKey;
  type: "atom" | "selector";
  init: (store: StoreType) => () => void;
  get: (store: StoreType) => LoadableType<T>;
  invalidate?: (store: StoreType) => void;
  clearCache?: (store: StoreType) => void;
}

export interface ReadWriteFettleNode<T> extends ReadOnlyFettleNode<T> {
  set: (store: StoreType, value: T | DefaultValueType) => NodeWrites;
}

export type FettleNodeType<T> = ReadOnlyFettleNode<T> | ReadWriteFettleNode<T>;

namespace FettleNode {
  const nodeMap = new Map<string, FettleNodeType<any>>();
  const valueMap = new Map<string, FettleValueType<any>>();

  export function registerNode<T>(
    node: ReadWriteFettleNode<T>
  ): ReadWriteFettleValue<T>;
  export function registerNode<T>(
    node: ReadOnlyFettleNode<T>
  ): ReadOnlyFettleValue<T>;
  export function registerNode<T>(node: FettleNodeType<T>): FettleValueType<T> {
    if (nodeMap.has(node.key)) {
      console.log(`Duplicate atom key "${node.key}"`);
    }
    nodeMap.set(node.key, node);
    const value: FettleValueType<T> =
      "set" in node
        ? FettleValue.readWrite<T>(node.key)
        : FettleValue.readOnly<T>(node.key);

    valueMap.set(node.key, value);
    return value;
  }

  export function getNode<T>(key: FettleKey) {
    const node = (nodeMap as Map<string, FettleNodeType<T>>).get(key);
    if (isNil(node)) {
      throw FettleError.nodeMissing(
        `Missing definition for FettleValue: "${key}""`
      );
    }
    return node;
  }

  export function getNodeMaybe<T>(key: FettleKey) {
    return (nodeMap as Map<string, FettleNodeType<T>>).get(key);
  }
}

export default FettleNode;
