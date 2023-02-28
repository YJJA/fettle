import { isPromiseLike } from "payload-is";
import PromiseAny from "promise.any";

abstract class BaseLoadable<T> {
  public abstract state: unknown;
  public abstract contents: unknown;

  public abstract getValue(): T;
  public abstract toPromise(): Promise<T>;

  public valueMaybe(): T | undefined {
    return undefined;
  }
  public valueOrThrow(): T {
    throw new Error(`Loadable expected value, but in "${this.state}" state`);
  }

  public promiseMaybe(): Promise<T> | undefined {
    return undefined;
  }
  public promiseOrThrow(): Promise<T> {
    throw new Error(`Loadable expected promise, but in "${this.state}" state`);
  }

  public errorMaybe(): any | undefined {
    return undefined;
  }
  public errorOrThrow(): any {
    throw new Error(`Loadable expected error, but in "${this.state}" state`);
  }

  public equal(other: LoadableType<any>): boolean {
    return other.state === this.state && other.contents === this.contents;
  }

  public abstract map<S>(map: (contents: T) => RawValue<S>): LoadableType<S>;
}

export class ValueLoadable<T> extends BaseLoadable<T> {
  public state: "hasValue" = "hasValue";
  public contents: T;
  constructor(contents: T) {
    super();
    this.contents = contents;
  }

  public getValue(): T {
    return this.contents;
  }
  public toPromise(): Promise<T> {
    return Promise.resolve(this.contents);
  }

  public valueMaybe() {
    return this.contents;
  }
  public valueOrThrow(): T {
    return this.contents;
  }

  public map<S>(callbackfn: (contents: T) => RawValue<S>): LoadableType<S> {
    return Loadable.run(() => callbackfn(this.contents));
  }
}

export class LoadingLoadable<T> extends BaseLoadable<T> {
  public state: "loading" = "loading";
  public contents: Promise<T>;
  constructor(contents: Promise<T>) {
    super();
    this.contents = contents;
  }

  public getValue(): T {
    throw this.contents;
  }
  public toPromise(): Promise<T> {
    return this.contents;
  }

  public promiseMaybe(): Promise<T> {
    return this.contents;
  }
  public promiseOrThrow(): Promise<T> {
    return this.contents;
  }

  public map<S>(callbackfn: (contents: T) => RawValue<S>): LoadableType<S> {
    return Loadable.of(
      this.contents.then((contents) => {
        const next = callbackfn(contents);
        if (Loadable.isLoadable(next)) {
          if (next.state === "loading") {
            return next.contents;
          } else if (next.state === "hasValue") {
            return next.contents;
          } else {
            throw next.contents;
          }
        }
        return next;
      })
    );
  }
}

export class ErrorLoadable<T> extends BaseLoadable<T> {
  public state: "hasError" = "hasError";
  public contents: any;
  constructor(contents: any) {
    super();
    this.contents = contents;
  }

  public getValue(): T {
    throw this.contents;
  }
  public toPromise(): Promise<T> {
    return Promise.reject(this.contents);
  }

  public errorMaybe() {
    return this.contents;
  }
  public errorOrThrow() {
    return this.contents;
  }

  public map<S>(_callbackfn: (contents: T) => RawValue<S>): LoadableType<S> {
    return this as unknown as LoadableType<S>;
  }
}

export type LoadableType<T> =
  | ValueLoadable<T>
  | LoadingLoadable<T>
  | ErrorLoadable<T>;

type RawValue<T> = LoadableType<T> | PromiseLike<T> | T;

type LoadableAwaited<T> = T extends LoadableType<infer R>
  ? Awaited<R>
  : Awaited<T>;

namespace Loadable {
  export function isLoadable(payload: unknown): payload is LoadableType<any> {
    return (
      payload instanceof ValueLoadable ||
      payload instanceof LoadingLoadable ||
      payload instanceof ErrorLoadable
    );
  }

  export function withValue<T>(value: T) {
    return new ValueLoadable<T>(value);
  }

  export function withPromise<T>(promise: PromiseLike<T>) {
    return new LoadingLoadable<T>(Promise.resolve(promise));
  }

  export function withError<T>(error: any) {
    return new ErrorLoadable<T>(error);
  }

  export function of<T>(value: RawValue<T>) {
    if (isLoadable(value)) {
      return value;
    }
    if (isPromiseLike(value)) {
      return withPromise(value);
    }
    return withValue(value);
  }

