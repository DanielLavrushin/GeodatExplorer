import { geodat } from "../wailsjs/go/models";

/**
 * Identity of a rule within a category: its type and value. Two rules that
 * share a value but differ in type (domain:x vs full:x) are distinct.
 * Must match entryKey in src/geodat/helpers.go, which reads these keys back
 * when exporting.
 */
export function entryKey(entry: Pick<geodat.Entry, "type" | "value">): string {
  return `${entry.type}:${entry.value}`;
}

/** Rule types a geosite text-mode line may be prefixed with. */
export const GEOSITE_TEXT_TYPES = [
  "domain",
  "full",
  "keyword",
  "regexp",
  "include",
];
