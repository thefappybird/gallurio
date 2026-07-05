import { View, Text, Image, StyleSheet } from "@react-pdf/renderer";

export type PdfTheme = { main: string; accent: string };

export function buildInvoiceStyles(theme: PdfTheme) {
  return StyleSheet.create({
    page: { padding: 0, fontSize: 10, color: "#111111" },
    content: { paddingHorizontal: 40 },
    headerBlock: {
      backgroundColor: theme.main,
      paddingHorizontal: 32,
      paddingVertical: 28,
      flexDirection: "row",
      justifyContent: "space-between",
    },
    footerBlock: {
      backgroundColor: theme.main,
      paddingHorizontal: 32,
      paddingVertical: 28,
      flexDirection: "row",
      justifyContent: "space-between",
    },
    accentStrip: { height: 4, backgroundColor: theme.accent },
    logo: { width: 40, height: 40, marginBottom: 8, objectFit: "contain" },
    businessName: { fontSize: 18, fontWeight: 700, color: "#FFFFFF", marginBottom: 4 },
    businessMeta: { fontSize: 9, color: "rgba(255,255,255,0.75)" },
    headerRight: { alignItems: "flex-end" },
    kindLabel: { fontSize: 10, color: "#FFFFFF", letterSpacing: 2, marginBottom: 6 },
    docNumber: { fontSize: 16, fontWeight: 700, color: "#FFFFFF", marginBottom: 4 },
    docDate: { fontSize: 9, color: "rgba(255,255,255,0.75)" },
    infoGrid: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 16,
      marginTop: 24,
      marginBottom: 20,
      borderTopWidth: 1,
      borderTopColor: "#e5e5e5",
      borderBottomWidth: 1,
      borderBottomColor: "#e5e5e5",
    },
    infoCell: { flexGrow: 1, flexBasis: 0, paddingRight: 8 },
    infoLabel: { fontSize: 8, fontWeight: 700, color: "#6b7280", letterSpacing: 1, marginBottom: 6 },
    infoLine: { fontSize: 10, fontWeight: 700, marginBottom: 2 },
    table: { marginTop: 8, marginBottom: 20 },
    tableRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
    tableRowEmphasis: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 8,
      marginTop: 4,
      borderTopWidth: 1,
      borderTopColor: "#111111",
    },
    tableLabel: { fontSize: 10 },
    tableLabelEmphasis: { fontSize: 12, fontWeight: 700 },
    tableValue: { fontSize: 10 },
    tableValueEmphasis: { fontSize: 12, fontWeight: 700 },
    thankYou: { fontSize: 17, fontWeight: 700, color: "#FFFFFF" },
    poweredBy: { fontSize: 8, color: "#9ca3af", textAlign: "center", marginTop: 8, marginBottom: 8 },
  });
}

type PdfStyles = ReturnType<typeof buildInvoiceStyles>;

export function DocumentHeader({
  kind,
  business,
  number,
  date,
  locale,
  styles,
}: {
  kind: "invoice" | "receipt";
  business: { name: string; logoUrl: string; address: string };
  number: string;
  date: Date;
  locale: string;
  styles: PdfStyles;
}) {
  const dateFmt = new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" });
  return (
    <>
      <View style={styles.headerBlock}>
        <View>
          {business.logoUrl ? <Image src={business.logoUrl} style={styles.logo} /> : null}
          <Text style={styles.businessName}>{business.name}</Text>
          {business.address ? <Text style={styles.businessMeta}>{business.address}</Text> : null}
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.kindLabel}>{kind === "invoice" ? "INVOICE" : "RECEIPT"}</Text>
          <Text style={styles.docNumber}>{number}</Text>
          <Text style={styles.docDate}>{dateFmt.format(date)}</Text>
        </View>
      </View>
      <View style={styles.accentStrip} />
    </>
  );
}

export function DocumentFooter({
  business,
  styles,
}: {
  business: { address: string; email: string };
  styles: PdfStyles;
}) {
  return (
    <>
      <View style={styles.footerBlock}>
        <View>
          {business.address ? <Text style={styles.businessMeta}>{business.address}</Text> : null}
          {business.email ? <Text style={styles.businessMeta}>{business.email}</Text> : null}
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.thankYou}>THANK YOU</Text>
        </View>
      </View>
      <Text style={styles.poweredBy}>Powered by Gallurio</Text>
    </>
  );
}

export type InfoCell = { label: string; lines: string[] };

export function InfoGrid({ cells, styles }: { cells: InfoCell[]; styles: PdfStyles }) {
  return (
    <View style={styles.infoGrid}>
      {cells.map((cell, i) => (
        <View key={i} style={styles.infoCell}>
          <Text style={styles.infoLabel}>{cell.label}</Text>
          {cell.lines.map((line, j) => (
            <Text key={j} style={styles.infoLine}>{line}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}
