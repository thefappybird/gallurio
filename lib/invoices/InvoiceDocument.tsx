import { Document, Page, View, Text } from "@react-pdf/renderer";
import { formatMoney } from "@/lib/utils/format-currency";
import { buildInvoiceStyles, DocumentHeader, DocumentFooter, InfoGrid, type PdfTheme } from "./pdfShared";

export type InvoiceData = {
  invoiceNumber: string;
  issueDate: Date;
  business: { name: string; logoUrl: string; address: string; email: string; theme: PdfTheme };
  client: { name: string; email: string | null; phone: string | null };
  booking: {
    title: string;
    eventType: string;
    sessionStart: Date | null;
    sessionEnd: Date | null;
    locationAddress: string;
  };
  amount: { total: number; deposit: number; currency: string };
  locale: string;
};

export function InvoiceDocument({ data }: { data: InvoiceData }) {
  const { business, client, booking, amount, locale } = data;
  const balanceDue = amount.total - amount.deposit;
  const styles = buildInvoiceStyles(business.theme);

  const dateFmt = new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" });
  const sessionRange =
    booking.sessionStart && booking.sessionEnd
      ? `${dateFmt.format(booking.sessionStart)} - ${dateFmt.format(booking.sessionEnd)}`
      : null;

  const infoCells = [
    {
      label: "BILL TO",
      lines: [client.name, client.email, client.phone].filter((v): v is string => Boolean(v)),
    },
    { label: "EVENT", lines: [booking.title, booking.eventType].filter(Boolean) },
    { label: "LOCATION", lines: [booking.locationAddress || "—"] },
    { label: "DATE", lines: [sessionRange ?? "—"] },
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <DocumentHeader
          kind="invoice"
          business={business}
          number={data.invoiceNumber}
          date={data.issueDate}
          locale={locale}
          styles={styles}
        />

        <View style={styles.content}>
          <InfoGrid cells={infoCells} styles={styles} />

          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={styles.tableLabel}>Total</Text>
              <Text style={styles.tableValue}>{formatMoney(amount.total, amount.currency, locale, { currencyDisplay: "code" })}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableLabel}>Deposit paid</Text>
              <Text style={styles.tableValue}>{formatMoney(amount.deposit, amount.currency, locale, { currencyDisplay: "code" })}</Text>
            </View>
            <View style={styles.tableRowEmphasis}>
              <Text style={styles.tableLabelEmphasis}>Balance due</Text>
              <Text style={styles.tableValueEmphasis}>{formatMoney(balanceDue, amount.currency, locale, { currencyDisplay: "code" })}</Text>
            </View>
          </View>
        </View>

        <DocumentFooter business={business} styles={styles} />
      </Page>
    </Document>
  );
}
