import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { formatMoney } from "@/lib/utils/format-currency";

export type InvoiceData = {
  invoiceNumber: string;
  issueDate: Date;
  business: { name: string; logoUrl: string; address: string; email: string; accentColor: string };
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

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    color: "#111111",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  logo: {
    width: 64,
    height: 64,
    marginBottom: 8,
    objectFit: "contain",
  },
  businessName: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 4,
  },
  businessMeta: {
    fontSize: 10,
    color: "#111111",
  },
  headerRight: {
    alignItems: "flex-end",
  },
  invoiceTitle: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4,
  },
  divider: {
    height: 2,
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 6,
  },
  line: {
    fontSize: 10,
    marginBottom: 2,
  },
  table: {
    marginTop: 8,
  },
  tableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  tableRowEmphasis: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  tableLabel: {
    fontSize: 10,
  },
  tableLabelEmphasis: {
    fontSize: 11,
    fontWeight: 700,
  },
  tableValue: {
    fontSize: 10,
  },
  tableValueEmphasis: {
    fontSize: 11,
    fontWeight: 700,
  },
});

export function InvoiceDocument({ data }: { data: InvoiceData }) {
  const { business, client, booking, amount, locale } = data;
  const balanceDue = amount.total - amount.deposit;

  const dateFmt = new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" });
  const sessionRange =
    booking.sessionStart && booking.sessionEnd
      ? `${dateFmt.format(booking.sessionStart)} - ${dateFmt.format(booking.sessionEnd)}`
      : null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            {business.logoUrl ? <Image src={business.logoUrl} style={styles.logo} /> : null}
            <Text style={styles.businessName}>{business.name}</Text>
            {business.address ? <Text style={styles.businessMeta}>{business.address}</Text> : null}
            {business.email ? <Text style={styles.businessMeta}>{business.email}</Text> : null}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.invoiceTitle}>Invoice</Text>
            <Text style={styles.line}>{data.invoiceNumber}</Text>
            <Text style={styles.line}>{dateFmt.format(data.issueDate)}</Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: business.accentColor }]} />

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Bill To</Text>
          <Text style={styles.line}>{client.name}</Text>
          {client.email ? <Text style={styles.line}>{client.email}</Text> : null}
          {client.phone ? <Text style={styles.line}>{client.phone}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Event Details</Text>
          <Text style={styles.line}>{booking.title}</Text>
          <Text style={styles.line}>{booking.eventType}</Text>
          {sessionRange ? <Text style={styles.line}>{sessionRange}</Text> : null}
          {booking.locationAddress ? <Text style={styles.line}>{booking.locationAddress}</Text> : null}
        </View>

        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Total</Text>
            <Text style={styles.tableValue}>{formatMoney(amount.total, amount.currency, locale)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Deposit paid</Text>
            <Text style={styles.tableValue}>{formatMoney(amount.deposit, amount.currency, locale)}</Text>
          </View>
          <View style={styles.tableRowEmphasis}>
            <Text style={styles.tableLabelEmphasis}>Balance due</Text>
            <Text style={styles.tableValueEmphasis}>{formatMoney(balanceDue, amount.currency, locale)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
