import { beforeEach, describe, expect, it, vi } from "vitest";

const sendEmail = vi.fn();
vi.mock("./send", async () => {
  const actual = await vi.importActual<typeof import("./send")>("./send");
  return { ...actual, sendEmail: (...args: unknown[]) => sendEmail(...args) };
});

import { sendTeamInviteEmail } from "./teamInvite";
import { sendBookingConfirmedOwner, sendBookingConfirmedClient } from "./booking/bookingConfirmed";
import { sendInquiryNotification } from "./inquiryNotification";
import { gallurioBrand } from "./brand";

beforeEach(() => {
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ ok: true, id: "m" });
});

const invite = (extra: object = {}) => ({
  to: "a@b.test",
  inviterName: "Maria",
  workspaceName: "Hall",
  teamNames: ["A", "B"],
  acceptUrl: "https://x.test/i",
  locale: "en" as const,
  ...extra,
});

describe("member-facing emails use workspace vocabulary", () => {
  it("team invite: standard says teams, venue preset says venues", async () => {
    await sendTeamInviteEmail(invite());
    expect(sendEmail.mock.calls[0][0].text).toContain("following teams: A, B");
    sendEmail.mockClear();
    await sendTeamInviteEmail(invite({ vocabularyPreset: "venue" }));
    expect(sendEmail.mock.calls[0][0].text).toContain("following venues: A, B");
  });

  it("team invite: user-supplied %token% in team names is not rewritten", async () => {
    await sendTeamInviteEmail(invite({ teamNames: ["%client%"], vocabularyPreset: "venue" }));
    expect(sendEmail.mock.calls[0][0].text).toContain("following venue: %client%");
  });

  it("owner booking email: venue preset renames booking, standard unchanged", async () => {
    const p = { ownerEmail: "o@x.test", clientName: "Emma", eventTitle: "Wed", bookingId: "b1" };
    await sendBookingConfirmedOwner(p);
    expect(sendEmail.mock.calls[0][0].subject).toBe("Booking confirmed: Emma — Wed");
    sendEmail.mockClear();
    await sendBookingConfirmedOwner({ ...p, vocabularyPreset: "venue" });
    expect(sendEmail.mock.calls[0][0].subject).toBe("Event confirmed: Emma — Wed");
  });

  it("inquiry notification: venue preset applied, client-typed token untouched", async () => {
    await sendInquiryNotification({
      workspaceName: "Hall",
      recipientEmail: "o@x.test",
      inquiryId: "i1",
      ownerEmail: "o@x.test",
      clientName: "%booking%",
      clientEmail: "c@x.test",
      clientPhone: null,
      preferredContact: "email",
      eventTitle: "t",
      eventType: "wedding",
      location: {},
      description: "d",
      sessions: [],
      isRecipientGated: false,
      vocabularyPreset: "venue",
    });
    expect(sendEmail.mock.calls[0][0].subject).toBe("New inquiry from %booking% - Hall");
  });

  it("end-client booking email never takes a preset", async () => {
    await sendBookingConfirmedClient({
      brand: gallurioBrand(),
      locale: "en",
      clientName: "Emma",
      clientEmail: "e@x.test",
      businessName: "Hall",
      eventTitle: "Wed",
      sessions: [],
      replyTo: null,
    });
    expect(sendEmail.mock.calls[0][0].subject).toContain("Your booking is confirmed");
  });
});
