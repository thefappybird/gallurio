/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node CommonJS QA utility. */
// Generates import QA fixtures. Usage: node gen-import-qa.js <repoRoot> <outDir>
const fs = require("fs");
const path = require("path");
const [repo, out] = process.argv.slice(2).map((p) => path.resolve(p));
const ExcelJS = require(path.join(repo, "node_modules", "exceljs"));
fs.mkdirSync(out, { recursive: true });
const w = (name, data) => fs.writeFileSync(path.join(out, name), data);
const q = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const csv = (rows) => rows.map((r) => r.map(q).join(",")).join("\r\n") + "\r\n";
const rand = (n) => Array.from({ length: n }, () => "abcdefghijklmnopqrstuvwxyz0123456789 "[Math.floor(Math.random() * 37)]).join("");

const TEMPLATE = ["title", "clientName", "clientEmail", "clientPhone", "startAt", "endAt", "eventType", "status", "amountTotal", "amountDeposit", "currency", "locationAddress", "notes"];
const stamp = Date.now().toString(36);

// 1. Happy: our own vocabulary, should skip straight to the preview.
w("01-happy-template.csv", csv([
  TEMPLATE,
  ...[1, 2, 3, 4, 5].map((i) => [
    `QA-IMP Happy ${i}`, `QA Happy Client ${i}`, `qa-imp-${stamp}-h${i}@example.test`, `+63917000000${i}`,
    `2031-07-0${i} 14:00`, `2031-07-0${i} 18:00`, "wedding", "booked", "50000", "10000", "PHP", "Tagaytay", "Happy path row",
  ]),
]));

// 3. Semicolon-delimited (European Excel "CSV").
w("03-semicolon.csv", "Name;Email;Date;Total\r\nQA Semi;semi@example.test;15/07/2031;1000\r\n");

// 4. Windows-1252 bytes (Excel "CSV" default on many Windows installs).
{
  const text = "Title,Client,Date\r\nQA-IMP Ansi,Jos\xe9 Pe\xf1a,2031-07-10\r\n";
  w("04-ansi-1252.csv", Buffer.from(text, "latin1"));
}

// 5. UTF-8 BOM + CRLF + scripts/emoji.
w("05-utf8-bom.csv", "﻿" + csv([
  ["Title", "Client", "Date"],
  ["QA-IMP Thai", "สมชาย ใจดี", "2031-07-11"],
  ["QA-IMP Arabic", "محمد العلي", "2031-07-12"],
  ["QA-IMP Emoji 🎉", "Zoë 👰‍♀️", "2031-07-13"],
]));

w("06-empty.csv", "");
w("07-header-only.csv", "Title,Client,Date\r\n");
w("08-png-renamed.csv", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array.from({ length: 400 }, (_, i) => (i * 37) % 256)]));
w("09-old-excel.xls", Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]));
w("10-corrupt.xlsx", Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0, 0, 0, 8, 0, 1, 2, 3, 4, 5]));

// 13. Bad values mixed with good rows.
{
  const longTitle = "QA-IMP Long " + "x".repeat(146) + "🎉tail";
  const rows = [
    ["Title", "Client", "Email", "Start", "End", "Status", "Total", "Deposit", "Currency", "Notes", "Notes"],
    ["QA-IMP Good A", "QA Good A", `qa-imp-${stamp}-ga@example.test`, "2031-08-01 10:00", "2031-08-01 12:00", "Booked", "1000", "100", "PHP", "fine", "dup notes col"],
    ["QA-IMP Bad Date", "QA Bad Date", "", "TBD", "", "Booked", "1000", "", "PHP", "", ""],
    ["QA-IMP No Client", "", "", "2031-08-02", "", "Booked", "", "", "", "", ""],
    ["QA-IMP Negative", "QA Neg", "", "2031-08-03", "", "Booked", "-500", "", "", "", ""],
    ["QA-IMP Deposit>Total", "QA Dep", "", "2031-08-04", "", "Booked", "100", "900", "", "", ""],
    ["QA-IMP End<Start", "QA End", "", "2031-08-05 18:00", "2031-08-05 09:00", "Booked", "", "", "", "", ""],
    ["QA-IMP Midnight", "QA Mid", "", "2031-08-06 22:00", "2031-08-07 02:00", "Booked", "", "", "", "", ""],
    ["QA-IMP Bad Currency", "QA Cur", "", "2031-08-08", "", "Booked", "500", "", "XYZ", "", ""],
    ["QA-IMP Odd Status", "QA Status", "", "2031-08-09", "", "Maybe?", "", "", "", "", ""],
    ["QA-IMP Bad Email", "QA Email", "bad@", "2031-08-10", "", "Booked", "", "", "", "", ""],
    [longTitle, "QA Long", "", "2031-08-11", "", "Booked", "", "", "", "N".repeat(3000), ""],
    ["=HYPERLINK(\"http://evil.test\",\"click\")", "QA Formula", "", "2031-08-12", "", "Booked", "", "", "", "@SUM(1+1)", ""],
    ["QA-IMP Multiline", "QA Multi", "", "2031-08-13", "", "Booked", "", "", "", "line one\nline two", ""],
    ["QA-IMP Ragged extra", "QA Rag", "", "2031-08-14", "", "Booked", "", "", "", "", "", "EXTRA", "EXTRA2"],
    ["QA-IMP Ragged short", "QA Short", "", "2031-08-15"],
  ];
  w("13-bad-values.csv", csv(rows));
}

