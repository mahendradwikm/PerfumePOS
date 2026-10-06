"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Receipt,
  Download,
  Calendar,
  Percent,
  Flame,
  Clock,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";

interface DashboardKPIs {
  grossSales: number;
  discountAmount: number;
  netSales: number;
  cashSales: number;
  qrisSales: number;
  cogs: number;
  grossProfit: number;
  grossProfitMargin: number;
  operatingExpenses: number;
  refundsTotal: number;
  netProfit: number;
  netProfitMargin: number;
  transactionCount: number;
  averageOrderValue: number;
  unitsSold: number;
}

interface ReportsClientProps {
  initialKPIs: DashboardKPIs;
  topProducts: any[];
  slowProducts: any[];
  salesTrends: any[];
  paymentBreakdown: any[];
  categories: any[];
}

export function ReportsClient({
  initialKPIs,
  topProducts,
  slowProducts,
  salesTrends,
  paymentBreakdown,
  categories,
}: ReportsClientProps) {
  const [kpis, setKPIs] = useState<DashboardKPIs>(initialKPIs);
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "all">("today");

  // Colors for charts
  const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4"];

  // Excel Export
  const handleExportFullReport = () => {
    // Sheet 1: KPIs
    const kpiData = [
      { Indikator: "Penjualan Kotor (Gross Sales)", Nilai: kpis.grossSales },
      { Indikator: "Potongan Diskon", Nilai: -kpis.discountAmount },
      { Indikator: "Penjualan Bersih (Net Sales)", Nilai: kpis.netSales },
      { Indikator: "Penjualan Tunai", Nilai: kpis.cashSales },
      { Indikator: "Penjualan QRIS", Nilai: kpis.qrisSales },
      { Indikator: "Harga Pokok Penjualan (HPP / COGS)", Nilai: -kpis.cogs },
      { Indikator: "Laba Kotor (Gross Profit)", Nilai: kpis.grossProfit },
      { Indikator: "Margin Laba Kotor", Nilai: `${kpis.grossProfitMargin}%` },
      { Indikator: "Total Beban Operasional", Nilai: -kpis.operatingExpenses },
      { Indikator: "Total Pengembalian Dana (Refund)", Nilai: -kpis.refundsTotal },
      { Indikator: "Laba Bersih Toko (Net Profit)", Nilai: kpis.netProfit },
      { Indikator: "Margin Laba Bersih", Nilai: `${kpis.netProfitMargin}%` },
      { Indikator: "Jumlah Transaksi", Nilai: kpis.transactionCount },
      { Indikator: "Rata-Rata Nilai Belanja (AOV)", Nilai: kpis.averageOrderValue },
      { Indikator: "Total Unit / ml Terjual", Nilai: kpis.unitsSold },
    ];

    // Sheet 2: Top Products
    const topProdData = topProducts.map((p, idx) => ({
      Ranking: idx + 1,
      Nama_Produk: p.name,
      SKU: p.sku,
      Kategori: p.categoryName || "-",
      Total_Terjual: p.totalQuantity,
      Satuan: p.unit,
      Total_Omset: p.totalRevenue,
      Total_Laba: p.profit,
    }));

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(kpiData);
    const ws2 = XLSX.utils.json_to_sheet(topProdData);

    XLSX.utils.book_append_sheet(wb, ws1, "Laporan Keuangan");
    XLSX.utils.book_append_sheet(wb, ws2, "Produk Terlaris");

    XLSX.writeFile(wb, `Laporan_Keuangan_AromaPOS_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Laporan Keuangan & Analitik Interaktif
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Analisis omset riil, HPP produk, margin laba kotor, beban operasional, dan laba bersih toko secara transparan.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportFullReport}
            className="rounded-xl flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
          >
            <Download className="h-4 w-4 text-emerald-600" />
            Ekspor Laporan Lengkap
          </Button>
        </div>
      </div>

      {/* TOP FINANCIAL METRICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Omset Bersih */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Penjualan Bersih (Net Sales)</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {formatCurrency(kpis.netSales)}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Kotor: {formatCurrency(kpis.grossSales)}</span>
            <span className="text-rose-500 font-medium">Diskon: -{formatCurrency(kpis.discountAmount)}</span>
          </div>
        </div>

        {/* Laba Kotor & COGS */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Laba Kotor (Gross Profit)</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600">
              {kpis.grossProfitMargin}% Margin
            </span>
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {formatCurrency(kpis.grossProfit)}
          </p>
          <p className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            HPP Modal: <span className="font-semibold text-slate-600 dark:text-slate-300">{formatCurrency(kpis.cogs)}</span>
          </p>
        </div>

        {/* Pengeluaran Operasional */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold text-rose-500">Total Beban Operasional</span>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {formatCurrency(kpis.operatingExpenses)}
          </p>
          <p className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            Termasuk listrik, sewa, gaji, dan supplies
          </p>
        </div>

        {/* Laba Bersih */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/25">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-indigo-100">Laba Bersih Riil (Net Profit)</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">
              {kpis.netProfitMargin}% Margin
            </span>
          </div>
          <p className="text-2xl font-black text-white mt-1">
            {formatCurrency(kpis.netProfit)}
          </p>
          <p className="text-[11px] text-indigo-100 mt-2 pt-2 border-t border-white/20">
            Laba Kotor dikurangi Beban Toko
          </p>
        </div>
      </div>

      {/* SECONDARY ROW: Payment split & Volume metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs">
          <span className="text-slate-400 block">Penjualan Tunai:</span>
          <span className="text-base font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
            {formatCurrency(kpis.cashSales)}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs">
          <span className="text-slate-400 block">Penjualan QRIS:</span>
          <span className="text-base font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
            {formatCurrency(kpis.qrisSales)}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs">
          <span className="text-slate-400 block">Jumlah Struk Selesai:</span>
          <span className="text-base font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
            {kpis.transactionCount} Transaksi
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs">
          <span className="text-slate-400 block">Rata-Rata Keranjang (AOV):</span>
          <span className="text-base font-bold text-indigo-600 dark:text-indigo-400 mt-0.5 block">
            {formatCurrency(kpis.averageOrderValue)}
          </span>
        </div>
      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Trend Chart */}
        <div className="lg:col-span-2 p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Tren Penjualan & Jam Sibuk Toko
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Aktivitas omset per periode waktu
              </p>
            </div>
            <div className="h-8 w-8 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>

          <div className="h-64 w-full">
            {salesTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesTrends}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.15} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(val) => `Rp${(val / 1000).toLocaleString()}k`}
                  />
                  <Tooltip
                    formatter={(val: any) => [formatCurrency(Number(val)), "Penjualan"]}
                  />
                  <Bar dataKey="sales" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Belum cukup data transaksi untuk grafik tren hari ini.
              </div>
            )}
          </div>
        </div>

        {/* Payment Method Pie Breakdown */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Metode Pembayaran
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Perbandingan penerimaan Tunai vs QRIS
            </p>
          </div>

          <div className="h-52 w-full my-auto">
            {kpis.grossSales > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Tunai (Cash)", value: kpis.cashSales },
                      { name: "QRIS", value: kpis.qrisSales },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    <Cell fill="#6366f1" />
                    <Cell fill="#10b981" />
                  </Pie>
                  <Tooltip formatter={(val: any) => formatCurrency(Number(val))} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Belum ada transaksi pembayaran.
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-indigo-600" />
              <div>
                <p className="text-slate-400 text-[10px]">Tunai</p>
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  {formatCurrency(kpis.cashSales)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-emerald-500" />
              <div>
                <p className="text-slate-400 text-[10px]">QRIS</p>
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  {formatCurrency(kpis.qrisSales)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TOP & SLOW PRODUCTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Products */}
        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center text-amber-600">
              <Flame className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                5 Parfum Paling Laris (Top Sellers)
              </h3>
              <p className="text-[11px] text-slate-400">
                Berdasarkan total volume penjualan dan laba
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {topProducts.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                Belum ada data penjualan produk.
              </p>
            ) : (
              topProducts.map((p, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 font-extrabold flex items-center justify-center text-xs">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {p.name}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {p.sku}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-extrabold text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(p.totalRevenue)}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {p.totalQuantity} {p.unit || "ml"} terjual
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Slow Moving Products */}
        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Produk Pergerakan Lambat (Slow Moving)
              </h3>
              <p className="text-[11px] text-slate-400">
                Stok tinggi namun jarang terjual (perlu promo/bundling)
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {slowProducts.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                Semua varian bergerak dengan seimbang.
              </p>
            ) : (
              slowProducts.slice(0, 5).map((p, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">
                      {p.name}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Stok saat ini: {formatNumber(p.currentStock)} {p.unit}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {p.salesCount || 0}x terjual
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
