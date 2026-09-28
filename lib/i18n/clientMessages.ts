// Trims the full next-intl message catalog down to only the namespaces a
// given client surface actually reads via useTranslations(). The App Router
// server-side NextIntlClientProvider serializes whatever `messages` object
// it's given into every page's RSC payload — omitting `messages` entirely
// ships the WHOLE catalog (195 KB) to pages that use a handful of KB of it.
// See app/[locale]/layout.tsx and app/[locale]/(marketing)/layout.tsx.

type MessageTree = { [key: string]: MessageTree | string };

function isPlainObject(value: unknown): value is MessageTree {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge(target: MessageTree, source: MessageTree): MessageTree {
  const result: MessageTree = { ...target };
  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = result[key];
    if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
      result[key] = deepMerge(targetValue, sourceValue);
    } else {
      result[key] = sourceValue;
    }
  }
  return result;
}

/**
 * Deep-copies only the subtrees named by `paths` (dotted, e.g.
 * "marketing.terms.title") out of `messages`, merging siblings that share a
 * parent. A path with no matching key in `messages` is silently skipped —
 * callers pass a fixed key list that may not apply to every locale/catalog
 * shape.
 */
export function pickMessages(
  messages: Record<string, unknown>,
  paths: readonly string[]
): Record<string, unknown> {
  let result: MessageTree = {};

  for (const path of paths) {
    const segments = path.split(".");

    let source: unknown = messages;
    for (const segment of segments) {
      if (isPlainObject(source) && segment in source) {
        source = source[segment];
      } else {
        source = undefined;
        break;
      }
    }
    if (source === undefined) continue;

    const picked = structuredClone(source) as MessageTree | string;
    const subtree = segments
      .slice()
      .reverse()
      .reduce<MessageTree | string>((acc, segment) => ({ [segment]: acc }), picked);

    result = deepMerge(result, subtree as MessageTree);
  }

  return result;
}

// Root layout's NextIntlClientProvider wraps every route, including public
// marketing pages — so it stays minimal. Today no client component rendered
// directly by the root layout (ThemeProvider, DisableNumberInputSteppers,
// TooltipProvider, Toaster) calls useTranslations(); app/global-error.tsx is
// hardcoded English and sits outside this provider entirely. Extend this list
// if that changes.
export const ROOT_CLIENT_MESSAGE_KEYS: readonly string[] = [];

// (marketing)/layout.tsx's client tree: MarketingHeader, MarketingFooter, and
// every "use client" page under (marketing) (pricing teaser + pricing plans +
// book-demo form) plus the shared ThemeToggle/LocaleSwitcher islands they
// mount. Keep in sync with the static scan in
// app/[locale]/(marketing)/layout.test.tsx.
// marketing.terms/marketing.privacy are picked as ".title" ONLY — their body
// copy (~19 KB) is server-rendered on /terms and /privacy and must never ship
// to the client bundle.
export const MARKETING_CLIENT_MESSAGE_KEYS: readonly string[] = [
  "marketing.nav",
  "marketing.appInfo",
  "marketing.footer",
  "marketing.terms.title",
  "marketing.privacy.title",
  "marketing.pricingTeaser",
  "marketing.pricing",
  "marketing.bookDemo.form",
  "marketing.bookDemo.success",
  "marketing.bookDemo.errors",
  "plans",
  "app.theme",
  "app.settings.customize",
];
