import "server-only";
import { renderBilingualEmail, bilingualSubject } from "./layout";
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
  const brand: Brand =
    input.brand ?? resolveWorkspaceBrand({ name: input.workspaceName });

  const teamsJoined = input.teamNames.join(", ");
  const plural = input.teamNames.length > 1;

  const { html, text } = renderBilingualEmail({
    brand,
    preheader: EMAIL_COPY.teamInvite.en.subject(input.workspaceName),
    secondaryLocale: locale,
    build: (loc) => {
      const copy = EMAIL_COPY.teamInvite[loc];
      return {
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
      };
    },
  });

  const subject = bilingualSubject(
    EMAIL_COPY.teamInvite.en.subject(input.workspaceName),
    EMAIL_COPY.teamInvite[locale].subject(input.workspaceName),
    locale,
  );

  return sendEmail({
    to: input.to,
    subject,
    html,
    text,
    replyTo: brand.replyTo,
  });
}
