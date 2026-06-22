import "server-only";
import { renderBrandedEmail } from "./layout";
import { resolveWorkspaceBrand, type Brand } from "./brand";
import { EMAIL_COPY } from "./messages";
import { sendEmail, type SendEmailResult } from "./send";

export type TeamInviteEmailInput = {
  to: string;
  inviterName: string;
  workspaceName: string;
  teamNames: string[];
  acceptUrl: string;
  locale?: "en" | "fil" | "ms" | "id";
  /** Full partner brand resolved at call site via resolveWorkspaceBrand(). When
   *  absent a name-only partner brand is built from workspaceName. */
  brand?: Brand;
};

export async function sendTeamInviteEmail(
  input: TeamInviteEmailInput,
): Promise<SendEmailResult> {
  const locale = input.locale ?? "en";
  const copy = EMAIL_COPY.teamInvite[locale];

  const brand: Brand =
    input.brand ?? resolveWorkspaceBrand({ name: input.workspaceName });

  const teamsJoined = input.teamNames.join(", ");
  const plural = input.teamNames.length > 1;

  const { html, text } = renderBrandedEmail({
    brand,
    locale,
    preheader: copy.subject(input.workspaceName),
    title: copy.subject(input.workspaceName),
    blocks: [
      { type: "p", text: copy.greeting },
      { type: "p", text: copy.body(input.inviterName, input.workspaceName) },
      ...(teamsJoined
        ? [{ type: "p" as const, text: copy.teamsIntro(teamsJoined, plural) }]
        : []),
      { type: "p", text: copy.expiry },
      { type: "p", text: copy.footer },
    ],
    cta: { label: copy.cta, url: input.acceptUrl },
  });

  return sendEmail({
    to: input.to,
    subject: copy.subject(input.workspaceName),
    html,
    text,
    replyTo: brand.replyTo,
  });
}
