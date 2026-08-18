import { Suspense, type ComponentProps } from "react";
import { GallurioPrice } from "./GallurioPrice";

/**
 * Component overrides for MDX article bodies (compare + blog).
 *
 * `renderContent` calls MDXRemote as a plain async function, so the page
 * itself never touches individual `<GallurioPrice />` occurrences buried in
 * the markdown — there is no JSX tag for the page to wrap. Suspense has to
 * live here instead, wrapping only the price fetch per-occurrence, so the
 * rest of the article's prose renders immediately and isn't held up by the
 * pricing fetch (which forces dynamic rendering via headers()).
 *
 * `table` wraps every MDX table in an overflow-x-auto container — several
 * comparison tables are wide and must not push the page body sideways at
 * 375px.
 */
export function buildMdxComponents() {
  return {
    GallurioPrice: (props: ComponentProps<typeof GallurioPrice>) => (
      <Suspense fallback={<span>…</span>}>
        <GallurioPrice {...props} />
      </Suspense>
    ),
    table: (props: ComponentProps<"table">) => (
      <div className="overflow-x-auto">
        <table {...props} />
      </div>
    ),
  };
}
