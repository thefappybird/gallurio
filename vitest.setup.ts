import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

// happy-dom >= 20.14 implements Element.getAnimations, which moves Base UI's
// popup unmount behind an animation frame; tests that assert a closed
// dialog/listbox is gone would then race it. Base UI's own switch restores the
// synchronous unmount.
(globalThis as { BASE_UI_ANIMATIONS_DISABLED?: boolean }).BASE_UI_ANIMATIONS_DISABLED = true;

// next/navigation's useRouter throws when used outside a Next.js runtime — tests
// that need it stub via vi.mock at the file level. Same for next-intl's
// useTranslations (use the helper in test-utils/render.tsx instead of mocking).
