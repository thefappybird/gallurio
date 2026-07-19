"use client";

import { createUsePuck } from "@measured/puck";

/**
 * Shared createUsePuck instance for all page-builder components.
 * Call with a selector to subscribe to only the slice you need:
 *
 *   const appState = usePuckStore(s => s.appState);
 *   const dispatch = usePuckStore(s => s.dispatch);
 *
 * Stable API members (dispatch, getSelectorForId, getItemById, …) do NOT
 * cause re-renders when selected individually because Puck keeps them
 * referentially stable across renders.
 */
export const usePuckStore = createUsePuck();
