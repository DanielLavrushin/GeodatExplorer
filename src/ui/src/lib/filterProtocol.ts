import { SearchOptions } from "./matcher";

/** Main thread -> worker. Values are pushed once, then reused per filter. */
export type FilterRequest =
  | { kind: "values"; values: string[] }
  | { kind: "filter"; id: number; query: string; options: SearchOptions };

/** Worker -> main thread. `indices` points into the last pushed values. */
export interface FilterResponse {
  kind: "result";
  id: number;
  indices: Int32Array;
}
