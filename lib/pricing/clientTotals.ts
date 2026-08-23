import type { Types } from "mongoose";
import { Transaction } from "@/lib/db/models";
import { frozenOrLiveAmountExpr, isSingleCurrency } from "./currencyConverter";
import type { WorkspaceRates } from "./workspaceRates";

// Same ledger definition Client.totalSpent is written from
// (lib/db/clientTransactions.ts) — keep the two in step.
const SPEND_TX_TYPES = ["deposit", "balance"] as const;

// Recomputes each client's spend in the workspace currency.
//
// `Client.totalSpent` is a denormalized running sum written in whatever
// currency each booking used, so it only means anything as-is when the
// workspace stores one currency. Returns null in exactly that case, so the
// common path keeps using the stored field and costs no extra query.
export async function getConvertedClientTotals(
  workspaceId: Types.ObjectId,
  clientIds: Types.ObjectId[],
  fx: WorkspaceRates
): Promise<Map<string, number> | null> {
  if (isSingleCurrency(fx.rates)) return null;
  if (clientIds.length === 0) return new Map();

  const rows = await Transaction.aggregate<{ _id: Types.ObjectId; total: number }>([
    {
      $match: {
        workspaceId,
        clientId: { $in: clientIds },
        type: { $in: SPEND_TX_TYPES },
      },
    },
    {
      $group: {
        _id: "$clientId",
        total: { $sum: frozenOrLiveAmountExpr("$amount", "$currency", fx.rates, fx.target) },
      },
    },
  ]);

  return new Map(rows.map((r) => [String(r._id), r.total]));
}
