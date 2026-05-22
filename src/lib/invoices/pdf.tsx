"use client";

import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export type InvoicePdfLine = {
  title: string;
  quantity: number;
  unitPrice: number;
};

export type InvoicePdfData = {
  invoiceNo: string;
  orderId: string;
  createdAtText: string;
  currency: "MYR" | "SGD";
  customerName: string;
  customerPhone: string;
  companyName: string;
  companyRegNo: string;
  companyAddress: string;
  lines: InvoicePdfLine[];
  subtotal: number;
  shippingFee: number;
  discountTotal: number;
  total: number;
};

const styles = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 28, paddingLeft: 32, paddingRight: 32, fontSize: 11, color: "#0f172a" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  title: { fontSize: 20, fontWeight: 700 },
  companyBlock: { width: 250, textAlign: "right" },
  companyName: { fontSize: 11, fontWeight: 700 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 14, marginBottom: 18 },
  box: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: 10 },
  boxTitle: { fontSize: 9, fontWeight: 700, color: "#64748b" },
  boxValue: { marginTop: 6, fontSize: 11, fontWeight: 700 },
  table: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, overflow: "hidden" },
  tableHead: { flexDirection: "row", backgroundColor: "#f8fafc", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  th: { paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10, fontSize: 9, fontWeight: 700, color: "#334155" },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  td: { paddingTop: 9, paddingBottom: 9, paddingLeft: 10, paddingRight: 10 },
  colItem: { flexGrow: 1, flexBasis: 0 },
  colQty: { width: 40, textAlign: "right" },
  colUnit: { width: 90, textAlign: "right" },
  colAmt: { width: 100, textAlign: "right" },
  totalsWrap: { marginTop: 14, flexDirection: "row", justifyContent: "flex-end" },
  totalsBox: { width: 220, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: 10, backgroundColor: "#f8fafc" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  totalLabel: { color: "#64748b" },
  totalValue: { fontWeight: 700 },
  grandTotalRow: { borderTopWidth: 1, borderTopColor: "#e2e8f0", marginTop: 8, paddingTop: 8 },
  footnote: { marginTop: 16, fontSize: 9, color: "#64748b" },
});

function formatMoney(currency: "MYR" | "SGD", amount: number) {
  const prefix = currency === "SGD" ? "S$" : "RM";
  return `${prefix} ${Number(amount).toFixed(2)}`;
}

export function InvoicePdfDocument(props: { data: InvoicePdfData }) {
  const { data } = props;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>INVOICE</Text>
            <Text>Order {data.orderId}</Text>
          </View>
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>{data.companyName}</Text>
            <Text>{data.companyRegNo}</Text>
            <Text>{data.companyAddress}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={[styles.box, { flex: 1, marginRight: 10 }]}>
            <Text style={styles.boxTitle}>Bill To</Text>
            <Text style={styles.boxValue}>{data.customerName}</Text>
            <Text>{data.customerPhone}</Text>
          </View>
          <View style={[styles.box, { flex: 1 }]}>
            <Text style={styles.boxTitle}>Invoice Info</Text>
            <Text style={styles.boxValue}>{data.invoiceNo}</Text>
            <Text>Currency: {data.currency}</Text>
            <Text>Date: {data.createdAtText}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.th, styles.colItem]}>Item</Text>
            <Text style={[styles.th, styles.colQty]}>Qty</Text>
            <Text style={[styles.th, styles.colUnit]}>Unit</Text>
            <Text style={[styles.th, styles.colAmt]}>Amount</Text>
          </View>
          {data.lines.map((line, idx) => {
            const lineTotal = Number(line.unitPrice) * Number(line.quantity);
            return (
              <View key={`${idx}-${line.title}`} style={styles.tr}>
                <Text style={[styles.td, styles.colItem]}>{line.title}</Text>
                <Text style={[styles.td, styles.colQty]}>{line.quantity}</Text>
                <Text style={[styles.td, styles.colUnit]}>{formatMoney(data.currency, line.unitPrice)}</Text>
                <Text style={[styles.td, styles.colAmt]}>{formatMoney(data.currency, lineTotal)}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.totalsWrap}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{formatMoney(data.currency, data.subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Shipping</Text>
              <Text style={styles.totalValue}>{formatMoney(data.currency, data.shippingFee)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Voucher</Text>
              <Text style={styles.totalValue}>- {formatMoney(data.currency, data.discountTotal)}</Text>
            </View>
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={[styles.totalLabel, { fontWeight: 700, color: "#0f172a" }]}>Total</Text>
              <Text style={[styles.totalValue, { fontSize: 12 }]}>{formatMoney(data.currency, data.total)}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.footnote}>This invoice is generated automatically. No signature required.</Text>
      </Page>
    </Document>
  );
}

