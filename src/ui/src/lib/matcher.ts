export interface SearchOptions {
  /** Treat the query as a regular expression instead of a plain substring. */
  regex: boolean;
  /** Disable the default case-insensitive matching. */
  caseSensitive: boolean;
}

export const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
  regex: false,
  caseSensitive: false,
};

export interface Matcher {
  /** Tests a candidate string against the query. */
  match: (value: string) => boolean;
  /** Compile error for an invalid regex, otherwise null. */
  error: string | null;
}

const MATCH_ALL: Matcher = { match: () => true, error: null };

/**
 * Builds a predicate for `query`. An empty query — or a regex that does not
 * compile — matches everything, so a half-typed pattern like `[a-` leaves the
 * list intact instead of emptying it; callers surface `error` to explain that
 * the filter is not being applied.
 *
 * Note that this mirrors the Go-side matcher, but the engines differ: Go uses
 * RE2 (no lookaround or backreferences), while this uses the JS engine (which
 * has them, but rejects inline flags such as `(?i)`).
 */
export function buildMatcher(query: string, options: SearchOptions): Matcher {
  if (!query) return MATCH_ALL;

  if (options.regex) {
    try {
      const re = new RegExp(query, options.caseSensitive ? "" : "i");
      return { match: (value) => re.test(value), error: null };
    } catch (err) {
      return {
        ...MATCH_ALL,
        error:
          err instanceof Error ? err.message : "Invalid regular expression",
      };
    }
  }

  if (options.caseSensitive) {
    return { match: (value) => value.includes(query), error: null };
  }

  const needle = query.toLowerCase();
  return { match: (value) => value.toLowerCase().includes(needle), error: null };
}
