import type { BookingStatus, EventType } from "@/lib/validators/booking";
import type { SupportedCurrency } from "@/lib/validators/workspace";

export type WizardClient =
  | { mode: "existing"; clientId: string; clientName: string }
  | { mode: "new"; name: string; email?: string | null; phone?: string | null };

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

export type WizardValues = {
  client: WizardClient;
  title: string;
  eventType: EventType;
  status: BookingStatus;
  sessions: WizardSession[];
  location: { address: string };
  amount: { total: number; deposit: number; currency: SupportedCurrency };
  notes: string;
};

export type WizardMode = "create" | "edit";
