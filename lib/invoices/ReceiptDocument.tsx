import { Document, Page, View, Text } from "@react-pdf/renderer";
import { formatMoney } from "@/lib/utils/format-currency";
import { buildInvoiceStyles, DocumentHeader, DocumentFooter, InfoGrid, type PdfTheme } from "./pdfShared";

export type ReceiptPayment = { title: string; price: number; status: string; paidAt: string | null };

export type ReceiptData = {
  receiptNumber: string;
  issueDate: Date;
  business: { name: string; logoUrl: string; address: string; email: string; theme: PdfTheme };
  client: { name: string; email: string | null; phone: string | null };
  booking: { title: string; sessionStart: Date | null; sessionEnd: Date | null };
  amount: { total: number; deposit: number; currency: string; payments: ReceiptPayment[] };
  locale: string;
};

export function ReceiptDocument({ data }: { data: ReceiptData }) {
  const { business, client, booking, amount, locale } = data;
  const styles = buildInvoiceStyles(business.theme);
  const paymentsSum = amount.payments.reduce((s, p) => s + p.price, 0);
  const balance = amount.total - amount.deposit - paymentsSum;
  const money = (value: number) => formatMoney(value, amount.currency, locale, { currencyDisplay: "code" });

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
    { label: "EVENT", lines: [booking.title] },
    { label: "DATE", lines: [sessionRange ?? "—"] },
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <DocumentHeader
          kind="receipt"
          business={business}
          number={data.receiptNumber}
          date={data.issueDate}
          locale={locale}
          styles={styles}
        />

        <View style={styles.content}>
          <InfoGrid cells={infoCells} styles={styles} />

          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={styles.tableLabel}>Total</Text>
              <Text style={styles.tableValue}>{money(amount.total)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableLabel}>Deposit</Text>
              <Text style={styles.tableValue}>{money(amount.deposit)}</Text>
            </View>
            {amount.payments.map((payment, i) => (
              <View style={styles.tableRow} key={i}>
                <Text style={styles.tableLabel}>{payment.title || `Payment ${i + 1}`}</Text>
                <Text style={styles.tableValue}>{money(payment.price)}</Text>
              </View>
            ))}
            <View style={styles.tableRowEmphasis}>
              <Text style={styles.tableLabelEmphasis}>Balance</Text>
              <Text style={styles.tableValueEmphasis}>{money(balance)}</Text>
            </View>
          </View>

          <Text style={styles.tableLabel}>
            Issued {dateFmt.format(data.issueDate)}
            {sessionRange ? ` · Event ${sessionRange}` : ""}
          </Text>
          <Text style={[styles.tableLabel, { marginTop: 8 }]}>
            This booking has been paid in full and marked complete.
          </Text>
        </View>

        <DocumentFooter business={business} styles={styles} />
      </Page>
    </Document>
  );
}
