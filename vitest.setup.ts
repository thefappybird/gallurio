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

// happy-dom's Animation.cancel rejects `finished` without marking it handled
// (the Web Animations spec marks it handled), so every motion/react animation
// cancelled mid-test would surface as an unhandled AbortError.
if (typeof Animation !== "undefined") {
  const cancel = Animation.prototype.cancel;
  Animation.prototype.cancel = function (this: Animation) {
    this.finished.catch(() => {});
    return cancel.call(this);
  };
}

// next/navigation's useRouter throws when used outside a Next.js runtime — tests
// that need it stub via vi.mock at the file level. Same for next-intl's
// useTranslations (use the helper in test-utils/render.tsx instead of mocking).
