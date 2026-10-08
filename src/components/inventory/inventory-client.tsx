"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Boxes,
  ArrowDownRight,
  ArrowUpRight,
  RotateCcw,
  AlertTriangle,
  Package,
  Plus,
  SlidersHorizontal,
  History,
  Download,
  Filter,
  CheckCircle,
  FileSpreadsheet,
} from "lucide-react";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { restockProduct, adjustStock } from "@/lib/actions/inventory";
import * as XLSX from "xlsx";

interface InventoryClientProps {
  initialSummary: {
    totalProducts: number;
    activeProducts: number;
    totalStock: number;
    inventoryValue: number;
    lowStockCount: number;
    outOfStockCount: number;
    recentMovements: any[];
  };
  products: any[];
  suppliers: any[];
  initialMovements: any[];
  isOwnerOrAdmin: boolean;
}

export function InventoryClient({
  initialSummary,
  products,
  suppliers,
  initialMovements,
  isOwnerOrAdmin,
}: InventoryClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"summary" | "ledger" | "restock" | "adjust">("summary");
  const [summary, setSummary] = useState(initialSummary);
  const [movements, setMovements] = useState<any[]>(initialMovements);

  const [prevInitialSummary, setPrevInitialSummary] = useState(initialSummary);
  const [prevInitialMovements, setPrevInitialMovements] = useState(initialMovements);

  if (prevInitialSummary !== initialSummary) {
    setPrevInitialSummary(initialSummary);
    setSummary(initialSummary);
  }
  if (prevInitialMovements !== initialMovements) {
    setPrevInitialMovements(initialMovements);
    setMovements(initialMovements);
  }

  // Restock Form State
  const [restockForm, setRestockForm] = useState({
    productId: products[0]?.id || "",
    supplierId: suppliers[0]?.id || "",
    quantity: 1000,
    costPrice: 1000,
    referenceNumber: `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    notes: "Pengiriman bibit parfum baru",
  });
  const [isRestocking, setIsRestocking] = useState(false);
  const [restockMsg, setRestockMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Adjustment Form State
  const [adjustForm, setAdjustForm] = useState({
    productId: products[0]?.id || "",
    movementType: "ADJUSTMENT_OUT" as const,
    quantity: 50,
    reason: "Bocor / Menguap",
    notes: "Koreksi selisih opname fisik",
  });
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustMsg, setAdjustMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Search filter for summary
  const [stockSearch, setStockSearch] = useState("");

  // Simple sort/filter per column
  const [sortKey, setSortKey] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const statusRank = (p: any) => {
    const out = p.currentStock <= 0;
    const low = !out && p.currentStock <= p.minimumStock;
    return out ? 0 : low ? 1 : 2;
  };

  const filteredProducts = products
    .filter((p) => {
      if (!stockSearch.trim()) return true;
      const q = stockSearch.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.fragranceName && p.fragranceName.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (!sortKey) return 0;
      let va: any, vb: any;
      switch (sortKey) {
        case "name": va = a.name; vb = b.name; break;
        case "sku": va = a.sku; vb = b.sku; break;
        case "costPrice": va = a.costPrice; vb = b.costPrice; break;
        case "minimumStock": va = a.minimumStock; vb = b.minimumStock; break;
        case "currentStock": va = a.currentStock; vb = b.currentStock; break;
        case "totalValue": va = a.currentStock * a.costPrice; vb = b.currentStock * b.costPrice; break;
        case "status": va = statusRank(a); vb = statusRank(b); break;
        default: return 0;
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  // Handle Restock Submit
  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRestockMsg(null);
    setIsRestocking(true);

    try {
      const res = await restockProduct({
        productId: restockForm.productId,
        supplierId: restockForm.supplierId || undefined,
        quantity: Number(restockForm.quantity),
        referenceNumber: restockForm.referenceNumber || undefined,
        notes: restockForm.notes || undefined,
      });

      if (!res.success) {
        setRestockMsg({ type: "error", text: res.error || "Gagal melakukan restok." });
      } else {
        setRestockMsg({ type: "success", text: "Stok berhasil ditambahkan ke inventori!" });
        // Optimistically prepend the new movement (only if the server returned an id,
        // so React keys stay unique)
        const newMov = res.data?.movement;
        if (newMov?.id) {
          const prod = products.find((p) => p.id === restockForm.productId);
          setMovements((prev) => [
            {
              ...newMov,
              product: { name: prod?.name, sku: prod?.sku, unit: prod?.unit },
              user: { name: "Anda" },
            } as any,
            ...prev,
          ]);
        }
        // Refresh server data to get latest summary and product list
        router.refresh();
      }
    } catch (err: any) {
      setRestockMsg({ type: "error", text: err?.message || "Terjadi kesalahan sistem." });
    } finally {
      setIsRestocking(false);
    }
  };

  // Handle Adjust Submit
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustMsg(null);
    setIsAdjusting(true);

    try {
      const res = await adjustStock({
        productId: adjustForm.productId,
        movementType: adjustForm.movementType as any,
        quantity: Number(adjustForm.quantity),
        reason: adjustForm.reason,
        notes: adjustForm.notes || undefined,
      });

      if (!res.success) {
        setAdjustMsg({ type: "error", text: res.error || "Gagal melakukan penyesuaian stok." });
      } else {
        setAdjustMsg({ type: "success", text: "Penyesuaian stok berhasil dicatat!" });
        const newMov = res.data?.movement;
        if (newMov?.id) {
          const prod = products.find((p) => p.id === adjustForm.productId);
          setMovements((prev) => [
            {
              ...newMov,
              product: { name: prod?.name, sku: prod?.sku, unit: prod?.unit },
              user: { name: "Anda" },
            } as any,
            ...prev,
          ]);
        }
        // Refresh server data to get latest summary and product list
        router.refresh();
      }
    } catch (err: any) {
      setAdjustMsg({ type: "error", text: err?.message || "Terjadi kesalahan sistem." });
    } finally {
      setIsAdjusting(false);
    }
  };

  // Export Ledger
  const handleExportLedger = () => {
    const data = movements.map((m) => ({
      Waktu: formatDateTime(m.createdAt),
      SKU: m.product?.sku || "",
      Nama_Produk: m.product?.name || "",
      Tipe_Mutasi: m.movementType,
      Jumlah: Number(m.quantity),
      Stok_Sebelum: Number(m.previousStock),
      Stok_Sesudah: Number(m.newStock),
      Satuan: m.product?.unit || "ml",
      Petugas: m.user?.name || "",
      Catatan: m.notes || "",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mutasi Stok");
    XLSX.writeFile(wb, `Kartu_Stok_MISYourPOS_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Inventori & Manajemen Stok
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Pantau arus persediaan, tambah stok masuk dari supplier, dan lakukan opname barang secara real-time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportLedger}
            className="rounded-xl flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
          >
            <Download className="h-4 w-4 text-emerald-600" />
            Ekspor Kartu Stok
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Nilai Persediaan (HPP)</span>
            <div className="h-8 w-8 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600">
              <Boxes className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
            {formatCurrency(summary.inventoryValue)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Total modal fisik di toko
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Varian Aktif</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-emerald-600">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
            {summary.activeProducts} Produk
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Siap dijual di kasir
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              Peringatan Menipis
            </span>
            <div className="h-8 w-8 rounded-xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center text-amber-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-2">
            {summary.lowStockCount} SKU
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Di bawah batas minimum
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              Stok Kosong / Habis
            </span>
            <div className="h-8 w-8 rounded-xl bg-rose-50 dark:bg-rose-950 flex items-center justify-center text-rose-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-2">
            {summary.outOfStockCount} SKU
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Perlu restok segera
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-200/60 dark:bg-slate-800/60 w-fit">
        <button
          onClick={() => setActiveTab("summary")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "summary"
              ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
          }`}
        >
          Ringkasan & Peringatan Stok
        </button>

        <button
          onClick={() => setActiveTab("ledger")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "ledger"
              ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
          }`}
        >
          Kartu Stok (Ledger Mutasi)
        </button>

        {isOwnerOrAdmin && (
          <>
            <button
              onClick={() => setActiveTab("restock")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "restock"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Stok Masuk / Restock
            </button>

            <button
              onClick={() => setActiveTab("adjust")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "adjust"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Penyesuaian (Stock Opname)
            </button>
          </>
        )}
      </div>

      {/* TAB 1: SUMMARY TABLE */}
      {activeTab === "summary" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-full max-w-sm">
              <Input
                placeholder="Cari parfum di inventori..."
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
                className="h-10 text-xs rounded-xl"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {[
              { label: "Nama A→Z", key: "name", dir: "asc" },
              { label: "Nama Z→A", key: "name", dir: "desc" },
              { label: "Stok Terendah", key: "currentStock", dir: "asc" },
              { label: "Stok Tertinggi", key: "currentStock", dir: "desc" },
              { label: "HPP Termahal", key: "costPrice", dir: "desc" },
              { label: "HPP Termurah", key: "costPrice", dir: "asc" },
              { label: "Nilai Tertinggi", key: "totalValue", dir: "desc" },
              { label: "Nilai Terendah", key: "totalValue", dir: "asc" },
              { label: "Menipis Dulu", key: "status", dir: "asc" },
              { label: "Aman Dulu", key: "status", dir: "desc" },
            ].map((opt) => (
              <button
                key={`${opt.key}-${opt.dir}`}
                onClick={() => {
                  setSortKey(opt.key);
                  setSortDir(opt.dir as "asc" | "desc");
                }}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                  sortKey === opt.key && sortDir === opt.dir
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 cursor-pointer select-none" onClick={() => toggleSort("name")}>
                    Produk {sortKey === "name" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th className="py-3 px-4 cursor-pointer select-none" onClick={() => toggleSort("sku")}>
                    SKU {sortKey === "sku" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th className="py-3 px-4 text-right cursor-pointer select-none" onClick={() => toggleSort("costPrice")}>
                    Harga Modal (HPP) {sortKey === "costPrice" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th className="py-3 px-4 text-center cursor-pointer select-none" onClick={() => toggleSort("minimumStock")}>
                    Batas Minimum {sortKey === "minimumStock" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th className="py-3 px-4 text-center cursor-pointer select-none" onClick={() => toggleSort("currentStock")}>
                    Stok Saat Ini {sortKey === "currentStock" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th className="py-3 px-4 text-right cursor-pointer select-none" onClick={() => toggleSort("totalValue")}>
                    Total Nilai Persediaan {sortKey === "totalValue" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th className="py-3 px-4 text-center cursor-pointer select-none" onClick={() => toggleSort("status")}>
                    Status {sortKey === "status" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredProducts.map((p) => {
                  const isOut = p.currentStock <= 0;
                  const isLow = p.currentStock <= p.minimumStock && !isOut;
                  const totalValue = p.currentStock * p.costPrice;

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 ${
                        isOut || isLow ? "bg-rose-50/70 dark:bg-rose-950/20" : ""
                      }`}
                    >
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        {p.name}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {p.sku}
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        {formatCurrency(p.costPrice)} / {p.unit}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-500">
                        {formatNumber(p.minimumStock)} {p.unit}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                          {formatNumber(p.currentStock)} {p.unit}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-indigo-600 dark:text-indigo-400">
                        {formatCurrency(totalValue)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isOut ? (
                          <Badge variant="destructive" className="text-[10px]">
                            Habis
                          </Badge>
                        ) : isLow ? (
                          <Badge variant="warning" className="text-[10px]">
                            Menipis
                          </Badge>
                        ) : (
                          <Badge variant="success" className="text-[10px]">
                            Aman
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: LEDGER (KARTU STOK) */}
      {activeTab === "ledger" && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Waktu</th>
                <th className="py-3 px-4">Produk</th>
                <th className="py-3 px-4">Tipe Mutasi</th>
                <th className="py-3 px-4 text-center">Jumlah</th>
                <th className="py-3 px-4 text-center">Saldo Akhir</th>
                <th className="py-3 px-4">Keterangan / Alasan</th>
                <th className="py-3 px-4">Petugas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Belum ada riwayat mutasi stok.
                  </td>
                </tr>
              ) : (
                movements.map((m) => {
                  const qty = Number(m.quantity);
                  const isIncoming = qty > 0;

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {formatDateTime(m.createdAt)}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        {m.product?.name}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {m.movementType}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold">
                        <span
                          className={
                            isIncoming
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }
                        >
                          {isIncoming ? `+${qty}` : qty} {m.product?.unit || "ml"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-extrabold text-slate-800 dark:text-slate-200">
                        {m.newStock} {m.product?.unit || "ml"}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-[200px] truncate">
                        {m.notes || "-"}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {m.user?.name || "Sistem"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: RESTOCK FORM */}
      {activeTab === "restock" && (
        <div className="max-w-xl mx-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-xs">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-emerald-600">
              <ArrowDownRight className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Penerimaan Stok Masuk (Restock)
              </h3>
              <p className="text-xs text-slate-500">
                Tambahkan stok bibit parfum atau botol dari supplier secara resmi ke buku inventori.
              </p>
            </div>
          </div>

          {restockMsg && (
            <div
              className={`mb-5 p-3.5 rounded-xl text-xs font-semibold border ${
                restockMsg.type === "success"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}
            >
              {restockMsg.text}
            </div>
          )}

          <form onSubmit={handleRestockSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Pilih Produk
              </label>
              <select
                value={restockForm.productId}
                onChange={(e) => {
                  const p = products.find((pr) => pr.id === e.target.value);
                  setRestockForm({
                    ...restockForm,
                    productId: e.target.value,
                    costPrice: p ? p.costPrice : restockForm.costPrice,
                  });
                }}
                className="h-10 w-full text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 outline-none"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Stok Saat Ini: {p.currentStock} {p.unit})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Supplier
                </label>
                <select
                  value={restockForm.supplierId}
                  onChange={(e) => setRestockForm({ ...restockForm, supplierId: e.target.value })}
                  className="h-10 w-full text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 outline-none"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Nomor PO / Surat Jalan
                </label>
                <Input
                  value={restockForm.referenceNumber}
                  onChange={(e) => setRestockForm({ ...restockForm, referenceNumber: e.target.value })}
                  className="h-10 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Jumlah Stok Masuk
                </label>
                <Input
                  type="number"
                  min={1}
                  value={restockForm.quantity}
                  onChange={(e) => setRestockForm({ ...restockForm, quantity: Number(e.target.value) })}
                  className="h-10 text-sm font-bold"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Harga Beli Satuan (Rp)
                </label>
                <Input
                  type="number"
                  min={0}
                  value={restockForm.costPrice}
                  onChange={(e) => setRestockForm({ ...restockForm, costPrice: Number(e.target.value) })}
                  className="h-10 text-sm font-bold"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Catatan Penerimaan
              </label>
              <Input
                value={restockForm.notes}
                onChange={(e) => setRestockForm({ ...restockForm, notes: e.target.value })}
                placeholder="Misal: Batch baru batch 2026-A"
                className="h-10 text-xs"
              />
            </div>

            <Button
              type="submit"
              disabled={isRestocking}
              className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs mt-3 cursor-pointer"
            >
              {isRestocking ? "Menyimpan ke Database..." : "Konfirmasi Masuk Stok"}
            </Button>
          </form>
        </div>
      )}

      {/* TAB 4: ADJUSTMENT (OPNAME) FORM */}
      {activeTab === "adjust" && (
        <div className="max-w-xl mx-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-xs">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-2xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center text-amber-600">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Penyesuaian Stok (Stock Opname)
              </h3>
              <p className="text-xs text-slate-500">
                Koreksi selisih fisik parfum akibat penguapan, bocor, kerusakan botol, atau temuan stok lebih.
              </p>
            </div>
          </div>

          {adjustMsg && (
            <div
              className={`mb-5 p-3.5 rounded-xl text-xs font-semibold border ${
                adjustMsg.type === "success"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}
            >
              {adjustMsg.text}
            </div>
          )}

          <form onSubmit={handleAdjustSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Pilih Produk
              </label>
              <select
                value={adjustForm.productId}
                onChange={(e) => setAdjustForm({ ...adjustForm, productId: e.target.value })}
                className="h-10 w-full text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 outline-none"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Stok Saat Ini: {p.currentStock} {p.unit})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Arah Penyesuaian
                </label>
                <select
                  value={adjustForm.movementType}
                  onChange={(e) => setAdjustForm({ ...adjustForm, movementType: e.target.value as any })}
                  className="h-10 w-full text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 outline-none"
                >
                  <option value="ADJUSTMENT_OUT">Kurangi Stok (Kerusakan/Bocor/Hilang)</option>
                  <option value="ADJUSTMENT_IN">Tambah Stok (Temuan Fisik Lebih)</option>
                  <option value="DAMAGE">Barang Rusak / Pecah</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Jumlah Penyesuaian
                </label>
                <Input
                  type="number"
                  min={1}
                  value={adjustForm.quantity}
                  onChange={(e) => setAdjustForm({ ...adjustForm, quantity: Number(e.target.value) })}
                  className="h-10 text-sm font-bold"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Alasan Penyesuaian
              </label>
              <select
                value={adjustForm.reason}
                onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                className="h-10 w-full text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 outline-none"
              >
                <option value="Bocor / Menguap">Bocor / Menguap (Evaporation)</option>
                <option value="Botol Pecah / Rusak">Botol Pecah / Rusak saat Display</option>
                <option value="Selisih Opname Fisik">Selisih Opname Fisik Akhir Bulan</option>
                <option value="Sampel Tester Pelanggan">Digunakan untuk Tester Pelanggan</option>
                <option value="Koreksi Input">Koreksi Salah Input Awal</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Catatan Tambahan
              </label>
              <Input
                value={adjustForm.notes}
                onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                placeholder="Penjelasan detail hasil cek fisik..."
                className="h-10 text-xs"
              />
            </div>

            <Button
              type="submit"
              disabled={isAdjusting}
              className="w-full h-11 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs mt-3 cursor-pointer"
            >
              {isAdjusting ? "Memproses Koreksi..." : "Simpan Penyesuaian Stok"}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
