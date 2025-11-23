/**
 * Atomic State Update Utility
 *
 * Prevents unnecessary re-renders by comparing old and new data before updating state.
 * This is crucial for smooth polling - even if data is fetched frequently,
 * the UI only re-renders when data actually changes.
 *
 * Usage:
 * ```typescript
 * const [data, setData] = useState(null);
 *
 * useEffect(() => {
 *   if (newData) {
 *     atomicUpdate(setData, newData);
 *   }
 * }, [newData]);
 * ```
 */

/**
 * Deep equality check using JSON serialization
 * Fast and reliable for most use cases
 */
function isEqual(a: unknown, b: unknown): boolean {
  // Handle null/undefined
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a === undefined || b === undefined) return false;

  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch (error) {
    // Fallback to reference equality if JSON.stringify fails
    console.warn('atomicUpdate: JSON.stringify failed, using reference equality', error);
    return a === b;
  }
}

/**
 * Atomically update state only if data has changed
 * Prevents re-renders when polling returns identical data
 */
export function atomicUpdate<T>(
  setter: React.Dispatch<React.SetStateAction<T>>,
  nextData: T
): void {
  setter(prevData => {
    // If data hasn't changed, return previous data to prevent re-render
    if (isEqual(prevData, nextData)) {
      return prevData;
    }
    // Data changed, update state
    return nextData;
  });
}

/**
 * Hook version for easier usage
 * Returns a setter that automatically does atomic updates
 */
export function useAtomicState<T>(
  initialValue: T
): [T, (newValue: T) => void] {
  const [state, setState] = React.useState<T>(initialValue);

  const atomicSetter = React.useCallback((newValue: T) => {
    atomicUpdate(setState, newValue);
  }, []);

  return [state, atomicSetter];
}

// For standalone usage without React
import React from 'react';
