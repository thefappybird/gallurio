"use server";

import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Client } from "@/lib/db/models";
import { requireOrg } from "@/lib/auth/requireOrg";
import { clientFormSchema, type ClientFormInput } from "@/lib/validators/client";
import {
  getClientBookings,
  getClientPayments,
  getClientById,
  type ClientBookingRow,
  type ClientPaymentRow,
} from "@/app/[locale]/(app)/clients/_data/clients-queries";
import type { ClientRow } from "@/app/[locale]/(app)/clients/_components/clients-table";

type MutationResult = { ok: true } | { error: string };

export async function createClientAction(input: ClientFormInput): Promise<MutationResult> {
  try {
    const ctx = await requireOrg();
    await connectDB();

    const parsed = clientFormSchema.safeParse(input);
    if (!parsed.success) {
      return { error: "invalid_input" };
    }

    await Client.create({
      workspaceId: ctx.workspace._id,
      ...parsed.data,
    });

    revalidatePath("/clients");
    return { ok: true };
  } catch {
    return { error: "client_create_failed" };
  }
}

export async function getClientPaymentsAction(
  clientId: string,
  page = 1
): Promise<{ items: ClientPaymentRow[]; hasMore: boolean } | { error: string }> {
  try {
    if (!Types.ObjectId.isValid(clientId) || !Number.isInteger(page) || page < 1) {
      return { error: "invalid_input" };
    }
    const ctx = await requireOrg();
    await connectDB();
    return await getClientPayments(ctx.workspace._id, new Types.ObjectId(clientId), page);
  } catch {
    return { error: "payments_load_failed" };
  }
}

export async function updateClientAction(
  clientId: string,
  input: ClientFormInput
): Promise<MutationResult> {
  try {
    const ctx = await requireOrg();
    await connectDB();

    const parsed = clientFormSchema.safeParse(input);
    if (!parsed.success) {
      return { error: "invalid_input" };
    }

    const updated = await Client.findOneAndUpdate(
      { _id: clientId, workspaceId: ctx.workspace._id },
      { $set: parsed.data },
      { new: true }
    );

    if (!updated) return { error: "client_not_found" };

    revalidatePath("/clients");
    return { ok: true };
  } catch {
    return { error: "client_update_failed" };
  }
}

export async function deactivateClientAction(clientId: string): Promise<MutationResult> {
  try {
    const ctx = await requireOrg();
    await connectDB();

    const updated = await Client.findOneAndUpdate(
      { _id: clientId, workspaceId: ctx.workspace._id },
      { $set: { isActive: false } },
      { new: true }
    );

    if (!updated) return { error: "client_not_found" };

    revalidatePath("/clients");
    return { ok: true };
  } catch {
    return { error: "client_deactivate_failed" };
  }
}

export async function reactivateClientAction(clientId: string): Promise<MutationResult> {
  try {
    const ctx = await requireOrg();
    await connectDB();

    const updated = await Client.findOneAndUpdate(
      { _id: clientId, workspaceId: ctx.workspace._id },
      { $set: { isActive: true } },
      { new: true }
    );

    if (!updated) return { error: "client_not_found" };

    revalidatePath("/clients");
    return { ok: true };
  } catch {
    return { error: "client_reactivate_failed" };
  }
}

export async function getClientBookingsAction(
  clientId: string
): Promise<ClientBookingRow[] | { error: string }> {
  try {
    const ctx = await requireOrg();
    await connectDB();

    return await getClientBookings(
      ctx.workspace._id,
      new Types.ObjectId(clientId)
    );
  } catch {
    return { error: "bookings_load_failed" };
  }
}

export async function getClientByIdAction(
  clientId: string
): Promise<ClientRow | { error: string }> {
  try {
    const ctx = await requireOrg();
    await connectDB();

    const c = await getClientById(ctx.workspace._id, clientId);
    if (!c) return { error: "client_not_found" };

    return {
      id: String(c._id),
      name: c.name,
      email: c.email ?? null,
      phone: c.phone ?? null,
      source: c.source ?? "manual",
      tags: (c.tags as string[]) ?? [],
      notes: (c.notes as string) ?? "",
      totalSpent: c.totalSpent ?? 0,
      bookingsCount: c.bookingsCount,
      lastBookingAt: c.lastBookingAt,
      isActive: c.isActive ?? true,
      currency: ctx.workspace.currency ?? "PHP",
    };
  } catch {
    return { error: "client_load_failed" };
  }
}
