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

type PasswordResetCopy = {
  subject: string;
  intro: string;
  cta: string;
  expiry: string;
};

type BookingConfirmedClientCopy = {
  subject: (ws: string) => string;
  greeting: (name: string) => string;
  body1: (ws: string) => string;
  body2: (eventTitle: string) => string;
  sessions: (dates: string) => string;
  body3: (ws: string) => string;
};

type BookingCancelledClientCopy = {
  subject: (ws: string) => string;
  greeting: (name: string) => string;
  body1: (ws: string) => string;
  body2: (eventTitle: string) => string;
  sessions: (dates: string) => string;
  body3: (ws: string) => string;
};

export type InquiryDeclineCopy = {
  subject: (ws: string) => string;
  greeting: (name: string) => string;
  body1: (ws: string) => string;
  body2: string;
};

type VerificationCopy = {
  subject: string;
  greeting: string;
  intro: string;
  codeLabel: string;
  expiry: string;
  ignore: string;
};

type EmailCopyMap = {
  teamInvite: Record<Locale, TeamInviteCopy>;
  inquiryConfirmation: Record<Locale, InquiryConfirmationCopy>;
  passwordReset: Record<Locale, PasswordResetCopy>;
  bookingConfirmedClient: Record<Locale, BookingConfirmedClientCopy>;
  bookingCancelledClient: Record<Locale, BookingCancelledClientCopy>;
  inquiryDecline: Record<Locale, InquiryDeclineCopy>;
  verification: Record<Locale, VerificationCopy>;
};

