import { describe, it, expect, vi, afterEach } from "vitest";
import type { DataEvent } from "@/lib/data-events";
import { keysForEvent, routesForEvent, markLocalEvent, isLocalEcho } from "./invalidation";

describe("echo suppression", () => {
  afterEach(() => vi.useRealTimers());

  it("matches a recently marked event, not different ids, not after 2s", () => {
    vi.useFakeTimers();
    markLocalEvent({ type: "booking.updated", bookingId: "b1" });
    expect(isLocalEcho({ type: "booking.updated", bookingId: "b1" })).toBe(true);
    expect(isLocalEcho({ type: "booking.updated", bookingId: "b2" })).toBe(false);
    vi.advanceTimersByTime(2_100);
    expect(isLocalEcho({ type: "booking.updated", bookingId: "b1" })).toBe(false);
  });
});

const W = "w1";
const p = (...rest: unknown[]) => ["ws", W, ...rest];

const table: Array<{
  name: string;
  event: DataEvent;
  keys: unknown[][];
  routes: string[];
}> = [
  {
    name: "booking.created (no inquiry)",
    event: { type: "booking.created", bookingId: "b1", clientId: "c1" },
    keys: [
      p("booking", "b1"),
      p("bookingActivity", "b1"),
      p("bookings"),
      p("calendar"),
      p("dashboard"),
      p("clients"),
      p("client"),
      p("shifts"),
    ],
    routes: ["/bookings", "/dashboard", "/clients"],
  },
  {
    name: "booking.updated with inquiryId",
    event: { type: "booking.updated", bookingId: "b1", inquiryId: "i1" },
    keys: [
      p("booking", "b1"),
      p("bookingActivity", "b1"),
      p("bookings"),
      p("calendar"),
      p("dashboard"),
      p("clients"),
      p("client"),
      p("shifts"),
      p("inquiries"),
      p("inquiry", "i1"),
    ],
    routes: ["/bookings", "/dashboard", "/clients", "/inquiries"],
  },
  {
    name: "bookings.imported",
    event: { type: "bookings.imported" },
    keys: [
      p("booking"),
      p("bookingActivity"),
      p("bookings"),
      p("calendar"),
      p("dashboard"),
      p("clients"),
      p("client"),
      p("shifts"),
    ],
    routes: ["/bookings", "/dashboard", "/clients"],
  },
  {
    name: "inquiry.created",
    event: { type: "inquiry.created", inquiryId: "i1" },
    keys: [p("inquiries"), p("calendar"), p("dashboard")],
    routes: ["/inquiries", "/dashboard"],
  },
  {
    name: "inquiry.updated without booking",
    event: { type: "inquiry.updated", inquiryId: "i1" },
    keys: [p("inquiries"), p("inquiry", "i1"), p("calendar"), p("dashboard")],
    routes: ["/inquiries", "/dashboard"],
  },
  {
    name: "inquiry.updated with booking",
    event: { type: "inquiry.updated", inquiryId: "i1", bookingId: "b1" },
    keys: [
      p("inquiries"),
      p("inquiry", "i1"),
      p("calendar"),
      p("dashboard"),
      p("booking", "b1"),
      p("bookings"),
      p("client"),
      p("shifts"),
    ],
    routes: ["/inquiries", "/dashboard", "/bookings"],
  },
  {
    name: "client.created",
    event: { type: "client.created", clientId: "c1" },
    keys: [p("clients"), p("client", "c1"), p("bookings"), p("booking"), p("calendar"), p("inquiries")],
    routes: ["/clients", "/bookings", "/inquiries"],
  },
  {
    name: "client.updated",
    event: { type: "client.updated", clientId: "c2" },
    keys: [p("clients"), p("client", "c2"), p("bookings"), p("booking"), p("calendar"), p("inquiries")],
    routes: ["/clients", "/bookings", "/inquiries"],
  },
  {
    name: "team.updated",
    event: { type: "team.updated", teamId: "t1" },
    keys: [p("teams"), p("memberActivity"), p("calendar"), p("bookings"), p("dashboard")],
    routes: ["/teams", "/bookings", "/inquiries", "/dashboard"],
  },
  {
    name: "workspace.updated",
    event: { type: "workspace.updated" },
    keys: [["ws", W]],
    routes: ["/dashboard", "/bookings", "/inquiries", "/clients", "/teams", "/notifications"],
  },
];

describe("event -> stale mapping", () => {
  it.each(table)("$name", ({ event, keys, routes }) => {
    expect(keysForEvent(W, event)).toEqual(keys);
    expect(routesForEvent(event)).toEqual(routes);
    for (const k of keysForEvent(W, event)) expect(k.slice(0, 2)).toEqual(["ws", W]);
  });
});
