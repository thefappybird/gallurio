import { type ReactElement, type ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { GalleryQueryProvider } from "@/lib/page-builder/galleryPicker/GalleryQueryProvider";

type Messages = typeof enMessages;

// Every renderWithProviders() tree gets a fresh GalleryQueryProvider (own
// QueryClient + workspaceId context) so gallery-picker components
// (usePickerData/MediaPicker and friends) work in isolation without every
// test file wiring its own provider. Harmless for tests that never touch
// react-query. Override `workspaceId` only for tenant-isolation assertions.
const DEFAULT_TEST_WORKSPACE_ID = "ws-test";

function Providers({
  children,
  locale = "en",
  messages = enMessages as Messages,
  workspaceId = DEFAULT_TEST_WORKSPACE_ID,
}: {
  children: ReactNode;
  locale?: string;
  messages?: Messages;
  workspaceId?: string;
}) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <GalleryQueryProvider workspaceId={workspaceId}>{children}</GalleryQueryProvider>
    </NextIntlClientProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options: { locale?: string; messages?: Messages; workspaceId?: string } & Omit<RenderOptions, "wrapper"> = {}
) {
  const { locale, messages, workspaceId, ...rtl } = options;
  return render(ui, {
    wrapper: ({ children }) => (
      <Providers locale={locale} messages={messages} workspaceId={workspaceId}>
        {children}
      </Providers>
    ),
    ...rtl,
  });
}

export { enMessages };
