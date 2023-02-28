import { act } from "react-dom/test-utils";

export function flushPromisesAndTimers(): Promise<void> {
  // Wrap flush with act() to avoid warning that only shows up in OSS environment
  return act(
    () =>
      new Promise((resolve) => {
        window.setTimeout(resolve, 100);
      })
  );
}
