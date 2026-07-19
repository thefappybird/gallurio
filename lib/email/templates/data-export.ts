export function buildDataExportEmailBody({
  workspaceName,
}: {
  workspaceName: string;
}): string {
  return [
    `Hi,`,
    ``,
    `Your workspace data export for "${workspaceName}" is ready.`,
    ``,
    `Three CSV files are attached to this email:`,
    `  • bookings.csv  — all bookings`,
    `  • clients.csv   — all clients`,
    `  • inquiries.csv — all inquiry submissions`,
    ``,
    `You can open these in any spreadsheet application.`,
    ``,
    `— Gallurio`,
  ].join("\n");
}
