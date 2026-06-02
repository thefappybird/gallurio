import { EventName } from "@paddle/paddle-node-sdk";
import type { EventEntity } from "@paddle/paddle-node-sdk";
import { getPaddle } from "./client";

// Events we act on. Anything else gets a 200 so Paddle doesn't retry forever.
export const HANDLED_PADDLE_EVENTS = [
  EventName.SubscriptionActivated,
  EventName.SubscriptionUpdated,
  EventName.SubscriptionCanceled,
  EventName.SubscriptionPastDue,
  EventName.SubscriptionPaused,
  EventName.TransactionCompleted,
] as const;

export type HandledPaddleEvent = (typeof HANDLED_PADDLE_EVENTS)[number];

export async function verifyAndParsePaddleEvent(
  rawBody: string,
  signature: string | null
): Promise<EventEntity | null> {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing env var PADDLE_WEBHOOK_SECRET");
    }
    // Dev convenience: allow unsigned posts without round-tripping Paddle sandbox.
    console.warn(
      "[paddle-webhook] PADDLE_WEBHOOK_SECRET unset — accepting unsigned dev event"
    );
    return JSON.parse(rawBody) as EventEntity;
  }

  if (!signature) return null;

  try {
    return await getPaddle().webhooks.unmarshal(rawBody, secret, signature);
  } catch (err) {
    console.error("[paddle-webhook] signature verification failed", err);
    return null;
  }
}
