import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

// next/navigation's useRouter throws when used outside a Next.js runtime — tests
// that need it stub via vi.mock at the file level. Same for next-intl's
// useTranslations (use the helper in test-utils/render.tsx instead of mocking).
