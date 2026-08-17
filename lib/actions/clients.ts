"use server";

import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Client } from "@/lib/db/models";
import { requireOrg } from "@/lib/auth/requireOrg";
import { clientFormSchema, type ClientFormInput } from "@/lib/validators/client";
import { isClientMatch } from "@/lib/clients/nameMatch";
import { getWorkspaceRateMap } from "@/lib/pricing/workspaceRates";
import type { ClientMatchCard } from "@/components/app/client-match-dialog";
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

/**
 * Clients in this workspace that plausibly describe the same person as `input`.
 *
 * Email is optional and was never a unique index, so identity is decided by the
 * shared predicate (name in either ordering, or an exact email/phone hit)
 * rather than by an email lookup.
 */
export async function findClientMatchesAction(input: {
  name: string;
  email?: string | null;
  phone?: string | null;
}): Promise<{ matches: ClientMatchCard[] } | { error: string }> {
  try {
    if (!input?.name?.trim()) return { error: "invalid_input" };

    const ctx = await requireOrg();
    await connectDB();

    // ponytail: in-memory match over the workspace's client list; add a
    // denormalized nameKey field if a workspace ever exceeds ~5k clients.
    // The reversed-name ordering can't be expressed as a Mongo query, and a
    // case-insensitive anchored regex wouldn't use {workspaceId, name} anyway.
    const candidates = await Client.find(
      { workspaceId: ctx.workspace._id, isActive: true },
      "_id name email phone notes tags source bookingsCount lastBookingAt"
    )
      .limit(5000)
      .lean();

    const matches = candidates
      .filter((c) => isClientMatch({ name: c.name, email: c.email, phone: c.phone }, input))
      .map((c) => ({
        id: String(c._id),
        name: c.name,
        email: c.email ?? null,
        phone: c.phone ?? null,
        notes: c.notes ?? null,
        tags: c.tags ?? [],
        source: c.source ?? "manual",
        bookingsCount: c.bookingsCount ?? 0,
        lastBookingAt: c.lastBookingAt ? new Date(c.lastBookingAt).toISOString() : null,
      }));

    return { matches };
  } catch {
    return { error: "client_match_lookup_failed" };
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

    const rates = await getWorkspaceRateMap(ctx.workspace._id, ctx.workspace.currency ?? "PHP");
    const c = await getClientById(ctx.workspace._id, clientId, rates);
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