// Plain text only — never embed HTML here; renderBrandedEmail escapes all interpolated values.
export const EMAIL_COPY = {
  teamInvite: {
    en: {
      subject: (ws: string) => `You've been invited to join ${ws}`,
      greeting: `Hi there,`,
      body: (inviter: string, ws: string) =>
        `${inviter} has invited you to join the workspace ${ws} on Gallurio.`,
      teamsIntro: (teamsJoined: string, plural: boolean) =>
        `You'll be added to the following team${plural ? "s" : ""}: ${teamsJoined}.`,
      cta: "Accept invite",
      expiry: "This invite expires in 7 days.",
      footer: "If you did not expect this invitation, you can safely ignore this email.",
    },
    fil: {
      subject: (ws: string) => `Iniimbitahan ka na sumali sa ${ws}`,
      greeting: `Kumusta,`,
      body: (inviter: string, ws: string) =>
        `Inimbitahan ka ni ${inviter} na sumali sa workspace na ${ws} sa Gallurio.`,
      teamsIntro: (teamsJoined: string, _plural: boolean) =>
        `Idadagdag ka sa sumusunod na koponan: ${teamsJoined}.`,
      cta: "Tanggapin ang imbitasyon",
      expiry: "Mag-eexpire ang imbitasyong ito sa loob ng 7 araw.",
      footer: "Kung hindi mo inaasahan ang imbitasyong ito, maaari mong balewalain ang email na ito.",
    },
    ms: {
      subject: (ws: string) => `Anda dijemput untuk menyertai ${ws}`,
      greeting: `Hai,`,
      body: (inviter: string, ws: string) =>
        `${inviter} telah menjemput anda untuk menyertai ruang kerja ${ws} di Gallurio.`,
      teamsIntro: (teamsJoined: string, _plural: boolean) =>
        `Anda akan ditambahkan ke pasukan berikut: ${teamsJoined}.`,
      cta: "Terima jemputan",
      expiry: "Jemputan ini akan tamat tempoh dalam 7 hari.",
      footer: "Jika anda tidak menjangka jemputan ini, anda boleh mengabaikan e-mel ini.",
    },
    id: {
      subject: (ws: string) => `Anda diundang untuk bergabung dengan ${ws}`,
      greeting: `Halo,`,
      body: (inviter: string, ws: string) =>
        `${inviter} mengundang Anda untuk bergabung dengan workspace ${ws} di Gallurio.`,
      teamsIntro: (teamsJoined: string, _plural: boolean) =>
        `Anda akan ditambahkan ke tim berikut: ${teamsJoined}.`,
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
  passwordReset: {
    en: {
      subject: "Reset your Gallurio password",
      intro: "We received a request to reset the password for your account. Click the button below to choose a new password.",
      cta: "Reset password",
      expiry: "This link expires soon. If you did not request a password reset, you can safely ignore this email.",
    },
    fil: {
      subject: "I-reset ang iyong Gallurio password",
      intro: "Nakatanggap kami ng kahilingan na i-reset ang password ng iyong account. I-click ang button sa ibaba upang pumili ng bagong password.",
      cta: "I-reset ang password",
      expiry: "Mag-eexpire ang link na ito sa lalong madaling panahon. Kung hindi mo hiniling ang pag-reset ng password, maaari mong balewalain ang email na ito.",
    },
    ms: {
      subject: "Tetapkan semula kata laluan Gallurio anda",
      intro: "Kami menerima permintaan untuk menetapkan semula kata laluan akaun anda. Klik butang di bawah untuk memilih kata laluan baharu.",
      cta: "Tetapkan semula kata laluan",
      expiry: "Pautan ini akan tamat tempoh tidak lama lagi. Jika anda tidak meminta penetapan semula kata laluan, anda boleh mengabaikan e-mel ini.",
    },
    id: {
      subject: "Reset kata sandi Gallurio Anda",
      intro: "Kami menerima permintaan untuk mereset kata sandi akun Anda. Klik tombol di bawah untuk memilih kata sandi baru.",
      cta: "Reset kata sandi",
      expiry: "Tautan ini akan segera kedaluwarsa. Jika Anda tidak meminta reset kata sandi, Anda bisa mengabaikan email ini.",
    },
  },
  bookingConfirmedClient: {
    en: {
      subject: (ws: string) => `Your booking is confirmed - ${ws}`,
      greeting: (name: string) => `Hi ${name},`,
      body1: (ws: string) => `Great news! ${ws} has confirmed your booking.`,
      body2: (eventTitle: string) => `Event: ${eventTitle}`,
      sessions: (dates: string) => `Dates: ${dates}`,
      body3: (ws: string) => `We look forward to working with you. If you have any questions, please reach out to ${ws}.`,
    },
    fil: {
      subject: (ws: string) => `Nakumpirma na ang iyong booking - ${ws}`,
      greeting: (name: string) => `Kumusta ${name},`,
      body1: (ws: string) => `Magandang balita! Kinumpirma na ng ${ws} ang iyong booking.`,
      body2: (eventTitle: string) => `Event: ${eventTitle}`,
      sessions: (dates: string) => `Mga Petsa: ${dates}`,
      body3: (ws: string) => `Inaabangan namin ang pagtatrabaho para sa iyo. Kung mayroon kang mga katanungan, makipag-ugnayan sa ${ws}.`,
    },
    ms: {
      subject: (ws: string) => `Tempahan anda telah disahkan - ${ws}`,
      greeting: (name: string) => `Hai ${name},`,
      body1: (ws: string) => `Berita baik! ${ws} telah mengesahkan tempahan anda.`,
      body2: (eventTitle: string) => `Acara: ${eventTitle}`,
      sessions: (dates: string) => `Tarikh: ${dates}`,
      body3: (ws: string) => `Kami menanti untuk bekerja bersama anda. Jika anda mempunyai sebarang soalan, sila hubungi ${ws}.`,
    },
    id: {
      subject: (ws: string) => `Pemesanan Anda telah dikonfirmasi - ${ws}`,
      greeting: (name: string) => `Halo ${name},`,
      body1: (ws: string) => `Kabar baik! ${ws} telah mengkonfirmasi pemesanan Anda.`,
      body2: (eventTitle: string) => `Acara: ${eventTitle}`,
      sessions: (dates: string) => `Tanggal: ${dates}`,
      body3: (ws: string) => `Kami menantikan untuk bekerja bersama Anda. Jika Anda memiliki pertanyaan, silakan hubungi ${ws}.`,
    },
  },
  bookingCancelledClient: {
    en: {
      subject: (ws: string) => `Your booking has been cancelled - ${ws}`,
      greeting: (name: string) => `Hi ${name},`,
      body1: (ws: string) => `We wanted to let you know that your booking with ${ws} has been cancelled.`,
      body2: (eventTitle: string) => `Event: ${eventTitle}`,
      sessions: (dates: string) => `Dates: ${dates}`,
      body3: (ws: string) => `If you have any questions, please reach out to ${ws}.`,
    },
    fil: {
      subject: (ws: string) => `Nakansela na ang iyong booking - ${ws}`,
      greeting: (name: string) => `Kumusta ${name},`,
      body1: (ws: string) => `Nais naming ipaalam sa iyo na ang iyong booking sa ${ws} ay nakansela na.`,
      body2: (eventTitle: string) => `Event: ${eventTitle}`,
      sessions: (dates: string) => `Mga Petsa: ${dates}`,
      body3: (ws: string) => `Kung mayroon kang mga katanungan, makipag-ugnayan sa ${ws}.`,
    },
    ms: {
      subject: (ws: string) => `Tempahan anda telah dibatalkan - ${ws}`,
      greeting: (name: string) => `Hai ${name},`,
      body1: (ws: string) => `Kami ingin memaklumkan bahawa tempahan anda dengan ${ws} telah dibatalkan.`,
      body2: (eventTitle: string) => `Acara: ${eventTitle}`,
      sessions: (dates: string) => `Tarikh: ${dates}`,
      body3: (ws: string) => `Jika anda mempunyai sebarang soalan, sila hubungi ${ws}.`,
    },
    id: {
      subject: (ws: string) => `Pemesanan Anda telah dibatalkan - ${ws}`,
      greeting: (name: string) => `Halo ${name},`,
      body1: (ws: string) => `Kami ingin memberitahu Anda bahwa pemesanan Anda dengan ${ws} telah dibatalkan.`,
      body2: (eventTitle: string) => `Acara: ${eventTitle}`,
      sessions: (dates: string) => `Tanggal: ${dates}`,
      body3: (ws: string) => `Jika Anda memiliki pertanyaan, silakan hubungi ${ws}.`,
    },
  },
  inquiryDecline: {
    en: {
      subject: (ws: string) => `An update on your inquiry - ${ws}`,
      greeting: (name: string) => `Hi ${name},`,
      body1: (ws: string) => `Thank you for reaching out to ${ws}. Unfortunately, we are unable to accommodate your request at this time.`,
      body2: `We wish you all the best and hope to work together in the future.`,
    },
    fil: {
      subject: (ws: string) => `Isang update sa iyong katanungan - ${ws}`,
      greeting: (name: string) => `Kumusta ${name},`,
      body1: (ws: string) => `Salamat sa pagkomunika sa ${ws}. Sa kasamaang-palad, hindi namin matutugunan ang iyong kahilingan sa ngayon.`,
      body2: `Nagnanais kami sa inyo ng lahat ng pinakamabuti at umaasa kaming magtrabaho nang magkasama sa hinaharap.`,
    },
    ms: {
      subject: (ws: string) => `Kemaskini mengenai pertanyaan anda - ${ws}`,
      greeting: (name: string) => `Hai ${name},`,
      body1: (ws: string) => `Terima kasih kerana menghubungi ${ws}. Malangnya, kami tidak dapat memenuhi permintaan anda pada masa ini.`,
      body2: `Kami mengucapkan yang terbaik untuk anda dan berharap dapat bekerjasama pada masa hadapan.`,
    },
    id: {
      subject: (ws: string) => `Pembaruan mengenai pertanyaan Anda - ${ws}`,
      greeting: (name: string) => `Halo ${name},`,
      body1: (ws: string) => `Terima kasih telah menghubungi ${ws}. Sayangnya, kami tidak dapat memenuhi permintaan Anda saat ini.`,
      body2: `Kami mengucapkan semoga sukses dan berharap dapat bekerja sama di masa depan.`,
    },
  },
  // email_verification.created fires during sign-up, before the user has any
  // workspace, so there is no reliable locale signal. Resolve to "en" — the
  // established convention for platform emails (see sendInquiryNotification /
  // sendBookingConfirmedOwner). All 4 locales are defined to satisfy the type
  // but "en" is always used for this platform-level flow.
  verification: {
    en: {
      subject: "Verify your email - Gallurio",
      greeting: "Hi there,",
      intro: "Use this code to verify your email address:",
      codeLabel: "Verification code",
      expiry: "This code expires soon. Do not share it with anyone.",
      ignore: "If you didn't create a Gallurio account, you can ignore this email.",
    },
    fil: {
      subject: "I-verify ang iyong email - Gallurio",
      greeting: "Kumusta,",
      intro: "Gamitin ang code na ito upang i-verify ang iyong email address:",
      codeLabel: "Verification code",
      expiry: "Mag-eexpire ang code na ito sa lalong madaling panahon. Huwag itong ibahagi sa iba.",
      ignore: "Kung hindi ka gumawa ng Gallurio account, maaari mong balewalain ang email na ito.",
    },
    ms: {
      subject: "Sahkan e-mel anda - Gallurio",
      greeting: "Hai,",
      intro: "Gunakan kod ini untuk mengesahkan alamat e-mel anda:",
      codeLabel: "Kod pengesahan",
      expiry: "Kod ini akan tamat tempoh tidak lama lagi. Jangan kongsi dengan sesiapa.",
      ignore: "Jika anda tidak mencipta akaun Gallurio, anda boleh mengabaikan e-mel ini.",
    },
    id: {
      subject: "Verifikasi email Anda - Gallurio",
      greeting: "Halo,",
      intro: "Gunakan kode ini untuk memverifikasi alamat email Anda:",
      codeLabel: "Kode verifikasi",
      expiry: "Kode ini akan segera kedaluwarsa. Jangan bagikan kepada siapapun.",
      ignore: "Jika Anda tidak membuat akun Gallurio, Anda bisa mengabaikan email ini.",
    },
  },
} as const satisfies EmailCopyMap;
