import { useEffect, useState } from "react";

/**
 * Returns `value` after it has stopped changing for `delay` ms. Used to keep
 * typing responsive when each keystroke would otherwise re-scan a large entry
 * list with a freshly compiled regex.
 */
export function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
