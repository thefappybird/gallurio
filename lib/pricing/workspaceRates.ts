import type { Types } from "mongoose";
import { Booking, Transaction } from "@/lib/db/models";
import { buildRateMap, type RateMap } from "./currencyConverter";

// Resolves the multipliers needed to roll one workspace's money up into its
// own currency. Money stays stored in the currency it was entered in; only
// aggregate totals are converted.
export async function getWorkspaceRateMap(
  workspaceId: Types.ObjectId | string,
  workspaceCurrency: string
): Promise<RateMap> {
  const [bookingCurrencies, transactionCurrencies] = await Promise.all([
    Booking.distinct("amount.currency", { workspaceId }),
    Transaction.distinct("currency", { workspaceId }),
  ]);

  const stored = [...bookingCurrencies, ...transactionCurrencies].filter(
    (c): c is string => typeof c === "string" && c.length > 0
  );

  return buildRateMap(workspaceCurrency, [workspaceCurrency, ...stored]);
}
