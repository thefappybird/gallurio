"use client";

import dynamic from "next/dynamic";

/**
 * The toolbar's three sheets (CSV importer + mapping dialogs, export, invoice
 * theme) are only needed once a user opens one, so each loads as its own chunk
 * on demand. The toolbar mounts them only while open; the triggers stay static
 * and warm the chunk on pointer-enter / focus.
 */
export const ImportSheetLazy = dynamic(
  () => import("./import-sheet").then((m) => m.ImportSheet),
  { ssr: false }
);
export const BookingsExportDialogLazy = dynamic(
  () => import("./bookings-export-dialog").then((m) => m.BookingsExportDialog),
  { ssr: false }
);
export const InvoiceThemeDialogLazy = dynamic(
  () => import("./invoice-theme-dialog").then((m) => m.InvoiceThemeDialog),
  { ssr: false }
);

export function preloadImportSheet(): void {
  void import("./import-sheet");
}
export function preloadExportDialog(): void {
  void import("./bookings-export-dialog");
}
export function preloadInvoiceThemeDialog(): void {
  void import("./invoice-theme-dialog");
}
