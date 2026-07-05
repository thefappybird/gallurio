export type PaymentStatus = "unpaid" | "paid";
export type PaymentInput = { price: number; status: PaymentStatus; createdAt?: Date; paidAt?: Date | null };
export type PaymentRecord = { price: number; status: PaymentStatus; createdAt: Date; paidAt: Date | null };

export function normalizePayments(raw: PaymentInput[], now = new Date()): PaymentRecord[] {
  return raw.map((p) => ({
    price: p.price,
    status: p.status,
    createdAt: p.createdAt ?? now,
    paidAt: p.status === "paid" ? (p.paidAt ?? now) : null,
  }));
}

const CENTS_EPSILON = 0.005;
export function centsEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < CENTS_EPSILON;
}

export function isCompletionEligible(
  payments: { price: number; status: PaymentStatus }[],
  amount: { total: number; deposit: number }
): boolean {
  if (!payments.every((p) => p.status === "paid")) return false;
  const sum = payments.reduce((s, p) => s + p.price, 0);
  return centsEqual(amount.deposit + sum, amount.total);
}
