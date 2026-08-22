import * as React from "react"

const MOBILE_BREAKPOINT = 768
const DESKTOP_BREAKPOINT = 1024

// Module-scoped so useSyncExternalStore keeps a stable subscription identity
// (a new function each render would force a resubscribe).
function subscribe(onChange: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

function subscribeDesktop(onChange: () => void) {
  const mql = window.matchMedia(`(max-width: ${DESKTOP_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

export function useIsMobile() {
  // useSyncExternalStore is the SSR-safe way to read an external store: the
  // server snapshot (false) matches the client's first hydration render, after
  // which React re-renders with the real value. No hydration mismatch and no
  // setState inside an effect (which would trigger cascading renders).
  return React.useSyncExternalStore(
    subscribe,
    () => window.innerWidth < MOBILE_BREAKPOINT,
    () => false,
  )
}

// Tablet width: past the mobile sheet's breakpoint, so the docked sidebar is
// showing, but too narrow to give it a full expanded column. The sidebar
// collapses to its icon rail here (see SidebarProvider).
export function useIsBelowDesktop() {
  return React.useSyncExternalStore(
    subscribeDesktop,
    () => window.innerWidth < DESKTOP_BREAKPOINT,
    () => false,
  )
}
