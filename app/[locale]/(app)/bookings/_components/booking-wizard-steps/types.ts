import type { BookingStatus, EventType } from "@/lib/validators/booking";
import type { SupportedCurrency } from "@/lib/validators/workspace";

export type ShiftHit = {
  id: string;
  bookingId?: string;
  sessionIndex?: number;
  title: string;
  shiftStart: string;
  shiftEnd: string;
};

export type WizardClient =
  | { mode: "existing"; clientId: string; clientName: string }
  | {
      mode: "new";
      name: string;
      email?: string | null;
      phone?: string | null;
      source?: "form" | "manual" | "referral" | "import";
      tags?: string[];
      notes?: string;
    };

export type WizardSession = {
  /** YYYY-MM-DD (date input format). Combined with startTime at submit. */
  startDate: string;
  /** HH:MM 24h. */
  startTime: string;
  /** HH:MM 24h. */
  endTime: string;
  /** When true, allow start dates in the past. */
  allowPastDate: boolean;
};

export type WizardPaymentStatus = "unpaid" | "paid";
export type WizardPayment = {
  price: number;
  status: WizardPaymentStatus;
  title: string;
  method?: "cash" | "card" | "remit";
};

export type WizardValues = {
  client: WizardClient;
  title: string;
  eventType: EventType;
  status: BookingStatus;
  sessions: WizardSession[];
  location: { address: string; lat: number | null; lng: number | null };
  amount: { total: number; deposit: number; currency: SupportedCurrency };
  payments: WizardPayment[];
  notes: string;
  teamId?: string;
};

export type WizardMode = "create" | "edit";
