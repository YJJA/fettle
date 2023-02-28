import {
  isFunction,
  isIterable,
  isNull,
  isObject,
  isPromiseLike,
} from "payload-is";
import type { HasToJSON } from "../types";

function hasToJSON(payload: unknown): payload is HasToJSON<any> {
  return (
    (isObject(payload) || isFunction(payload)) &&
    isFunction((payload as HasToJSON<any>).toJSON)
  );
}

export function stringify(payload: unknown): string {
  // "string" | "number" | "bigint" | "boolean" | "symbol" | "undefined" | "object" | "function"
  switch (typeof payload) {
    case "undefined": {
      return "";
    }
    case "boolean": {
      return payload ? "true" : "false";
    }
    case "number":
    case "symbol":
    case "bigint": {
      return String(payload);
    }
    case "string": {
      if (!payload.includes('"') && !payload.includes("\\")) {
        return `"${payload}"`;
      }
      return JSON.stringify(payload);
    }
    case "function":
    case "object": {
      if (isNull(payload)) {
        return "null";
      }

      if (hasToJSON(payload)) {
        return stringify(payload.toJSON());
      }

      if (isIterable(payload)) {
        return `[${Array.from(payload).map((v) => stringify(v))}]`;
      }

      if (isPromiseLike(payload)) {
        return `__PROMISE__`;
      }

      if (isFunction(payload)) {
        return `__FUNCTION(${payload.name})__`;
      }

      return `{${Object.keys(payload)
        .sort()
        .map(
          (key) => `${stringify(key)}:${stringify((payload as any)[key])}`
        )}}`;
    }
    default: {
      return JSON.stringify(payload) ?? "";
    }
  }
}
