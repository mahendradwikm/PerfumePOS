"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Receipt, Search, Eye, RotateCcw, Clock, QrCode, Banknote } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SaleItemLite {
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  unit?: string;
}

interface SaleRow {
  id: string;
  transactionNumber: string;
  date: Date | string;
  status: string;
  paymentMethod: string;
  subtotal: number;
  discountAmount: number;
  grandTotal: number;
  customerName?: string | null;
  user?: { name: string } | null;
  items: SaleItemLite[];
  _count?: { items: number; refunds: number };
}

interface SalesClientProps {
  initialSales: SaleRow[];
  total: number;
  period: "day" | "week" | "month" | "custom";
  customDate?: string;
  isOwnerOrAdmin: boolean;
}

export function SalesClient({
  initialSales,
  total,
  period,
  customDate,
  isOwnerOrAdmin,
}: SalesClientProps) {
  const router = useRouter();
  const [sales, setSales] = useState<SaleRow[]>(initialSales);
  const [prevSales, setPrevSales] = useState(initialSales);
  if (prevSales !== initialSales) {
    setPrevSales(initialSales);
    setSales(initialSales);
  }

  const [search, setSearch] = useState("");
  const [customDateInput, setCustomDateInput] = useState(
    customDate || new Date().toISOString().slice(0, 10)
  );
  const [selected, setSelected] = useState<SaleRow | null>(null);

  const filtered = sales.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.transactionNumber.toLowerCase().includes(q) ||
      (s.customerName || "").toLowerCase().includes(q) ||
      (s.user?.name || "").toLowerCase().includes(q) ||
      s.items.some((i) => i.productName.toLowerCase().includes(q))
    );
  });

  const grandTotalAll = filtered.reduce((sum, s) => sum + s.grandTotal, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Riwayat Struk / Transaksi
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Daftar nomor struk penjualan. Gunakan nomor struk ini saat memproses retur/refund.
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 p-1.5 bg-white dark:bg-slate-900">
          {([
            { key: "day", label: "Hari Ini" },
            { key: "week", label: "Minggu Ini" },
            { key: "month", label: "Bulan Ini" },
          ] as const).map((opt) => (
            <button
              key={opt.key}
              onClick={() => router.push(`/sales?period=${opt.key}`)}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                period === opt.key
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {opt.label}
            </button>
          ))}
          <span className="w-px h-7 bg-slate-200 dark:bg-slate-800" />
          <input
            type="date"
            value={customDateInput}
            aria-label="Pilih tanggal"
            onChange={(e) => {
              const val = e.target.value;
              setCustomDateInput(val);
              if (val) router.push(`/sales?period=custom&date=${val}`);
            }}
            className={`bg-transparent text-sm font-bold outline-none px-3 py-2 rounded-xl cursor-pointer h-11 ${
              period === "custom"
                ? "text-indigo-600 dark:text-indigo-300"
                : "text-slate-600 dark:text-slate-300"
            }`}
          />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <span className="text-xs text-slate-400">Jumlah Struk</span>
          <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{filtered.length}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <span className="text-xs text-slate-400">Total Omset Periode Ini</span>
          <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
            {formatCurrency(grandTotalAll)}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <span className="text-xs text-slate-400">Total Data(DB)</span>
          <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{total}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <span className="text-xs text-slate-400">Sudah Diretur</span>
          <p className="text-xl font-black text-rose-500 mt-1">
            {filtered.filter((s) => (s._count?.refunds || 0) > 0).length}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nomor struk, nama pelanggan, kasir, atau produk..."
          className="h-10 text-xs rounded-xl pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="py-3 px-4">Nomor Struk</th>
              <th className="py-3 px-4">Waktu</th>
              <th className="py-3 px-4">Kasir</th>
              <th className="py-3 px-4">Item</th>
              <th className="py-3 px-4">Bayar</th>
              <th className="py-3 px-4 text-right">Total</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-slate-400">
                  Tidak ada struk pada periode ini.
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {s.transactionNumber}
                  </td>
                  <td className="py-3 px-4 text-slate-500">{formatDateTime(s.date)}</td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                    {s.user?.name || "-"}
                  </td>
                  <td className="py-3 px-4 text-slate-500">{s.items.length} item</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1.5">
                      {s.paymentMethod === "CASH" ? (
                        <Banknote className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <QrCode className="h-3.5 w-3.5 text-sky-500" />
                      )}
                      {s.paymentMethod}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-extrabold text-slate-900 dark:text-white">
                    {formatCurrency(s.grandTotal)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {s.status === "COMPLETED" ? (
                      (s._count?.refunds || 0) > 0 ? (
                        <Badge variant="warning" className="text-[10px]">Ada Retur</Badge>
                      ) : (
                        <Badge variant="success" className="text-[10px]">Selesai</Badge>
                      )
                    ) : (
                      <Badge variant="destructive" className="text-[10px]">Batal</Badge>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelected(s)}
                        className="rounded-lg text-[11px] cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {isOwnerOrAdmin && s.status === "COMPLETED" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/refunds?txn=${s.transactionNumber}`)}
                          className="rounded-lg text-[11px] cursor-pointer"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Receipt detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 relative max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setSelected(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer text-xl font-bold"
            >
              ×
            </button>
            <div className="text-center border-b border-dashed border-slate-300 dark:border-slate-700 pb-4 mb-4">
              <Receipt className="h-6 w-6 mx-auto mb-2 text-indigo-500" />
              <p className="font-mono font-bold text-base text-slate-900 dark:text-white">
                {selected.transactionNumber}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {formatDateTime(selected.date)} • Kasir: {selected.user?.name}
              </p>
              {selected.customerName && (
                <p className="text-[11px] text-slate-400">Pelanggan: {selected.customerName}</p>
              )}
            </div>

            <div className="space-y-2 text-xs">
              {selected.items.map((it, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-300">
                    {it.quantity} {it.unit || "ml"} × {it.productName}
                  </span>
                  <span className="font-semibold">{formatCurrency(it.lineTotal)}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span>{formatCurrency(selected.subtotal)}</span>
              </div>
              {selected.discountAmount > 0 && (
                <div className="flex justify-between text-rose-500">
                  <span>Diskon</span>
                  <span>-{formatCurrency(selected.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-extrabold text-indigo-600 dark:text-indigo-400 pt-1">
                <span>TOTAL</span>
                <span>{formatCurrency(selected.grandTotal)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Metode Bayar</span>
                <span>{selected.paymentMethod}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}