// 14/18. Large valid files.
const bulk = (n, label) => csv([
  ["Title", "Client", "Email", "Start", "Total"],
  ...Array.from({ length: n }, (_, i) => [
    `QA-IMP ${label} ${i + 1}`, `QA ${label} Client ${i + 1}`, `qa-imp-${stamp}-${label.toLowerCase()}${i + 1}@example.test`,
    `2032-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 27) + 1).padStart(2, "0")} 10:00`, String(1000 + i),
  ]),
]);
w("14-rows-600.csv", bulk(600, "Six"));
w("18-rows-500.csv", bulk(500, "Bulk"));

// 17. 8 MB CSV under the row cap (client-side parse cost).
w("17-big-8mb.csv", csv([
  ["Title", "Client", "Start", "Notes"],
  ...Array.from({ length: 450 }, (_, i) => [`QA-IMP Big ${i}`, `QA Big ${i}`, "2031-09-01", rand(18000)]),
]));

// 19. Very wide file with long header names.
{
  const headers = Array.from({ length: 60 }, (_, i) => `Custom field number ${i + 1} with a rather long descriptive header name`);
  headers[0] = "Client"; headers[1] = "Date"; headers[2] = "Title";
  w("19-wide-60cols.csv", csv([headers, ["QA Wide", "2031-09-02", "QA-IMP Wide", ...Array(57).fill("v")]]));
}

// 20. Multi-session group by an invented booking_id.
w("20-multi-session.csv", csv([
  ["booking_id", "title", "clientName", "startAt", "endAt"],
  ["qa-wed-1", "QA-IMP Multi Session", "QA Multi Client", "2031-10-01 09:00", "2031-10-01 12:00"],
  ["qa-wed-1", "QA-IMP Multi Session", "QA Multi Client", "2031-10-02 09:00", "2031-10-02 12:00"],
  ["qa-wed-1", "QA-IMP Multi Session", "QA Multi Client", "2031-10-03 09:00", "2031-10-03 12:00"],
]));

// 21. Server-only failures: unknown booking id, completed but unpaid, plus one good row.
w("21-server-errors.csv", csv([
  ["booking_id", "title", "clientName", "startAt", "status", "amountTotal", "amountDeposit"],
  ["aaaaaaaaaaaaaaaaaaaaaaaa", "QA-IMP Ghost", "QA Ghost", "2031-11-01 10:00", "booked", "", ""],
  ["", "QA-IMP Completed Unpaid", "QA Unpaid", "2031-11-02 10:00", "completed", "1000", "0"],
  ["", "QA-IMP Server Good", "QA Server Good", "2031-11-03 10:00", "booked", "", ""],
]));

(async () => {
  // 2. Foreign CRM export with real date cells, number formats and a formula.
  {
    const wb = new ExcelJS.Workbook();
    const s = wb.addWorksheet("Export");
    s.addRow(["Customer", "E-mail", "Event Date", "Package", "Package Price", "Deposit Paid", "Venue", "Remarks"]);
    [1, 2, 3, 4].forEach((i) => {
      const r = s.addRow([`QA Foreign ${i}`, `qa-imp-${stamp}-f${i}@example.test`, new Date(Date.UTC(2031, 5, 10 + i)), "Wedding", 40000 + i * 1000, null, "Manila Hotel", `QA-IMP foreign ${i}`]);
      r.getCell(5).numFmt = '"₱"#,##0.00';
      r.getCell(6).value = { formula: `E${r.number}*0.3`, result: (40000 + i * 1000) * 0.3 };
      r.getCell(3).numFmt = "d mmm yyyy";
    });
    await wb.xlsx.writeFile(path.join(out, "02-foreign-crm.xlsx"));
  }
  // 11. Banner rows above the header.
  {
    const wb = new ExcelJS.Workbook();
    const s = wb.addWorksheet("Q3");
    s.addRow(["Bookings export — Q3 2031"]);
    s.addRow([]);
    s.addRow(["Title", "Client", "Date"]);
    s.addRow(["QA-IMP Banner", "QA Banner", "2031-07-20"]);
    await wb.xlsx.writeFile(path.join(out, "11-title-rows.xlsx"));
  }
  // 12. Instructions on the first tab, data on the second.
  {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Instructions").addRow(["Fill in the Data tab"]);
    const s = wb.addWorksheet("Data");
    s.addRow(["Title", "Client", "Date"]);
    s.addRow(["QA-IMP Tab2", "QA Tab", "2031-07-21"]);
    await wb.xlsx.writeFile(path.join(out, "12-multi-sheet.xlsx"));
  }
  // 15. 600 rows as XLSX.
  {
    const wb = new ExcelJS.Workbook();
    const s = wb.addWorksheet("Bookings");
    s.addRow(["Title", "Client", "Start"]);
    for (let i = 0; i < 600; i++) s.addRow([`QA-IMP X600 ${i}`, `QA X600 ${i}`, "2031-12-01 10:00"]);
    await wb.xlsx.writeFile(path.join(out, "15-rows-600.xlsx"));
  }
  // 16. Over the 2 MB upload cap.
  {
    const wb = new ExcelJS.Workbook();
    const s = wb.addWorksheet("Bookings");
    s.addRow(["Title", "Client", "Start", "Notes"]);
    for (let i = 0; i < 400; i++) s.addRow([`QA-IMP Huge ${i}`, `QA Huge ${i}`, "2031-12-02", rand(9000)]);
    await wb.xlsx.writeFile(path.join(out, "16-big-3mb.xlsx"));
  }
  for (const f of fs.readdirSync(out).sort()) console.log(f.padEnd(26), fs.statSync(path.join(out, f)).size);
})();
