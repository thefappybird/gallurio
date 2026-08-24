import Image from "next/image";

const MEDIA = {
  "dashboard-overview": {
    alt: "Gallurio dashboard showing revenue, upcoming bookings, and recent activity",
    label: "Gallurio dashboard",
    caption: "Revenue, upcoming work, and recent activity stay visible from one workspace dashboard.",
  },
  "bookings-list": {
    alt: "Gallurio bookings list with clients, event dates, statuses, and payment totals",
    label: "Gallurio bookings page",
    caption: "A structured booking list replaces the spreadsheet row that has to carry everything.",
  },
  "booking-detail-invoice": {
    alt: "Gallurio booking payment detail showing the total, deposit, paid and unpaid balances, and invoice download action",
    label: "Gallurio booking payments",
    caption: "The booking keeps its total, deposit, payment status, outstanding balance, and invoice action together.",
  },
  "calendar-month": {
    alt: "Gallurio month calendar populated with event bookings and status colours",
    label: "Gallurio bookings calendar",
    caption: "The booking calendar makes workload and date conflicts visible without rebuilding a spreadsheet view.",
  },
  "client-record": {
    alt: "Gallurio client record showing contact details, total spent, booking count, tags, and notes",
    label: "Gallurio client record",
    caption: "A client record keeps contact context, lifetime value, booking volume, tags, and working notes together.",
  },
  "inquiries-inbox": {
    alt: "Gallurio inquiry inbox showing new, read, and converted client enquiries",
    label: "Gallurio inquiries inbox",
    caption: "New enquiries arrive in a dedicated inbox instead of mixing with unrelated email.",
  },
  "invoice-pdf": {
    alt: "A branded invoice PDF generated from a Gallurio booking",
    label: "Gallurio invoice PDF",
    caption: "Invoice PDFs are generated from the booking information already in the workspace.",
  },
  "teams-overview": {
    alt: "Gallurio teams page showing workspace members and their roles",
    label: "Gallurio teams page",
    caption: "Workspace roles give a team shared access without sharing a personal login.",
  },
  "editor-canvas": {
    alt: "Gallurio portfolio editor showing a published page in the drag-and-drop canvas",
    label: "Gallurio portfolio editor",
    caption: "The portfolio editor uses the same blocks that render on the published public page.",
  },
  "editor-theme-panel": {
    alt: "Gallurio portfolio editor theme panel with brand colours, fonts, and control styling",
    label: "Gallurio portfolio theme panel",
    caption: "Brand colours, typography, and controls are managed as one reusable visual system.",
  },
  "public-page-desktop": {
    alt: "A published Gallurio event-business portfolio displayed on desktop",
    label: "Gallurio public portfolio",
    caption: "The published portfolio gives prospective clients a focused path from the work to an enquiry.",
  },
  "public-page-mobile": {
    alt: "A published Gallurio event-business portfolio displayed at mobile width",
    label: "Gallurio mobile portfolio",
    caption: "The same public portfolio is designed to remain readable and actionable on a phone.",
  },
  "public-gallery": {
    alt: "A populated image gallery on a published Gallurio portfolio",
    label: "Gallurio public gallery",
    caption: "A public gallery presents selected work as part of the booking site, not as a separate admin tool.",
  },
  "public-contact-form": {
    alt: "The contact and booking inquiry form on a published Gallurio portfolio",
    label: "Gallurio public contact form",
    caption: "The public contact form is the front door to the inquiry, client, and booking workflow.",
    width: 375,
    height: 812,
    portrait: true,
  },
  "flow-1-inquiry-submitted": {
    alt: "Step one of the Gallurio inquiry flow with fictional contact details entered in the public form before submission",
    label: "Gallurio inquiry flow — public form",
    caption: "Step 1: a prospective client begins with contact details on the public page; this capture was not submitted.",
    width: 375,
    height: 812,
    portrait: true,
  },
  "flow-2-inquiry-received": {
    alt: "Step two of the Gallurio inquiry flow showing an approved inquiry and its linked booking action",
    label: "Gallurio inquiry flow — inquiry record",
    caption: "Step 2: the inquiry history records its approval and provides a direct path to the booking.",
  },
  "flow-3-client-and-booking": {
    alt: "Step three of the Gallurio inquiry flow showing the matching client record and its booked event",
    label: "Gallurio inquiry flow — client and booking",
    caption: "Step 3: the matching client record shows the booked event, date, status, and value.",
  },
} as const;

export type ProductShotId = keyof typeof MEDIA;

export function ProductShot({ id }: { id: ProductShotId }) {
  const media = MEDIA[id];
  const src = `/marketing/editorial/${id}.png`;
  const width = "width" in media ? media.width : 1280;
  const height = "height" in media ? media.height : 800;
  const portrait = "portrait" in media && media.portrait;

  return (
    <figure className={`my-10 ${portrait ? "mx-auto max-w-sm" : ""}`}>
      <a href={src} target="_blank" rel="noreferrer" aria-label={`Open full-size image: ${media.alt}`} className="block bg-muted ring-1 ring-foreground/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <Image src={src} alt={media.alt} width={width} height={height} sizes={portrait ? "(max-width: 448px) 100vw, 375px" : "(max-width: 768px) 100vw, 768px"} className="h-auto w-full" />
      </a>
      <figcaption className="mt-3 text-sm leading-6">
        <span className="block font-semibold text-foreground">{media.label}</span>
        <span className="mt-0.5 block text-muted-foreground">{media.caption}</span>
      </figcaption>
    </figure>
  );
}
