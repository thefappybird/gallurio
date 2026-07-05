import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, Client } from "@/lib/db/models";
import { InvoiceDocument, type InvoiceData } from "@/lib/invoices/InvoiceDocument";

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
    return NextResponse.json({ error: "invoice_not_available" }, { status: 400 });
  }

  const client = booking.clientId
    ? await Client.findOne({ _id: booking.clientId, workspaceId: ctx.workspace._id })
        .select({ name: 1, email: 1, phone: 1 })
        .lean()
    : null;

  const workspace = ctx.workspace;
  const invoiceNumber = `INV-${booking._id.toString().slice(-8).toUpperCase()}`;

  const data: InvoiceData = {
    invoiceNumber,
    issueDate: new Date(),
    business: {
      name: workspace.name,
      logoUrl: workspace.logoUrl ?? "",
      address: workspace.contact?.address ?? "",
      email: workspace.contact?.email ?? "",
      accentColor: workspace.publicPage?.brandKit?.accentColor ?? "#2f5d56",
    },
    client: {
      name: client?.name ?? booking.clientName,
      email: client?.email ?? null,
      phone: client?.phone ?? null,
    },
    booking: {
      title: booking.title,
      eventType: booking.eventType ?? "",
      sessionStart: booking.firstSessionStart,
      sessionEnd: booking.lastSessionEnd,
      locationAddress: booking.location?.address ?? "",
    },
    amount: {
      total: booking.amount?.total ?? 0,
      deposit: booking.amount?.deposit ?? 0,
      currency: booking.amount?.currency ?? "PHP",
    },
    locale: "en-PH",
  };

  const buffer = await renderToBuffer(InvoiceDocument({ data }));

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${booking._id}.pdf"`,
    },
  });
}
