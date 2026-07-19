import { describe, it, expect } from "vitest";
import { View, Image } from "@react-pdf/renderer";
import { DocumentFooter, DocumentHeader, buildInvoiceStyles } from "./pdfShared";

function collectElements(node: unknown, out: Array<{ type: unknown; props: Record<string, unknown> }> = []) {
  if (node == null || typeof node === "boolean") return out;
  if (Array.isArray(node)) {
    node.forEach((n) => collectElements(n, out));
    return out;
  }
  if (typeof node === "object" && "type" in (node as Record<string, unknown>) && "props" in (node as Record<string, unknown>)) {
    const el = node as { type: unknown; props: Record<string, unknown> };
    out.push(el);
    collectElements(el.props.children, out);
  }
  return out;
}

const styles = buildInvoiceStyles({ main: "#0F1B33", accent: "#C9A24B" });
const business = { name: "Studio Aperture", logoUrl: "https://cdn.test/logo.png", address: "123 Main St" };

describe("DocumentHeader", () => {
  it("renders the logo and business name inside a row View (side by side, not stacked)", () => {
    const element = DocumentHeader({ kind: "invoice", business, number: "INV-1", date: new Date("2026-01-01"), locale: "en-PH", styles });
    const all = collectElements(element);
    const rowView = all.find((el) => el.type === View && Array.isArray(el.props.style) && el.props.style.includes(styles.logoRow));
    expect(rowView).toBeDefined();
    const rowChildren = collectElements(rowView!.props.children);
    expect(rowChildren.some((el) => el.type === Image)).toBe(true);
  });

  it("reverses the row direction for an Arabic locale", () => {
    const ltr = DocumentHeader({ kind: "invoice", business, number: "INV-1", date: new Date("2026-01-01"), locale: "en-PH", styles });
    const rtl = DocumentHeader({ kind: "invoice", business, number: "INV-1", date: new Date("2026-01-01"), locale: "ar-SA", styles });
    const findRowStyle = (element: unknown) =>
      collectElements(element).find((el) => el.type === View && Array.isArray(el.props.style) && el.props.style.includes(styles.logoRow))
        ?.props.style as Array<Record<string, unknown>>;
    expect(findRowStyle(ltr)?.[1]?.flexDirection).toBe("row");
    expect(findRowStyle(rtl)?.[1]?.flexDirection).toBe("row-reverse");
  });

  it("constrains long business addresses so the right-side document label remains separate", () => {
    const element = DocumentFooter({
      business: { address: "A very long business address that should wrap inside the footer without colliding with the thank you label", email: "owner@example.com" },
      styles,
    });
    const all = collectElements(element);
    const footerLeft = all.find(
      (el) => el.type === View && el.props.style === styles.footerLeft,
    );
    const footerRight = all.find(
      (el) => el.type === View && el.props.style === styles.headerRight,
    );

    expect(footerLeft).toBeDefined();
    expect(styles.footerLeft).toMatchObject({ flexGrow: 1, flexBasis: 0, flexShrink: 1 });
    expect(styles.headerRight).toMatchObject({ flexShrink: 0 });
    expect(footerRight).toBeDefined();
  });
});
