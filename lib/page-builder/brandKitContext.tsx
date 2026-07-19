"use client";

/**
 * Brand-kit React context for portfolio public pages.
 *
 * - BrandKitProvider  — wraps the public-page subtree; injects the kit.
 * - useBrandKit       — hook for blocks to read kit values.
 *
 * Server-safe helpers (resolveBrandKit, ResolvedBrandKit) live in
 * ./resolveBrandKit — import from there when no React context is needed.
 */

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import type { PortfolioBrandKit } from "./types";
import { DEFAULT_BRAND_KIT } from "./types";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const BrandKitContext = createContext<PortfolioBrandKit | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export type BrandKitProviderProps = {
  brandKit?: PortfolioBrandKit;
  children: ReactNode;
};

/**
 * Wraps the public-page subtree and injects the workspace's brand kit.
 * Falls back to DEFAULT_BRAND_KIT when no kit is provided.
 */
export function BrandKitProvider({ brandKit = DEFAULT_BRAND_KIT, children }: BrandKitProviderProps) {
  return (
    <BrandKitContext.Provider value={brandKit}>
      {children}
    </BrandKitContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns the current workspace's PortfolioBrandKit.
 * Throws if called outside a <BrandKitProvider>.
 */
export function useBrandKit(): PortfolioBrandKit {
  const kit = useContext(BrandKitContext);
  if (kit === null) {
    throw new Error(
      "useBrandKit must be used inside a <BrandKitProvider>. " +
        "Wrap your public page root with <BrandKitProvider brandKit={...}>."
    );
  }
  return kit;
}
