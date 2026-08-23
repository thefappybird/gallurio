export type PaymentStatus = "unpaid" | "paid";
export type PaymentMethod = "cash" | "card" | "remit";
export type PaymentInput = {
  price: number;
  status: PaymentStatus;
  createdAt?: Date;
  paidAt?: Date | null;
  title?: string;
  method?: PaymentMethod;
  fxRate?: number | null;
  fxTarget?: string | null;
  fxAt?: Date | null;
};
export type PaymentRecord = {
  price: number;
  status: PaymentStatus;
  createdAt: Date;
  paidAt: Date | null;
  title: string;
  method: PaymentMethod;
  fxRate: number | null;
  fxTarget: string | null;
  fxAt: Date | null;
};

export function normalizePayments(
  raw: PaymentInput[],
  now = new Date(),
  freeze?: { rate: number; target: string } | null
): PaymentRecord[] {
  return raw.map((p) => {
    const isPaid = p.status === "paid";
    const alreadyFrozen = isPaid && p.fxRate != null;
    const takesFreeze = isPaid && !alreadyFrozen && !!freeze && freeze.rate > 0;
    return {
      price: p.price,
      status: p.status,
      createdAt: p.createdAt ?? now,
      paidAt: isPaid ? (p.paidAt ?? now) : null,
      title: p.title ?? "",
      method: p.method ?? "cash",
      fxRate: alreadyFrozen ? (p.fxRate ?? null) : takesFreeze ? freeze!.rate : null,
      fxTarget: alreadyFrozen ? (p.fxTarget ?? null) : takesFreeze ? freeze!.target : null,
      fxAt: alreadyFrozen ? (p.fxAt ?? null) : takesFreeze ? now : null,
    };
  });
}

const CENTS_EPSILON = 0.005;
export function centsEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < CENTS_EPSILON;
}

export function remainingBalance(
  payments: { price: number }[],
  amount: { total: number; deposit: number },
  excludeIndex?: number
): number {
  const sum = payments.reduce((s, p, i) => (i === excludeIndex ? s : s + p.price), 0);
  return amount.total - amount.deposit - sum;
}

export function isCompletionEligible(
  payments: { price: number; status: PaymentStatus }[],
  amount: { total: number; deposit: number }
): boolean {
  if (!payments.every((p) => p.status === "paid")) return false;
  const sum = payments.reduce((s, p) => s + p.price, 0);
  return centsEqual(amount.deposit + sum, amount.total);
}
