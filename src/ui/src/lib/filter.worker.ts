import { buildMatcher } from "./matcher";
import type { FilterRequest, FilterResponse } from "./filterProtocol";

/**
 * Regex matching runs here rather than on the UI thread. A pattern with nested
 * quantifiers (`(.+)+x`) backtracks exponentially and cannot be interrupted
 * once `RegExp.test` is running, so the only way to recover is to terminate the
 * thread it occupies — which the main thread does on timeout.
 */

// The project's tsconfig ships the DOM lib rather than WebWorker, so the worker
// globals are reached through a narrow cast instead of DedicatedWorkerGlobalScope.
const scope = globalThis as unknown as {
  addEventListener: (
    type: "message",
    listener: (event: MessageEvent<FilterRequest>) => void,
  ) => void;
  postMessage: (message: FilterResponse, transfer?: Transferable[]) => void;
};

let values: string[] = [];

scope.addEventListener("message", (event) => {
  const message = event.data;

  if (message.kind === "values") {
    values = message.values;
    return;
  }

  const { match } = buildMatcher(message.query, message.options);
  const hits: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (match(values[i])) hits.push(i);
  }

  const indices = Int32Array.from(hits);
  scope.postMessage({ kind: "result", id: message.id, indices }, [
    indices.buffer,
  ]);
});
