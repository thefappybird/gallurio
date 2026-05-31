"use server";

import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Client } from "@/lib/db/models";
import { requireOrg } from "@/lib/auth/requireOrg";
import { clientFormSchema, type ClientFormInput } from "@/lib/validators/client";
import {
  getClientBookings,
  getClientById,
  type ClientBookingRow,
} from "@/app/[locale]/(app)/clients/_data/clients-queries";
import type { ClientRow } from "@/app/[locale]/(app)/clients/_components/clients-table";

type MutationResult = { ok: true } | { error: string };

export async function createClientAction(input: ClientFormInput): Promise<MutationResult> {
  try {
    const ctx = await requireOrg();
    await connectDB();

    const parsed = clientFormSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
    }

    await Client.create({
      workspaceId: ctx.workspace._id,
      ...parsed.data,
    });

    revalidatePath("/clients");
    return { ok: true };
  } catch {
    return { error: "Failed to create client" };
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
      return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
    }

    const updated = await Client.findOneAndUpdate(
      { _id: clientId, workspaceId: ctx.workspace._id },
      { $set: parsed.data },
      { new: true }
    );

    if (!updated) return { error: "Client not found" };

    revalidatePath("/clients");
    return { ok: true };
  } catch {
    return { error: "Failed to update client" };
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

    if (!updated) return { error: "Client not found" };

    revalidatePath("/clients");
    return { ok: true };
  } catch {
    return { error: "Failed to deactivate client" };
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

    if (!updated) return { error: "Client not found" };

    revalidatePath("/clients");
    return { ok: true };
  } catch {
    return { error: "Failed to reactivate client" };
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
    return { error: "Failed to load bookings" };
  }
}

export async function getClientByIdAction(
  clientId: string
): Promise<ClientRow | { error: string }> {
  try {
    const ctx = await requireOrg();
    await connectDB();

    const c = await getClientById(ctx.workspace._id, clientId);
    if (!c) return { error: "Client not found" };

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
    return { error: "Failed to load client" };
  }
}
