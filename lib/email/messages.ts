import { localeForCountry } from "@/lib/i18n/localeForCountry";

export const emailLocale = localeForCountry;

type Locale = "en" | "fil" | "ms" | "id";

type TeamInviteCopy = {
  subject: (ws: string) => string;
  greeting: string;
  body: (inviter: string, ws: string) => string;
  teamsIntro: (teamsJoined: string, plural: boolean) => string;
  cta: string;
  expiry: string;
  footer: string;
};

type InquiryConfirmationCopy = {
  subject: (ws: string) => string;
  greeting: (name: string) => string;
  body1: (ws: string) => string;
  body2: (ws: string) => string;
  body3: (ws: string) => string;
};

type EmailCopyMap = {
  teamInvite: Record<Locale, TeamInviteCopy>;
  inquiryConfirmation: Record<Locale, InquiryConfirmationCopy>;
};

export const EMAIL_COPY = {
  teamInvite: {
    en: {
      subject: (ws: string) => `You've been invited to join ${ws}`,
      greeting: `Hi there,`,
      body: (inviter: string, ws: string) =>
        `${inviter} has invited you to join the workspace <strong>${ws}</strong> on Gallurio.`,
      teamsIntro: (teamsJoined: string, plural: boolean) =>
        `You'll be added to the following team${plural ? "s" : ""}: <strong>${teamsJoined}</strong>.`,
      cta: "Accept invite",
      expiry: "This invite expires in 7 days.",
      footer: "If you did not expect this invitation, you can safely ignore this email.",
    },
    fil: {
      subject: (ws: string) => `Iniimbitahan ka na sumali sa ${ws}`,
      greeting: `Kumusta,`,
      body: (inviter: string, ws: string) =>
        `Inimbitahan ka ni ${inviter} na sumali sa workspace na <strong>${ws}</strong> sa Gallurio.`,
      teamsIntro: (teamsJoined: string, _plural: boolean) =>
        `Idadagdag ka sa sumusunod na koponan: <strong>${teamsJoined}</strong>.`,
      cta: "Tanggapin ang imbitasyon",
      expiry: "Mag-eexpire ang imbitasyong ito sa loob ng 7 araw.",
      footer: "Kung hindi mo inaasahan ang imbitasyong ito, maaari mong balewalain ang email na ito.",
    },
    ms: {
      subject: (ws: string) => `Anda dijemput untuk menyertai ${ws}`,
      greeting: `Hai,`,
      body: (inviter: string, ws: string) =>
        `${inviter} telah menjemput anda untuk menyertai ruang kerja <strong>${ws}</strong> di Gallurio.`,
      teamsIntro: (teamsJoined: string, _plural: boolean) =>
        `Anda akan ditambahkan ke pasukan berikut: <strong>${teamsJoined}</strong>.`,
      cta: "Terima jemputan",
      expiry: "Jemputan ini akan tamat tempoh dalam 7 hari.",
      footer: "Jika anda tidak menjangka jemputan ini, anda boleh mengabaikan e-mel ini.",
    },
    id: {
      subject: (ws: string) => `Anda diundang untuk bergabung dengan ${ws}`,
      greeting: `Halo,`,
      body: (inviter: string, ws: string) =>
        `${inviter} mengundang Anda untuk bergabung dengan workspace <strong>${ws}</strong> di Gallurio.`,
      teamsIntro: (teamsJoined: string, _plural: boolean) =>
        `Anda akan ditambahkan ke tim berikut: <strong>${teamsJoined}</strong>.`,
      cta: "Terima undangan",
      expiry: "Undangan ini akan kedaluwarsa dalam 7 hari.",
      footer: "Jika Anda tidak mengharapkan undangan ini, Anda bisa mengabaikan email ini.",
    },
  },
  inquiryConfirmation: {
    en: {
      subject: (ws: string) => `We received your inquiry - ${ws}`,
      greeting: (name: string) => `Hi ${name},`,
      body1: (ws: string) => `Thanks for reaching out to ${ws}.`,
      body2: (ws: string) => `Your inquiry has been sent to ${ws}.`,
      body3: (ws: string) => `${ws} will respond soon.`,
    },
    fil: {
      subject: (ws: string) => `Natanggap namin ang iyong katanungan - ${ws}`,
      greeting: (name: string) => `Kumusta ${name},`,
      body1: (ws: string) => `Salamat sa pagkomunika sa ${ws}.`,
      body2: (ws: string) => `Ang iyong katanungan ay naipadala na sa ${ws}.`,
      body3: (ws: string) => `Makikipag-ugnayan sa iyo ang ${ws} sa lalong madaling panahon.`,
    },
    ms: {
      subject: (ws: string) => `Kami telah menerima pertanyaan anda - ${ws}`,
      greeting: (name: string) => `Hai ${name},`,
      body1: (ws: string) => `Terima kasih kerana menghubungi ${ws}.`,
      body2: (ws: string) => `Pertanyaan anda telah dihantar kepada ${ws}.`,
      body3: (ws: string) => `${ws} akan membalas tidak lama lagi.`,
    },
    id: {
      subject: (ws: string) => `Kami telah menerima pertanyaan Anda - ${ws}`,
      greeting: (name: string) => `Halo ${name},`,
      body1: (ws: string) => `Terima kasih telah menghubungi ${ws}.`,
      body2: (ws: string) => `Pertanyaan Anda telah dikirimkan ke ${ws}.`,
      body3: (ws: string) => `${ws} akan segera merespons.`,
    },
  },
} as const satisfies EmailCopyMap;
