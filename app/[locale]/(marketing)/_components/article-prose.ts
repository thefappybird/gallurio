// Descendant-selector styling for MDX article bodies, which render as plain
// HTML elements (no library-provided classes — this repo has no
// @tailwindcss/typography). Scoped to the wrapper this class sits on.
export const ARTICLE_PROSE_CLASS = [
  "max-w-none text-start text-base leading-7 text-foreground",
  "[&>p]:mt-4 [&>p:first-child]:mt-0",
  "[&_h2]:mt-10 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight",
  "[&_h3]:mt-8 [&_h3]:font-heading [&_h3]:text-lg [&_h3]:font-semibold",
  "[&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:ps-5",
  "[&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:ps-5",
  "[&_li]:leading-7",
  "[&_a]:text-brand [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:no-underline",
  "[&_strong]:font-semibold [&_strong]:text-foreground",
  "[&_code]:rounded-[var(--radius)] [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm",
  "[&_blockquote]:mt-6 [&_blockquote]:border-s-2 [&_blockquote]:border-brand [&_blockquote]:ps-4 [&_blockquote]:text-muted-foreground",
  "[&_table]:w-full [&_table]:border-collapse [&_table]:text-sm",
  "[&_th]:border-b [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:text-start [&_th]:font-semibold",
  "[&_td]:border-b [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:align-top",
].join(" ");
