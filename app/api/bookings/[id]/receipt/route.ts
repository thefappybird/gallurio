import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, Client } from "@/lib/db/models";
import { ReceiptDocument, type ReceiptData } from "@/lib/invoices/ReceiptDocument";
import { buildPdfFilename } from "@/lib/invoices/filename";
import { getNextInvoiceSeq, formatInvoiceNumber } from "@/lib/invoices/counter";
import { resolveInvoiceTheme } from "@/lib/invoices/theme";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const ctx = await requireOrg();
  const { id } = await params;

  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  await connectDB();
  const booking = await Booking.findOne({
    _id: id,
    workspaceId: ctx.workspace._id,
  }).lean();

  if (!booking) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (booking.status !== "completed") {
    return NextResponse.json({ error: "receipt_not_available" }, { status: 400 });
  }

  const client = booking.clientId
    ? await Client.findOne({ _id: booking.clientId, workspaceId: ctx.workspace._id })
        .select({ name: 1, email: 1, phone: 1 })
        .lean()
    : null;

  const workspace = ctx.workspace;
  // Defensive lazy-allocation: a booking can reach "completed" without ever
  // having its invoice downloaded first, so the receipt route also allocates.
  let invoiceNumber = booking.invoiceNumber;
  if (!invoiceNumber) {
    const seq = await getNextInvoiceSeq(ctx.workspace._id);
    invoiceNumber = formatInvoiceNumber(seq);
    await Booking.updateOne({ _id: booking._id }, { $set: { invoiceNumber } });
  }

  const paidTotal =
    (booking.amount?.deposit ?? 0) +
    booking.payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.price, 0);

  const data: ReceiptData = {
    receiptNumber: invoiceNumber,
    issueDate: new Date(),
    business: {
      name: workspace.name,
      logoUrl: workspace.logoUrl ?? "",
      address: workspace.contact?.address ?? "",
      email: workspace.contact?.email ?? "",
      theme: resolveInvoiceTheme(workspace.invoiceTheme),
    },
    client: {
      name: client?.name ?? booking.clientName,
      email: client?.email ?? null,
      phone: client?.phone ?? null,
    },
    booking: {
      title: booking.title,
      sessionStart: booking.firstSessionStart,
      sessionEnd: booking.lastSessionEnd,
    },
    amount: {
      total: booking.amount?.total ?? 0,
      paidTotal,
      currency: booking.amount?.currency ?? "PHP",
    },
    locale: "en-PH",
  };

  const buffer = await renderToBuffer(ReceiptDocument({ data }));

  const filename = buildPdfFilename({
    business: workspace.name,
    customer: client?.name ?? booking.clientName,
    kind: "receipt",
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
