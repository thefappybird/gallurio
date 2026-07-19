import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware Link / redirect / useRouter / getPathname. Import these instead
// of next/link / next/navigation in pages under app/[locale]/. They wrap the
// vanilla Next.js APIs with the active locale so /dashboard becomes
// /fil/dashboard automatically for non-default locales.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
