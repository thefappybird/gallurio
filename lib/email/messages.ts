import { localeForCountry } from "@/lib/i18n/localeForCountry";

type Locale = "en" | "fil" | "id" | "th";

// Email copy is authored for en/fil/id/th only — Arabic email copy is deferred
// (see lib/i18n/localeForCountry.ts, which keeps Gulf tenants on "en" for now,
// so localeForCountry never returns "ar" at runtime). The cast narrows the
// return type to the email-supported locales; when the Arabic flip lands it must
// add an "ar" EMAIL_COPY catalog and widen Locale here.
export const emailLocale = localeForCountry as (
  country: string | null | undefined,
) => Locale;

// Lifecycle emails (lapse-warning/expired/remind1/remind2) additionally
// support Arabic — narrower than the dashboard/portfolio RTL flip, which is
// still deferred (see lib/i18n/localeForCountry.ts). Duplicated here rather
// than exported from localeForCountry.ts, whose job is public-chrome
// resolution, not a shared Gulf-country registry.
export type LifecycleLocale = Locale | "ar";

const GULF_COUNTRIES = new Set(["AE", "SA", "QA", "KW", "OM", "BH"]);

export function lifecycleEmailLocale(country: string | null | undefined): LifecycleLocale {
  if (GULF_COUNTRIES.has((country ?? "").toUpperCase())) return "ar";
  return localeForCountry(country);
}

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

type LifecycleCopy = {
  subject: string;
  heading: string;
  body: string;
  cta: string;
};

