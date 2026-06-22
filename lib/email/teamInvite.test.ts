import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendEmail = vi.fn();
vi.mock("./send", () => ({ sendEmail: (...args: unknown[]) => sendEmail(...args) }));

import { sendTeamInviteEmail } from "./teamInvite";

beforeEach(() => {
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ ok: true, id: "msg_1" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sendTeamInviteEmail", () => {
  it("renders workspace name, accept URL, and fil CTA label via branded template", async () => {
    await sendTeamInviteEmail({
      to: "staff@example.com",
      inviterName: "Maria Santos",
      workspaceName: "Studio Aurora",
      teamNames: ["Photography", "Video"],
      acceptUrl: "https://app.gallurio.com/invite/accept?token=abc123",
      locale: "fil",
    });

    expect(sendEmail).toHaveBeenCalledOnce();
    const arg = sendEmail.mock.calls[0][0];

    // workspace name appears in HTML
    expect(arg.html).toContain("Studio Aurora");
    // accept URL is present (in CTA button)
    expect(arg.html).toContain("https://app.gallurio.com/invite/accept?token=abc123");
    // fil CTA label: "Tanggapin ang imbitasyon"
    expect(arg.html).toContain("Tanggapin ang imbitasyon");
    // branded template outputs "Powered by Gallurio" partner footer (not the old plain Gallurio footer)
    expect(arg.html).toContain("Powered by Gallurio");
    // plain text also has the CTA label and URL
    expect(arg.text).toContain("Tanggapin ang imbitasyon");
    expect(arg.text).toContain("https://app.gallurio.com/invite/accept?token=abc123");
  });

  it("uses a supplied brand and passes its replyTo through sendEmail", async () => {
    await sendTeamInviteEmail({
      to: "staff@example.com",
      inviterName: "Jose Reyes",
      workspaceName: "Captured Moments",
      teamNames: ["Editing"],
      acceptUrl: "https://app.gallurio.com/invite/accept?token=xyz",
      locale: "en",
      brand: {
        kind: "partner",
        name: "Captured Moments",
        accentHex: "#c0392b",
        replyTo: "hello@captured.ph",
        poweredByGallurio: true,
      },
    });

    expect(sendEmail).toHaveBeenCalledOnce();
    const arg = sendEmail.mock.calls[0][0];
    expect(arg.replyTo).toBe("hello@captured.ph");
    expect(arg.html).toContain("Captured Moments");
  });

  it("uses inviterName distinct from workspaceName in the email body", async () => {
    await sendTeamInviteEmail({
      to: "staff@example.com",
      inviterName: "Juan dela Cruz",
      workspaceName: "Studio Luz",
      teamNames: ["Photography"],
      acceptUrl: "https://app.gallurio.com/invite/accept?token=test",
      locale: "en",
    });

    const arg = sendEmail.mock.calls[0][0];
    // inviterName should appear in the rendered HTML body
    expect(arg.html).toContain("Juan dela Cruz");
    // plain text should also carry the inviter name
    expect(arg.text).toContain("Juan dela Cruz");
  });
});