import type { TestingLibraryMatchers } from "@types/testing-library__jest-dom/matchers";

declare module "@jest/expect" {
  export interface Matchers<R = void, T = {}>
    extends TestingLibraryMatchers<typeof expect.stringContaining, R> {}
}

import type { JestExpect } from "@jest/expect";
export declare const expect: JestExpect;
