import { type ReactElement, type ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";

type Messages = typeof enMessages;

function Providers({
  children,
  locale = "en",
  messages = enMessages as Messages,
}: {
  children: ReactNode;
  locale?: string;
  messages?: Messages;
}) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options: { locale?: string; messages?: Messages } & Omit<RenderOptions, "wrapper"> = {}
) {
  const { locale, messages, ...rtl } = options;
  return render(ui, {
    wrapper: ({ children }) => (
      <Providers locale={locale} messages={messages}>
        {children}
      </Providers>
    ),
    ...rtl,
  });
}

export { enMessages };
