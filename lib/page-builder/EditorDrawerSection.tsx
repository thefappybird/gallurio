"use client";

import { Children, cloneElement, Fragment, isValidElement, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * EditorDrawerSection — a single collapsible section for the editor side-panel.
 *
 * Use inside EditorDrawerGroup so the group draws the outer border and dividers.
 * This section has NO own outer border — the group owns the frame.
 *
 * When `flat` is true (set automatically by EditorDrawerGroup when only one
 * section is present) the section renders its children directly with no
 * collapsible button or chevron. A static non-interactive title label is still
 * rendered for visual context.
 */
export function EditorDrawerSection({
  title,
  defaultOpen = false,
  flat = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  flat?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (flat) {
    return (
      <div>
        <div className="flex min-h-11 items-center px-3">
          <span className="text-xs font-medium uppercase tracking-wide text-foreground">{title}</span>
        </div>
        <div className="flex flex-col gap-3 p-3">{children}</div>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center justify-between px-3 text-left text-xs font-medium uppercase tracking-wide text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <span>{title}</span>
        <ChevronDown
          className={cn("size-3.5 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && <div className="flex flex-col gap-3 p-3">{children}</div>}
    </div>
  );
}

/**
 * EditorDrawerGroup — wraps EditorDrawerSection children with a single outer
 * border and hairline dividers between sections (flush, Puck-style stacking).
 *
 * No gap between sections — the group is a continuous bordered block.
 *
 * Automatic behavior:
 * - 1 real section child → cloned with `flat` (no accordion button, always expanded).
 * - 2+ real section children → first section cloned with `defaultOpen={true}`,
 *   rest left as-is (closed by default). Relies on tab bodies remounting on
 *   tab switch (rendered with `{activeTab === "x" && ...}`) so `defaultOpen`
 *   resets correctly when a tab is revisited.
 *
 * Fragments are flattened so `<>...</>` wrapping two sections still counts
 * as two separate sections.
 */
export function EditorDrawerGroup({
  children,
  plain = false,
}: {
  children: React.ReactNode;
  /**
   * When true, render the classic accordion: every section is a collapsible
   * drawer, all closed by default, with no single-section flattening. Used by
   * the Header/Contact config panels which intentionally start fully collapsed.
   * The default (false) applies the block-property-tab behavior: flatten a lone
   * section and auto-open the first of several.
   */
  plain?: boolean;
}) {
  if (plain) {
    return <div className="border border-border divide-y divide-border">{children}</div>;
  }

  const sections = flattenSectionChildren(children);
  const count = sections.length;

  let rendered: React.ReactNode;
  if (count === 1) {
    rendered = cloneSection(sections[0], { flat: true });
  } else if (count > 1) {
    rendered = sections.map((child, i) =>
      cloneElement(child as React.ReactElement<Record<string, unknown>>, {
        key: i,
        ...(i === 0 ? { defaultOpen: true } : {}),
      })
    );
  } else {
    rendered = children;
  }

  return (
    <div className="border border-border divide-y divide-border">{rendered}</div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collect all EditorDrawerSection elements, flattening React fragments. */
function flattenSectionChildren(node: React.ReactNode): React.ReactElement[] {
  const result: React.ReactElement[] = [];

  Children.forEach(node, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === Fragment) {
      result.push(
        ...flattenSectionChildren(
          (child as React.ReactElement<{ children?: React.ReactNode }>).props.children
        )
      );
      return;
    }
    if (child.type === EditorDrawerSection) {
      result.push(child);
    }
  });

  return result;
}

function cloneSection(
  el: React.ReactElement,
  overrides: { flat?: boolean; defaultOpen?: boolean }
): React.ReactElement {
  return cloneElement(el as React.ReactElement<Record<string, unknown>>, overrides);
}
