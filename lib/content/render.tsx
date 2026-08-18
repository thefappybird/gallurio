import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";

type MDXComponents = Parameters<typeof MDXRemote>[0]["components"];

/**
 * Compiles an MDX article body to React.
 *
 * `MDXRemote` is called as a plain async function rather than as JSX so the
 * result is directly awaitable — which is what lets this be tested without a
 * server render, matching how the async page components in this repo are
 * tested.
 *
 * remark-gfm is not optional: every comparison page is built around pipe
 * tables, and @mdx-js/mdx has no table support without it.
 *
 * Components are injected by the caller rather than imported here, so this
 * module stays free of any dependency on `app/`.
 */
export async function renderContent(body: string, components: MDXComponents) {
  return MDXRemote({
    source: body,
    components,
    options: { mdxOptions: { remarkPlugins: [remarkGfm] } },
  });
}
