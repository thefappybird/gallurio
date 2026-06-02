// Thin fetch wrapper for the HitPay REST API. No official SDK is used — HitPay
// publishes language-specific docs but not a Node SDK we trust. Auth is a
// single header: X-BUSINESS-API-KEY: <secret>.
//
// The recurring-billing create endpoint documents application/x-www-form-urlencoded
// as the required content type. Other endpoints accept JSON. The request helper
// supports both per call.

function apiBase(): string {
  const base = process.env.HITPAY_API_BASE;
  if (!base) {
    throw new Error(
      "Missing env var HITPAY_API_BASE — set to https://api.sandbox.hit-pay.com (dev) or https://api.hit-pay.com (prod)"
    );
  }
  return base.replace(/\/$/, "");
}

function apiKey(): string {
  const key = process.env.HITPAY_API_KEY;
  if (!key) {
    throw new Error("Missing env var HITPAY_API_KEY");
  }
  return key;
}

export class HitpayError extends Error {
  status: number;
  raw: unknown;
  constructor(status: number, message: string, raw: unknown) {
    super(message);
    this.name = "HitpayError";
    this.status = status;
    this.raw = raw;
  }
}

type Encoding = "json" | "form";

function encodeBody(body: unknown, encoding: Encoding): { body: string; contentType: string } {
  if (encoding === "form") {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
      if (v === undefined || v === null) continue;
      // Repeat the key for array values so HitPay sees a real array
      // (`payment_methods[]=card&payment_methods[]=card_visa`) rather than a
      // single comma-joined string.
      if (Array.isArray(v)) {
        if (v.length === 0) continue;
        for (const item of v) {
          if (item === undefined || item === null) continue;
          params.append(k, String(item));
        }
        continue;
      }
      params.append(k, String(v));
    }
    return { body: params.toString(), contentType: "application/x-www-form-urlencoded" };
  }
  return { body: JSON.stringify(body), contentType: "application/json" };
}

async function request<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
  opts: { encoding?: Encoding } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "X-BUSINESS-API-KEY": apiKey(),
    "X-Requested-With": "XMLHttpRequest",
  };

  let fetchBody: string | undefined;
  if (body !== undefined) {
    const encoded = encodeBody(body, opts.encoding ?? "form");
    headers["Content-Type"] = encoded.contentType;
    fetchBody = encoded.body;
  }

  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers,
    body: fetchBody,
    cache: "no-store",
  });

  const raw = await res.text();
  let json: unknown = null;
  if (raw) {
    try {
      json = JSON.parse(raw);
    } catch {
      // leave json null — some endpoints return empty body on success
    }
  }

  if (!res.ok) {
    const j = (json ?? {}) as { message?: string; errors?: unknown };
    const baseMsg = j.message ?? `HitPay ${method} ${path} failed (${res.status})`;
    const detail = j.errors ? ` — ${JSON.stringify(j.errors)}` : "";
    console.error(`[hitpay] ${method} ${path} ${res.status}`, json);
    throw new HitpayError(res.status, baseMsg + detail, json);
  }

  return (json as T) ?? ({} as T);
}

// ---------- Recurring Billing ----------

export type HitpayRecurringStatus =
  | "scheduled"
  | "active"
  | "cancelled"
  | "completed"
  | "closed"
  | "failed"
  | "pending";

export type HitpayRecurringBilling = {
  id: string;
  status: HitpayRecurringStatus;
  url?: string;
  reference?: string;
  amount: string | number;
  currency: string;
  customer_email?: string;
  customer_name?: string;
  plan_id?: string | null;
  name?: string;
  cycle?: "weekly" | "monthly" | "yearly";
  start_date?: string;
  redirect_url?: string;
  payment_methods?: string[];
  created_at?: string;
  updated_at?: string;
};

export type CreateRecurringBillingInput = {
  // Mandatory if creating inline (no plan_id). HitPay accepts plan_id=null
  // alongside name/cycle/amount/customer_email/start_date to create the plan
  // on the fly.
  name: string;
  cycle: "monthly" | "yearly" | "weekly";
  amount: number;
  currency: "PHP" | "SGD" | "MYR" | "USD";
  customer_email: string;
  customer_name?: string;
  start_date: string; // YYYY-MM-DD
  reference?: string;
  redirect_url?: string;
  // Allowed recurring-billing methods on HitPay. Sandbox supports the SEA
  // wallets (shopeepay / grabpay / touch_n_go) plus PayNow, and cards via a
  // connected Stripe test account. Live PH currently uses cards for recurring
  // — GCash is NOT available for recurring on HitPay (only ShopeePay among PH
  // e-wallets).
  payment_methods?: Array<
    "card" | "shopee_pay" | "grabpay" | "touch_n_go" | "paynow_online"
  >;
  times_to_be_charged?: number;
};

export function createRecurringBilling(
  input: CreateRecurringBillingInput
): Promise<HitpayRecurringBilling> {
  return request<HitpayRecurringBilling>(
    "POST",
    "/v1/recurring-billing",
    {
      plan_id: null,
      name: input.name,
      cycle: input.cycle,
      amount: input.amount,
      currency: input.currency,
      customer_email: input.customer_email,
      customer_name: input.customer_name,
      start_date: input.start_date,
      reference: input.reference,
      redirect_url: input.redirect_url,
      // Omit when undefined so HitPay falls back to whichever methods are
      // enabled on the merchant account. Sending a method that isn't enabled
      // (e.g. card on a fresh sandbox) returns "The selected payment methods
      // is invalid."
      "payment_methods[]": input.payment_methods,
      times_to_be_charged: input.times_to_be_charged,
    },
    { encoding: "form" }
  );
}

export function getRecurringBilling(id: string): Promise<HitpayRecurringBilling> {
  return request<HitpayRecurringBilling>("GET", `/v1/recurring-billing/${id}`);
}

export function cancelRecurringBilling(id: string): Promise<HitpayRecurringBilling> {
  return request<HitpayRecurringBilling>("DELETE", `/v1/recurring-billing/${id}`);
}