type EmailCopyMap = {
  teamInvite: Record<Locale, TeamInviteCopy>;
  inquiryConfirmation: Record<Locale, InquiryConfirmationCopy>;
  passwordReset: Record<Locale, PasswordResetCopy>;
  bookingConfirmedClient: Record<Locale, BookingConfirmedClientCopy>;
  bookingCancelledClient: Record<Locale, BookingCancelledClientCopy>;
  inquiryDecline: Record<Locale, InquiryDeclineCopy>;
  verification: Record<Locale, VerificationCopy>;
  lifecyclePreExpiry: Record<LifecycleLocale, LifecycleCopy>;
  lifecycleExpired: Record<LifecycleLocale, LifecycleCopy>;
  lifecycleRemind1: Record<LifecycleLocale, LifecycleCopy>;
  lifecycleRemind2: Record<LifecycleLocale, LifecycleCopy>;
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
    th: {
      subject: (ws: string) => `คุณได้รับเชิญให้เข้าร่วม ${ws}`,
      greeting: `สวัสดีครับ/ค่ะ,`,
      body: (inviter: string, ws: string) =>
        `${inviter} ได้เชิญคุณให้เข้าร่วมพื้นที่ทำงาน ${ws} บน Gallurio`,
      teamsIntro: (teamsJoined: string, _plural: boolean) =>
        `คุณจะถูกเพิ่มเข้าทีมต่อไปนี้: ${teamsJoined}`,
      cta: "ยอมรับคำเชิญ",
      expiry: "คำเชิญนี้จะหมดอายุใน 7 วัน",
      footer: "หากคุณไม่ได้คาดหวังคำเชิญนี้ คุณสามารถละเว้นอีเมลนี้ได้อย่างปลอดภัย",
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
      subject: (ws: string) => `Your inquiry is with ${ws}`,
      greeting: (name: string) => `Hi ${name},`,
      body1: (ws: string) => `Thank you for getting in touch with ${ws}. We're so glad you reached out.`,
      body2: () => `Your inquiry is safely with the team, and someone will be in touch soon.`,
      body3: () => `We appreciate you considering us for your event.`,
    },
    fil: {
      subject: (ws: string) => `Nasa ${ws} na ang iyong katanungan`,
      greeting: (name: string) => `Kumusta ${name},`,
      body1: (ws: string) => `Maraming salamat sa pag-abot sa ${ws}. Ikinagagalak naming nakipag-ugnayan ka.`,
      body2: () => `Ligtas nang naipasa ang iyong katanungan sa team, at may makikipag-ugnayan sa iyo sa lalong madaling panahon.`,
      body3: () => `Salamat sa pagsasaalang-alang sa amin para sa iyong event.`,
    },
    th: {
      subject: (ws: string) => `คำถามของคุณถึง ${ws} แล้ว`,
      greeting: (name: string) => `สวัสดีคุณ ${name},`,
      body1: (ws: string) => `ขอบคุณที่ติดต่อ ${ws} เรายินดีเป็นอย่างยิ่งที่คุณติดต่อมา`,
      body2: () => `คำถามของคุณถึงทีมงานเรียบร้อยแล้ว และจะมีคนติดต่อกลับไปในเร็ว ๆ นี้`,
      body3: () => `เราขอขอบคุณที่คุณพิจารณาเราสำหรับงานของคุณ`,
    },
    id: {
      subject: (ws: string) => `Pertanyaan Anda sudah bersama ${ws}`,
      greeting: (name: string) => `Halo ${name},`,
      body1: (ws: string) => `Terima kasih telah menghubungi ${ws}. Kami sangat senang Anda menghubungi kami.`,
      body2: () => `Pertanyaan Anda sudah diterima dengan baik oleh tim, dan seseorang akan segera menghubungi Anda.`,
      body3: () => `Kami menghargai Anda telah mempertimbangkan kami untuk acara Anda.`,
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
    th: {
      subject: "รีเซ็ตรหัสผ่าน Gallurio ของคุณ",
      intro: "เราได้รับคำขอให้รีเซ็ตรหัสผ่านสำหรับบัญชีของคุณ คลิกปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่",
      cta: "รีเซ็ตรหัสผ่าน",
      expiry: "ลิงก์นี้จะหมดอายุในไม่ช้า หากคุณไม่ได้ร้องขอการรีเซ็ตรหัสผ่าน คุณสามารถละเว้นอีเมลนี้ได้อย่างปลอดภัย",
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
    th: {
      subject: (ws: string) => `การจองของคุณได้รับการยืนยันแล้ว - ${ws}`,
      greeting: (name: string) => `สวัสดีคุณ ${name},`,
      body1: (ws: string) => `ข่าวดี! ${ws} ได้ยืนยันการจองของคุณแล้ว`,
      body2: (eventTitle: string) => `กิจกรรม: ${eventTitle}`,
      sessions: (dates: string) => `วันที่: ${dates}`,
      body3: (ws: string) => `เรารอคอยที่จะได้ร่วมงานกับคุณ หากมีคำถามใด ๆ กรุณาติดต่อ ${ws}`,
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
    th: {
      subject: (ws: string) => `การจองของคุณถูกยกเลิกแล้ว - ${ws}`,
      greeting: (name: string) => `สวัสดีคุณ ${name},`,
      body1: (ws: string) => `เราต้องการแจ้งให้ทราบว่าการจองของคุณกับ ${ws} ถูกยกเลิกแล้ว`,
      body2: (eventTitle: string) => `กิจกรรม: ${eventTitle}`,
      sessions: (dates: string) => `วันที่: ${dates}`,
      body3: (ws: string) => `หากมีคำถามใด ๆ กรุณาติดต่อ ${ws}`,
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
    th: {
      subject: (ws: string) => `อัปเดตเกี่ยวกับคำถามของคุณ - ${ws}`,
      greeting: (name: string) => `สวัสดีคุณ ${name},`,
      body1: (ws: string) => `ขอบคุณที่ติดต่อ ${ws} แต่น่าเสียดายที่เราไม่สามารถรองรับคำขอของคุณได้ในขณะนี้`,
      body2: `เราขออวยพรให้คุณโชคดี และหวังว่าจะได้ร่วมงานกันในอนาคต`,
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
    th: {
      subject: "ยืนยันอีเมลของคุณ - Gallurio",
      greeting: "สวัสดีครับ/ค่ะ,",
      intro: "ใช้รหัสนี้เพื่อยืนยันที่อยู่อีเมลของคุณ:",
      codeLabel: "รหัสยืนยัน",
      expiry: "รหัสนี้จะหมดอายุในไม่ช้า อย่าแชร์ให้ผู้อื่น",
      ignore: "หากคุณไม่ได้สร้างบัญชี Gallurio คุณสามารถละเว้นอีเมลนี้ได้",
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
  lifecyclePreExpiry: {
    en: {
      subject: "Your Gallurio Pro access ends in a week",
      heading: "A week left of full access",
      body: "Your free month of Gallurio Pro ends in 7 days. Subscribe now to keep your portfolio online and all your bookings, clients, and gallery intact.",
      cta: "Subscribe to Pro",
    },
    fil: {
      subject: "Magtatapos sa isang linggo ang access mo sa Gallurio Pro",
      heading: "Isang linggo na lang ang natitirang buong access",
      body: "Magtatapos sa loob ng 7 araw ang iyong libreng buwan ng Gallurio Pro. Mag-subscribe na ngayon para manatiling online ang iyong portfolio at ligtas ang lahat ng booking, client, at gallery.",
      cta: "Mag-subscribe sa Pro",
    },
    id: {
      subject: "Akses Gallurio Pro Anda berakhir dalam seminggu",
      heading: "Seminggu lagi akses penuh Anda",
      body: "Bulan gratis Gallurio Pro Anda akan berakhir dalam 7 hari. Berlangganan sekarang agar portofolio Anda tetap online dan semua pemesanan, klien, serta galeri tetap aman.",
      cta: "Berlangganan Pro",
    },
    th: {
      subject: "สิทธิ์การใช้งาน Gallurio Pro ของคุณจะหมดอายุในอีกหนึ่งสัปดาห์",
      heading: "เหลือเวลาใช้งานเต็มรูปแบบอีกหนึ่งสัปดาห์",
      body: "เดือนฟรีของ Gallurio Pro จะหมดอายุใน 7 วัน สมัครสมาชิกตอนนี้เพื่อให้พอร์ตโฟลิโอของคุณออนไลน์อยู่เสมอ พร้อมรักษาการจอง ลูกค้า และแกลเลอรีทั้งหมดของคุณไว้",
      cta: "สมัครสมาชิก Pro",
    },
    ar: {
      subject: "وصولك إلى Gallurio Pro ينتهي خلال أسبوع",
      heading: "أسبوع واحد متبقٍ من الوصول الكامل",
      body: "ينتهي شهرك المجاني من Gallurio Pro خلال 7 أيام. اشترك الآن للحفاظ على صفحتك العامة متاحة على الإنترنت وبقاء جميع حجوزاتك وعملائك ومعرضك سليمة.",
      cta: "اشترك في Pro",
    },
  },
  lifecycleExpired: {
    en: {
      subject: "Your Gallurio Pro access has ended",
      heading: "Your access has ended",
      body: "Your Pro access has ended, but nothing is lost — your site and all your data are safely saved. Subscribe to bring your portfolio back online instantly.",
      cta: "Resubscribe",
    },
    fil: {
      subject: "Natapos na ang iyong access sa Gallurio Pro",
      heading: "Natapos na ang iyong access",
      body: "Natapos na ang iyong Pro access, pero walang nawala — ligtas na naka-save ang iyong site at lahat ng data mo. Mag-subscribe muli para agad na ma-online ulit ang iyong portfolio.",
      cta: "Mag-subscribe muli",
    },
    id: {
      subject: "Akses Gallurio Pro Anda telah berakhir",
      heading: "Akses Anda telah berakhir",
      body: "Akses Pro Anda telah berakhir, tetapi tidak ada yang hilang — situs dan semua data Anda tersimpan dengan aman. Berlangganan kembali untuk mengaktifkan kembali portofolio Anda secara instan.",
      cta: "Berlangganan kembali",
    },
    th: {
      subject: "สิทธิ์การใช้งาน Gallurio Pro ของคุณสิ้นสุดลงแล้ว",
      heading: "สิทธิ์การใช้งานของคุณสิ้นสุดลงแล้ว",
      body: "สิทธิ์การใช้งาน Pro ของคุณสิ้นสุดลงแล้ว แต่ไม่มีอะไรสูญหาย เว็บไซต์และข้อมูลทั้งหมดของคุณถูกบันทึกไว้อย่างปลอดภัย สมัครสมาชิกเพื่อเปิดพอร์ตโฟลิโอของคุณกลับมาออนไลน์ได้ทันที",
      cta: "สมัครสมาชิกอีกครั้ง",
    },
    ar: {
      subject: "انتهى وصولك إلى Gallurio Pro",
      heading: "انتهى وصولك",
      body: "انتهى وصولك إلى Pro، لكن لا شيء ضاع — موقعك وجميع بياناتك محفوظة بأمان. اشترك لإعادة نشر صفحتك العامة فورًا.",
      cta: "أعد الاشتراك",
    },
  },
  lifecycleRemind1: {
    en: {
      subject: "Your portfolio is still saved on Gallurio",
      heading: "We saved everything for you",
      body: "It's been a month. Your portfolio and data are still saved and ready. Resubscribe anytime to pick up exactly where you left off.",
      cta: "Resubscribe",
    },
    fil: {
      subject: "Naka-save pa rin ang iyong portfolio sa Gallurio",
      heading: "Sinave namin lahat para sa iyo",
      body: "Isang buwan na ang nakalipas. Naka-save pa rin at handa ang iyong portfolio at data. Mag-subscribe muli anumang oras para ituloy mula sa kung saan ka huminto.",
      cta: "Mag-subscribe muli",
    },
    id: {
      subject: "Portofolio Anda masih tersimpan di Gallurio",
      heading: "Kami menyimpan semuanya untuk Anda",
      body: "Sudah sebulan berlalu. Portofolio dan data Anda masih tersimpan dan siap. Berlangganan kembali kapan saja untuk melanjutkan dari tempat Anda berhenti.",
      cta: "Berlangganan kembali",
    },
    th: {
      subject: "พอร์ตโฟลิโอของคุณยังคงถูกบันทึกไว้ที่ Gallurio",
      heading: "เราบันทึกทุกอย่างไว้ให้คุณแล้ว",
      body: "ผ่านมาหนึ่งเดือนแล้ว พอร์ตโฟลิโอและข้อมูลของคุณยังคงถูกบันทึกและพร้อมใช้งาน สมัครสมาชิกอีกครั้งได้ทุกเมื่อเพื่อดำเนินการต่อจากจุดที่คุณค้างไว้",
      cta: "สมัครสมาชิกอีกครั้ง",
    },
    ar: {
      subject: "لا تزال صفحتك محفوظة على Gallurio",
      heading: "حفظنا كل شيء من أجلك",
      body: "مرّ شهر كامل. لا تزال صفحتك العامة وبياناتك محفوظة وجاهزة. أعد الاشتراك في أي وقت لتكمل تمامًا من حيث توقفت.",
      cta: "أعد الاشتراك",
    },
  },
  lifecycleRemind2: {
    en: {
      subject: "Last week to keep your portfolio online",
      heading: "Final reminder",
      body: "Your published site will be taken offline in one week unless you resubscribe. Your bookings, clients, and gallery stay safe either way — but resubscribe now to keep your site live.",
      cta: "Resubscribe",
    },
    fil: {
      subject: "Huling linggo para manatiling online ang portfolio mo",
      heading: "Huling paalala",
      body: "Mao-offline ang iyong naka-publish na site sa loob ng isang linggo maliban kung mag-subscribe ka muli. Ligtas pa rin ang iyong mga booking, client, at gallery — pero mag-subscribe na ngayon para manatiling live ang iyong site.",
      cta: "Mag-subscribe muli",
    },
    id: {
      subject: "Minggu terakhir untuk menjaga portofolio Anda tetap online",
      heading: "Pengingat terakhir",
      body: "Situs Anda yang telah dipublikasikan akan dinonaktifkan dalam satu minggu kecuali Anda berlangganan kembali. Pemesanan, klien, dan galeri Anda tetap aman — tetapi berlangganan sekarang agar situs Anda tetap aktif.",
      cta: "Berlangganan kembali",
    },
    th: {
      subject: "สัปดาห์สุดท้ายเพื่อให้พอร์ตโฟลิโอของคุณออนไลน์อยู่",
      heading: "การแจ้งเตือนครั้งสุดท้าย",
      body: "เว็บไซต์ที่เผยแพร่ของคุณจะถูกนำออกจากระบบออนไลน์ในอีกหนึ่งสัปดาห์ เว้นแต่คุณจะสมัครสมาชิกอีกครั้ง การจอง ลูกค้า และแกลเลอรีของคุณยังคงปลอดภัยไม่ว่าจะเกิดอะไรขึ้น แต่สมัครสมาชิกตอนนี้เพื่อให้เว็บไซต์ของคุณใช้งานได้ต่อไป",
      cta: "สมัครสมาชิกอีกครั้ง",
    },
    ar: {
      subject: "الأسبوع الأخير للحفاظ على صفحتك متاحة على الإنترنت",
      heading: "تذكير أخير",
      body: "سيتم إيقاف موقعك المنشور خلال أسبوع واحد ما لم تُعد الاشتراك. تبقى حجوزاتك وعملاؤك ومعرضك بأمان في كل الأحوال — لكن أعد الاشتراك الآن لإبقاء موقعك نشطًا.",
      cta: "أعد الاشتراك",
    },
  },
} as const satisfies EmailCopyMap;
