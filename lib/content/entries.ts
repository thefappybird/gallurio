import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { z } from "zod";

export const CONTENT_KINDS = ["blog", "compare"] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

// YAML parses an unquoted 2026-08-18 into a Date, so accept both and normalise
// to the ISO day string the sitemap and <time> elements want.
const isoDay = z
  .union([z.string(), z.date()])
  .transform((value) => (value instanceof Date ? value.toISOString().slice(0, 10) : value))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD"));

// Frontmatter is hand-authored in .mdx files, so it is a boundary like any
// other input and gets parsed rather than trusted.
const frontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  publishedAt: isoDay,
  updatedAt: isoDay.optional(),
  // Comparison pages only. `category` groups them on the /compare index.
  competitor: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  // Editorial summary fields used by comparison verdict strips.
  bestFor: z.string().min(1).optional(),
  notFor: z.string().min(1).optional(),
  faq: z
    .array(z.object({ question: z.string().min(1), answer: z.string().min(1) }))
    .optional(),
  // Shot ids are declared in each article's frontmatter.
  screenshots: z.array(z.string().min(1)).optional(),
  // Optional YouTube embed seam. Articles remain valid before the final
  // video is uploaded; adding the id later enables the shared player.
  youtubeId: z.string().regex(/^[A-Za-z0-9_-]{6,20}$/).optional(),
  videoTitle: z.string().min(1).optional(),
  videoCaption: z.string().min(1).optional(),
});

export type ContentEntry = z.infer<typeof frontmatterSchema> & {
  kind: ContentKind;
  slug: string;
  body: string;
};

export function parseEntry(kind: ContentKind, slug: string, raw: string): ContentEntry {
  const { data, content } = matter(raw);
  const parsed = frontmatterSchema.safeParse(data);

  if (!parsed.success) {
    // Thrown at build time, where a broken page is better loud than silently
    // absent from the sitemap.
    throw new Error(
      `Invalid frontmatter in content/${kind}/${slug}.mdx: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"} ${issue.message}`)
        .join("; ")}`
    );
  }

  return { ...parsed.data, kind, slug, body: content };
}

export function listEntries(kind: ContentKind): ContentEntry[] {
  const dir = join(process.cwd(), "content", kind);
  const names = readdirSync(dir);

  return names.map((name) =>
    parseEntry(kind, name.slice(0, -".mdx".length), readFileSync(join(dir, name), "utf8"))
  );
}

export function getEntry(kind: ContentKind, slug: string): ContentEntry | null {
  return listEntries(kind).find((entry) => entry.slug === slug) ?? null;
}
