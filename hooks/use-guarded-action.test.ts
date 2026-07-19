import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useGuardedAction } from "./use-guarded-action"

describe("useGuardedAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns loading=false initially", () => {
    const action = vi.fn().mockResolvedValue("ok")
    const { result } = renderHook(() => useGuardedAction(action))
    expect(result.current.loading).toBe(false)
  })

  it("sets loading=true while action is in-flight and false after", async () => {
    let resolveAction!: (v: string) => void
    const action = vi.fn(
      () => new Promise<string>((res) => { resolveAction = res })
    )
    const { result } = renderHook(() => useGuardedAction(action))

    let triggerPromise: Promise<string | undefined>
    act(() => {
      triggerPromise = result.current.trigger()
    })

    // loading should be true while promise is pending
    expect(result.current.loading).toBe(true)

    await act(async () => {
      resolveAction("done")
      await triggerPromise
    })

    expect(result.current.loading).toBe(false)
  })

  it("returns the resolved value from trigger", async () => {
    const action = vi.fn<() => Promise<string>>().mockResolvedValue("result-value")
    const { result } = renderHook(() => useGuardedAction(action))

    let returnValue: string | undefined
    await act(async () => {
      returnValue = await result.current.trigger()
    })

    expect(returnValue).toBe("result-value")
  })

  it("prevents concurrent invocations — second call while loading is a no-op", async () => {
    let resolveAction!: (v: string) => void
    const action = vi.fn(
      () => new Promise<string>((res) => { resolveAction = res })
    )
    const { result } = renderHook(() => useGuardedAction(action))

    let first: Promise<string | undefined>
    act(() => {
      first = result.current.trigger()
    })

    // Second call while loading — should be a no-op
    let secondReturn: string | undefined
    await act(async () => {
      secondReturn = await result.current.trigger()
    })
    expect(secondReturn).toBeUndefined()
    expect(action).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveAction("done")
      await first
    })
  })

  it("calls onError and does not rethrow when onError is provided", async () => {
    const error = new Error("action failed")
    const action = vi.fn<() => Promise<string>>().mockRejectedValue(error)
    const onError = vi.fn()

    const { result } = renderHook(() =>
      useGuardedAction(action, { onError })
    )

    let returnValue: string | undefined
    await act(async () => {
      returnValue = await result.current.trigger()
    })

    expect(onError).toHaveBeenCalledWith(error)
    expect(returnValue).toBeUndefined()
    expect(result.current.loading).toBe(false)
  })

  it("rethrows when no onError is provided", async () => {
    const error = new Error("boom")
    const action = vi.fn().mockRejectedValue(error)
    const { result } = renderHook(() => useGuardedAction(action))

    await expect(
      act(async () => {
        await result.current.trigger()
      })
    ).rejects.toThrow("boom")

    expect(result.current.loading).toBe(false)
  })

  it("resets loading to false even when the action throws", async () => {
    const action = vi.fn().mockRejectedValue(new Error("oops"))
    const onError = vi.fn()
    const { result } = renderHook(() =>
      useGuardedAction(action, { onError })
    )

    await act(async () => {
      await result.current.trigger()
    })

    expect(result.current.loading).toBe(false)
  })

  it("passes arguments through to the underlying action", async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useGuardedAction(action)
    )

    await act(async () => {
      await result.current.trigger("arg1", 42, true)
    })

    expect(action).toHaveBeenCalledWith("arg1", 42, true)
  })
})
