import "server-only";
import { sendEmail, type SendEmailResult } from "./send";

export type TeamInviteEmailInput = {
  to: string;
  inviterName: string;
  workspaceName: string;
  teamNames: string[];
  acceptUrl: string;
  locale?: string;
};

type EmailStrings = {
  subject: string;
  greeting: string;
  body: string;
  teamsIntro: string;
  cta: string;
  expiry: string;
  footer: string;
};

function getStrings(
  locale: string,
  inviterName: string,
  workspaceName: string,
  teamNames: string[],
): EmailStrings {
  const teamsJoined = teamNames.join(", ");

  const map: Record<string, EmailStrings> = {
    en: {
      subject: `You've been invited to join ${workspaceName}`,
      greeting: `Hi there,`,
      body: `${inviterName} has invited you to join the workspace <strong>${workspaceName}</strong> on Gallurio.`,
      teamsIntro: `You'll be added to the following team${teamNames.length > 1 ? "s" : ""}: <strong>${teamsJoined}</strong>.`,
      cta: "Accept invite",
      expiry: "This invite expires in 7 days.",
      footer: "If you did not expect this invitation, you can safely ignore this email.",
    },
    fil: {
      subject: `Iniimbitahan ka na sumali sa ${workspaceName}`,
      greeting: `Kumusta,`,
      body: `Inimbitahan ka ni ${inviterName} na sumali sa workspace na <strong>${workspaceName}</strong> sa Gallurio.`,
      teamsIntro: `Idadagdag ka sa sumusunod na koponan${teamNames.length > 1 ? "" : ""}: <strong>${teamsJoined}</strong>.`,
      cta: "Tanggapin ang imbitasyon",
      expiry: "Mag-eexpire ang imbitasyong ito sa loob ng 7 araw.",
      footer: "Kung hindi mo inaasahan ang imbitasyong ito, maaari mong balewalain ang email na ito.",
    },
    ms: {
      subject: `Anda dijemput untuk menyertai ${workspaceName}`,
      greeting: `Hai,`,
      body: `${inviterName} telah menjemput anda untuk menyertai ruang kerja <strong>${workspaceName}</strong> di Gallurio.`,
      teamsIntro: `Anda akan ditambahkan ke pasukan berikut: <strong>${teamsJoined}</strong>.`,
      cta: "Terima jemputan",
      expiry: "Jemputan ini akan tamat tempoh dalam 7 hari.",
      footer: "Jika anda tidak menjangka jemputan ini, anda boleh mengabaikan e-mel ini.",
    },
    id: {
      subject: `Anda diundang untuk bergabung dengan ${workspaceName}`,
      greeting: `Halo,`,
      body: `${inviterName} mengundang Anda untuk bergabung dengan workspace <strong>${workspaceName}</strong> di Gallurio.`,
      teamsIntro: `Anda akan ditambahkan ke tim berikut: <strong>${teamsJoined}</strong>.`,
      cta: "Terima undangan",
      expiry: "Undangan ini akan kedaluwarsa dalam 7 hari.",
      footer: "Jika Anda tidak mengharapkan undangan ini, Anda bisa mengabaikan email ini.",
    },
  };

  return map[locale] ?? map["en"]!;
}

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendTeamInviteEmail(
  input: TeamInviteEmailInput,
): Promise<SendEmailResult> {
  const locale = input.locale ?? "en";
  const s = getStrings(locale, input.inviterName, input.workspaceName, input.teamNames);
  const safeUrl = htmlEscape(input.acceptUrl);

  const html = `<!DOCTYPE html>
<html lang="${htmlEscape(locale)}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family:sans-serif;color:#111;background:#fff;margin:0;padding:0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:40px auto;padding:0 16px">
    <tr><td>
      <p style="font-size:14px;margin:0 0 16px 0">${s.greeting}</p>
      <p style="font-size:14px;margin:0 0 16px 0">${s.body}</p>
      <p style="font-size:14px;margin:0 0 24px 0">${s.teamsIntro}</p>
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td style="background:#111;border-radius:0">
            <a href="${safeUrl}"
               style="display:inline-block;padding:12px 24px;color:#fff;text-decoration:none;font-size:14px;font-weight:600">${s.cta}</a>
          </td>
        </tr>
      </table>
      <p style="font-size:12px;color:#666;margin:24px 0 0 0">${s.expiry}</p>
      <p style="font-size:12px;color:#666;margin:8px 0 0 0">${s.footer}</p>
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0 16px 0">
      <p style="font-size:11px;color:#999;margin:0">Gallurio</p>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    s.greeting,
    "",
    s.body.replace(/<[^>]+>/g, ""),
    s.teamsIntro.replace(/<[^>]+>/g, ""),
    "",
    `${s.cta}: ${input.acceptUrl}`,
    "",
    s.expiry,
    s.footer,
  ].join("\n");

  return sendEmail({
    to: input.to,
    subject: s.subject,
    html,
    text,
  });
}
