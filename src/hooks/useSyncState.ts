import { useCallback, useEffect, useRef, useState } from 'react'

type UseSyncStateOptions<T> = {
  globalValue: T | undefined
  setGlobalValue: (value: T) => void
  defaultValue: T
  debounceMs?: number
}

/**
 * Custom hook for bidirectional sync between local and global state.
 *
 * Local state updates immediately (for responsive UI). Syncing to global state
 * can be immediate or debounced based on `debounceMs`:
 * - `debounceMs = 0` (default): Immediate sync
 * - `debounceMs > 0`: Debounced sync (useful for sliders, batch compression)
 *
 * Global state changes sync back to local state immediately, but changes initiated
 * by this hook won't trigger a re-sync (to avoid loops).
 *
 * @param options - Configuration options
 * @returns [localValue, setLocalValue] tuple similar to useState
 */
export function useSyncState<T>({
  globalValue,
  setGlobalValue,
  defaultValue,
  debounceMs = 0,
}: UseSyncStateOptions<T>) {
  const [localValue, setLocalValue] = useState<T>(globalValue ?? defaultValue)

  const isUpdatingRef = useRef(false)
  const debounceTimerRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (!isUpdatingRef.current && globalValue !== undefined) {
      setLocalValue(globalValue)
    }
  }, [globalValue])

  useEffect(() => {
    if (debounceMs === 0) {
      isUpdatingRef.current = true
      setGlobalValue(localValue)
      setTimeout(() => {
        isUpdatingRef.current = false
      }, 0)
      return
    }

    debounceTimerRef.current = setTimeout(() => {
      isUpdatingRef.current = true
      setGlobalValue(localValue)
      setTimeout(() => {
        isUpdatingRef.current = false
      }, 0)
    }, debounceMs)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [localValue, setGlobalValue, debounceMs])

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setLocalValue((prev) => {
      if (typeof value === 'function') {
        return (value as (prev: T) => T)(prev)
      }
      return value
    })
  }, [])

  return [localValue, setValue] as const
}
