import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

export type StoredValueValidator<T> = (value: unknown) => value is T

/**
 * Reads a JSON value from localStorage. Returns `initialValue` when the key is
 * missing, unparsable, unavailable, or rejected by `validate`.
 */
export function readStoredValue<T>(key: string, initialValue: T, validate?: StoredValueValidator<T>): T {
  try {
    const stored = window.localStorage.getItem(key)
    if (stored === null) return initialValue
    const parsed: unknown = JSON.parse(stored)
    if (validate) return validate(parsed) ? parsed : initialValue
    return parsed === null || parsed === undefined ? initialValue : (parsed as T)
  } catch {
    // Storage can be unavailable in private mode; fall back to the in-memory value.
    return initialValue
  }
}

export function useStoredState<T>(
  key: string,
  initialValue: T,
  validate?: StoredValueValidator<T>,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readStoredValue(key, initialValue, validate))

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Ignore storage quota/permission failures.
    }
  }, [key, value])

  return [value, setValue]
}

/** Validator helpers. */
export const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'

export function isOneOf<T extends string>(options: readonly T[]): StoredValueValidator<T> {
  return (value: unknown): value is T => typeof value === 'string' && (options as readonly string[]).includes(value)
}

export function isFiniteInRange(min: number, max: number): StoredValueValidator<number> {
  return (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}