  export function error<T>(error: any) {
    return withError<T>(error);
  }

  export function loading<T>() {
    return withPromise<T>(new Promise(() => {}));
  }

  export function run<T>(run: () => RawValue<T>) {
    try {
      return of(run());
    } catch (errorOrPromise) {
      if (isPromiseLike(errorOrPromise)) {
        return withPromise<T>(errorOrPromise);
      }
      return withError<T>(errorOrPromise);
    }
  }

  export function map<T, S>(
    loadable: LoadableType<T>,
    callbackfn: (contents: T) => RawValue<S>
  ): LoadableType<S> {
    return loadable.map(callbackfn);
  }

  export function all<T extends readonly unknown[] | []>(
    inputs: T
  ): LoadableType<{ -readonly [P in keyof T]: LoadableAwaited<T[P]> }>;
  export function all<T>(
    inputs: Iterable<RawValue<T>>
  ): LoadableType<LoadableAwaited<T>[]>;
  export function all<T>(inputs: Iterable<RawValue<T>>) {
    const inputsArray = Array.from(inputs);
    const results: (T | PromiseLike<T>)[] = [];

    for (const input of inputsArray) {
      const loadable = of(input);
      if (loadable.state === "hasError") {
        return withError(loadable.contents);
      } else {
        results.push(loadable.contents);
      }
    }

    if (results.every((res) => !isPromiseLike(res))) {
      return withValue(results as T[]);
    }

    return withPromise(Promise.all(results));
  }

  export function allSettled<T extends readonly unknown[] | []>(
    inputs: T
  ): LoadableType<
    { -readonly [P in keyof T]: PromiseSettledResult<LoadableAwaited<T[P]>> }
  >;
  export function allSettled<T>(
    inputs: Iterable<RawValue<T>>
  ): LoadableType<PromiseSettledResult<LoadableAwaited<T>>[]>;
  export function allSettled<T>(inputs: Iterable<RawValue<T>>) {
    const inputsArray = Array.from(inputs);
    const results: (
      | PromiseSettledResult<T>
      | PromiseLike<PromiseSettledResult<T>>
    )[] = [];

    for (const input of inputsArray) {
      const loadable = of(input);
      if (loadable.state === "hasValue") {
        results.push({ status: "fulfilled", value: loadable.contents });
      } else if (loadable.state === "hasError") {
        results.push({ status: "rejected", reason: loadable.contents });
      } else {
        results.push(
          loadable.contents.then(
            (value) => ({ status: "fulfilled", value }),
            (reason) => ({ status: "rejected", reason })
          )
        );
      }
    }

    if (results.every((res) => !isPromiseLike(res))) {
      return withValue(results as PromiseSettledResult<T>[]);
    }

    return withPromise(Promise.all(results));
  }

  export function race<T extends readonly unknown[] | []>(
    inputs: T
  ): LoadableType<LoadableAwaited<T[number]>>;
  export function race<T>(
    inputs: Iterable<RawValue<T>>
  ): LoadableType<LoadableAwaited<T>>;
  export function race<T>(inputs: Iterable<RawValue<T>>) {
    const inputsArray = Array.from(inputs);
    const results: PromiseLike<T>[] = [];

    for (const input of inputsArray) {
      const loadable = of(input);
      if (loadable.state === "hasValue") {
        return withValue(loadable.contents);
      } else if (loadable.state === "hasError") {
        return withError(loadable.contents);
      } else {
        results.push(loadable.contents);
      }
    }

    return withPromise(Promise.race(results));
  }

  export function any<T extends readonly unknown[] | []>(
    inputs: T
  ): LoadableType<LoadableAwaited<T[number]>>;
  export function any<T>(
    inputs: Iterable<RawValue<T>>
  ): LoadableType<LoadableAwaited<T>>;
  export function any<T>(inputs: Iterable<RawValue<T>>) {
    const inputsArray = Array.from(inputs);
    const results: PromiseLike<T>[] = [];

    for (const input of inputsArray) {
      const loadable = of(input);
      if (loadable.state === "hasValue") {
        return withValue(loadable.contents);
      } else {
        results.push(loadable.contents);
      }
    }

    if (results.every((res) => !isPromiseLike(res))) {
      return withError<T>(results as any[]);
    }

    return withPromise(PromiseAny(results));
  }
}

export default Loadable;
