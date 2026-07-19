import { useState, useCallback, useRef, useEffect } from "react"

type GuardedActionOptions = {
  /** Called when the action throws or rejects. Defaults to re-throwing. */
  onError?: (error: unknown) => void
}

type GuardedActionReturn<TArgs extends unknown[], TResult> = {
  /** True while the guarded action is in-flight. */
  loading: boolean
  /** Invoke the guarded action. Subsequent calls while loading are no-ops. */
  trigger: (...args: TArgs) => Promise<TResult | undefined>
}

/**
 * Wraps an async action so it:
 *  - tracks its own `loading` state
 *  - prevents concurrent invocations (no-ops if already in-flight)
 *  - optionally swallows errors via `onError`
 */
function useGuardedAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  options?: GuardedActionOptions
): GuardedActionReturn<TArgs, TResult> {
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)
  const onErrorRef = useRef(options?.onError)
  // Keep the latest onError reachable from the stable `trigger` closure without
  // making it a dependency. Synced after commit (not during render) per the
  // rules of refs.
  useEffect(() => {
    onErrorRef.current = options?.onError
  })

  const trigger = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      if (loadingRef.current) return undefined
      loadingRef.current = true
      setLoading(true)
      try {
        return await action(...args)
      } catch (error) {
        if (onErrorRef.current) {
          onErrorRef.current(error)
          return undefined
        }
        throw error
      } finally {
        loadingRef.current = false
        setLoading(false)
      }
    },
    [action]
  )

  return { loading, trigger }
}

export { useGuardedAction }
export type { GuardedActionReturn, GuardedActionOptions }
