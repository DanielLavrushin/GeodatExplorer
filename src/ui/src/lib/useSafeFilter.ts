import { useEffect, useMemo, useRef, useState } from "react";
import { buildMatcher, SearchOptions } from "./matcher";
import type { FilterRequest, FilterResponse } from "./filterProtocol";

/** How long a regex may run before its worker is considered stuck. */
const TIMEOUT_MS = 1000;

const SLOW_PATTERN_ERROR =
  "Pattern is too slow to evaluate — avoid nested quantifiers such as (.+)+";

export interface FilterResult {
  /** Indices of matching values, or null meaning "everything matches". */
  indices: Int32Array | null;
  error: string | null;
}

const ALL: FilterResult = { indices: null, error: null };

/**
 * Filters `values` by `query`.
 *
 * Plain substring matching is linear and stays on the UI thread. Regex matching
 * is delegated to a worker, because a valid-but-pathological pattern can take
 * exponential time and JavaScript offers no way to abort a running match — if
 * the worker does not answer within {@link TIMEOUT_MS} it is terminated and the
 * caller is handed an error instead of a frozen window.
 */
export function useSafeFilter(
  values: string[],
  query: string,
  options: SearchOptions,
): FilterResult {
  const workerRef = useRef<Worker | null>(null);
  const sentValuesRef = useRef<string[] | null>(null);
  const requestIdRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const [result, setResult] = useState<{
    values: string[];
    indices: Int32Array;
  } | null>(null);
  const [slowError, setSlowError] = useState<string | null>(null);

  // Compiling is safe on this thread: only matching can backtrack.
  const { match, error: compileError } = useMemo(
    () => buildMatcher(query, options),
    [query, options],
  );

  const useWorker = !!query && options.regex && !compileError;

  useEffect(() => {
    if (!useWorker) {
      setSlowError(null);
      return;
    }

    if (!workerRef.current) {
      const worker = new Worker(
        new URL("./filter.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.onmessage = (event: MessageEvent<FilterResponse>) => {
        const message = event.data;
        if (message.id !== requestIdRef.current) return; // superseded
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        setResult({
          values: sentValuesRef.current ?? [],
          indices: message.indices,
        });
        setSlowError(null);
      };
      workerRef.current = worker;
      sentValuesRef.current = null;
    }

    const worker = workerRef.current;
    if (sentValuesRef.current !== values) {
      worker.postMessage({ kind: "values", values } satisfies FilterRequest);
      sentValuesRef.current = values;
    }

    // Deliberately no "pending" state update here: a re-render at this point
    // would repaint the whole list and delay the watchdog timer below.
    const id = ++requestIdRef.current;
    setSlowError(null);
    worker.postMessage({
      kind: "filter",
      id,
      query,
      options,
    } satisfies FilterRequest);

    timerRef.current = window.setTimeout(() => {
      // The thread is wedged inside RegExp.test; killing it is the only exit.
      worker.terminate();
      workerRef.current = null;
      sentValuesRef.current = null;
      requestIdRef.current++;
      timerRef.current = null;
      setSlowError(SLOW_PATTERN_ERROR);
    }, TIMEOUT_MS);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [useWorker, values, query, options]);

  // Tear the worker down with the component.
  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  const syncIndices = useMemo(() => {
    if (!query || compileError || options.regex) return null;
    const hits: number[] = [];
    for (let i = 0; i < values.length; i++) {
      if (match(values[i])) hits.push(i);
    }
    return Int32Array.from(hits);
  }, [values, query, options.regex, compileError, match]);

  return useMemo(() => {
    if (compileError) return { indices: null, error: compileError };
    if (!query) return ALL;
    if (!options.regex) return { indices: syncIndices, error: null };
    if (slowError) return { indices: null, error: slowError };
    // Results are dropped when the underlying values change, so a stale index
    // set can never be mapped against a different list.
    const usable = result?.values === values ? result.indices : null;
    return { indices: usable, error: null };
  }, [compileError, query, options.regex, syncIndices, slowError, result, values]);
}
