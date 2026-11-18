import { geodat } from "../wailsjs/go/models";

export function entryKey(entry: Pick<geodat.Entry, "type" | "value">): string {
  return `${entry.type}:${entry.value}`;
}

export const GEOSITE_TEXT_TYPES = [
  "domain",
  "full",
  "keyword",
  "regexp",
  "include",
];
