"use server";

import { getFinancialDashboardInternal, getTopSellingProductsInternal, getSalesAnalyticsInternal } from "@/lib/actions/reports";
import { renderTrendChart } from "@/lib/chart-png";
import ExcelJS from "exceljs";

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function exportReportXlsx(which: "week" | "month" | "year" | "day") {
  const now = new Date();
  let start: Date, label: string, groupBy: "day" | "month";
  if (which === "week") {
    start = new Date(now); start.setDate(now.getDate() - 6); label = "Mingguan"; groupBy = "day";
  } else if (which === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1); label = "Bulanan"; groupBy = "day";
  } else if (which === "year") {
    start = new Date(now.getFullYear(), 0, 1); label = "Tahunan"; groupBy = "month";
  } else {
    start = new Date(now); start.setHours(0, 0, 0, 0); label = "Harian"; groupBy = "day";
  }
  const startDate = fmtDate(start);
  const endDate = fmtDate(now);

  const [kpis, topProducts, trends] = await Promise.all([
    getFinancialDashboardInternal({ startDate, endDate }),
    getTopSellingProductsInternal({ limit: 10, startDate, endDate }),
    getSalesAnalyticsInternal({ groupBy, startDate, endDate }),
  ]);
  const fin: any = kpis;

  // ---------- Chart PNG (tren penjualan) ----------
  const chartImage = renderTrendChart(
    trends.map((t) => t.period),
    trends.map((t) => t.total_sales),
    `Tren Penjualan - ${label}`
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MISYourPOS";
  const indigo = "FF4F46E5";
  const indigoLight = "FFEEF2FF";
  const slateAlt = "FFF8FAFC";
  const money: any = '"Rp" #,##0';

  const styleHeaderRow = (row: ExcelJS.Row) => {
    row.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: indigo } };
      cell.font = { color: { argb: "FFFFFFFF" }, bold: true, size: 11 };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin", color: { argb: indigo } },
        bottom: { style: "thin", color: { argb: indigo } },
      };
    });
    row.height = 22;
  };

  const titleCell = (ws: ExcelJS.Worksheet, text: string, sub: string) => {
    ws.mergeCells("A1:D1");
    ws.getCell("A1").value = "MISYourPOS - Laporan Keuangan";
    ws.getCell("A1").font = { size: 16, bold: true, color: { argb: "FFFFFFFF" } };
    ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: indigo } };
    ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 30;
    ws.mergeCells("A2:D2");
    ws.getCell("A2").value = `${sub}  •  Periode: ${label}  •  ${startDate} s/d ${endDate}`;
    ws.getCell("A2").font = { size: 10, italic: true, color: { argb: "FF64748B" } };
    ws.getCell("A2").alignment = { horizontal: "center" };
  };

  // ---------- Sheet 1: Ringkasan ----------
  const ws1 = workbook.addWorksheet("Ringkasan");
  ws1.columns = [{ width: 38 }, { width: 22 }];
  titleCell(ws1, "MISYourPOS - Laporan Keuangan", "Ringkasan Keuangan");
  const h1 = ws1.addRow(["Indikator Keuangan", "Nilai (Rp)"]);
  styleHeaderRow(h1);
  const summary: [string, number | string][] = [
    ["Penjualan Kotor (Gross Sales)", fin.grossSales],
    ["Potongan Diskon", -(fin.totalDiscount ?? fin.discountAmount ?? 0)],
    ["Pengembalian Refund", -(fin.totalRefunds ?? fin.refundsTotal ?? 0)],
    ["Penjualan Bersih (Net Sales)", fin.netSales],
    ["Penjualan Tunai", fin.cashSales],
    ["Penjualan QRIS", fin.qrisSales],
    ["HPP / COGS", -fin.cogs],
    ["Laba Kotor (Gross Profit)", fin.grossProfit],
    ["Margin Laba Kotor", `${fin.grossProfitMargin ?? 0}%`],
    ["Beban Operasional", -(fin.totalExpenses ?? fin.operatingExpenses ?? 0)],
    ["Laba Bersih (Net Profit)", fin.operatingResult ?? fin.netProfit ?? 0],
    ["Margin Laba Bersih", `${fin.netProfitMargin ?? 0}%`],
  ];
  summary.forEach(([k, v], i) => {
    const r = ws1.addRow([k, v]);
    r.getCell(1).font = { size: 11 };
    r.getCell(2).numFmt = typeof v === "number" ? money : "@";
    r.getCell(2).alignment = { horizontal: "right" };
    if (i % 2 === 1) r.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: slateAlt } }));
    r.getCell(1).border = { bottom: { style: "hair", color: { argb: "FFE2E8F0" } } };
    r.getCell(2).border = { bottom: { style: "hair", color: { argb: "FFE2E8F0" } } };
  });
  ws1.addRow([]);
  const t1 = ws1.addRow(["Jumlah Transaksi", fin.transactionCount]);
  t1.getCell(2).numFmt = "#,##0";
  const t2 = ws1.addRow(["Rata-Rata Nilai Belanja (AOV)", fin.avgTransactionValue ?? fin.averageOrderValue ?? 0]);
  t2.getCell(2).numFmt = money;
  const t3 = ws1.addRow(["Total Unit Terjual", fin.unitsSold]);
  t3.getCell(2).numFmt = "#,##0";

  // ---------- Sheet 2: Tren Penjualan + Chart ----------
  const ws2 = workbook.addWorksheet("Tren Penjualan");
  ws2.columns = [{ width: 18 }, { width: 24 }, { width: 20 }, { width: 16 }];
  titleCell(ws2, "MISYourPOS - Laporan Keuangan", `Tren Penjualan ${label}`);
  const h2 = ws2.addRow(["Periode", "Total Penjualan (Rp)", "Jumlah Transaksi", "Unit Terjual"]);
  styleHeaderRow(h2);
  trends.forEach((t, i) => {
    const r = ws2.addRow([t.period, t.total_sales, t.transaction_count, t.units_sold]);
    r.getCell(2).numFmt = money;
    r.getCell(3).numFmt = "#,##0";
    r.getCell(4).numFmt = "#,##0";
    r.getCell(2).alignment = { horizontal: "right" };
    r.getCell(3).alignment = { horizontal: "center" };
    r.getCell(4).alignment = { horizontal: "center" };
    if (i % 2 === 1) r.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: slateAlt } }));
  });
  // Embed the chart image below the table
  const chartRow = 4 + trends.length + 2;
  const imgId = workbook.addImage({ buffer: chartImage as any, extension: "png" });
  ws2.addImage(imgId, { tl: { col: 0, row: chartRow }, ext: { width: 900, height: 420 } });

  // ---------- Sheet 3: Produk Terlaris ----------
  const ws3 = workbook.addWorksheet("Produk Terlaris");
  ws3.columns = [{ width: 5 }, { width: 35 }, { width: 16 }, { width: 14 }, { width: 20 }, { width: 18 }];
  titleCell(ws3, "MISYourPOS - Laporan Keuangan", `Produk Terlaris ${label}`);
  const h3 = ws3.addRow(["No", "Nama Produk", "SKU", "Terjual (unit)", "Omset (Rp)", "Laba (Rp)"]);
  styleHeaderRow(h3);
  topProducts.forEach((p: any, idx: number) => {
    const r = ws3.addRow([
      idx + 1,
      p.product_name ?? p.name,
      p.product_sku ?? p.sku,
      Number(p.total_quantity ?? p.totalQuantity ?? 0),
      Number(p.total_revenue ?? p.totalRevenue ?? 0),
      Number(p.total_profit ?? p.profit ?? 0),
    ]);
    r.getCell(4).numFmt = "#,##0";
    r.getCell(5).numFmt = money;
    r.getCell(6).numFmt = money;
    r.getCell(1).alignment = { horizontal: "center" };
    r.getCell(4).alignment = { horizontal: "center" };
    r.getCell(5).alignment = { horizontal: "right" };
    r.getCell(6).alignment = { horizontal: "right" };
    if (idx % 2 === 1) r.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: indigoLight } }));
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    filename: `Laporan_MISYourPOS_${label}_${startDate}_sd_${endDate}.xlsx`,
    base64: Buffer.from(buffer as any).toString("base64"),
  };
}
