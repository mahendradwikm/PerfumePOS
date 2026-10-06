"use client";

import { useState } from "react";
import {
  RotateCcw,
  Search,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  PackageCheck,
  Receipt,
  X,
} from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createRefund, getSaleForRefund } from "@/lib/actions/refunds";
import { useRouter } from "next/navigation";

interface RefundItem {
  id: string;
  refundNumber: string;
  createdAt: Date | string;
  refundAmount: number;
  reason: string;
  sale?: {
    saleNumber: string;
    grandTotal: number;
    paymentMethod: string;
  };
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    restoreStock: boolean;
  }>;
  user?: { name: string };
}

interface RefundsClientProps {
  initialRefunds: RefundItem[];
  isOwnerOrAdmin: boolean;
}

export function RefundsClient({
  initialRefunds,
  isOwnerOrAdmin,
}: RefundsClientProps) {
  const router = useRouter();
  const [refunds, setRefunds] = useState<RefundItem[]>(initialRefunds);

  // New Refund search & form
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [saleNumberQuery, setSaleNumberQuery] = useState("");
  const [searchingSale, setSearchingSale] = useState(false);
  const [foundSale, setFoundSale] = useState<any>(null);
  const [searchError, setSearchError] = useState("");

  // Refund Selection state
  const [selectedItems, setSelectedItems] = useState<
    Array<{
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      restoreStock: boolean;
      maxQty: number;
    }>
  >([]);
  const [refundReason, setRefundReason] = useState("Salah Varian / Pelanggan Ingin Tukar");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Search Sale
  const handleSearchSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleNumberQuery.trim()) return;
    setSearchingSale(true);
    setSearchError("");
    setFoundSale(null);

    try {
      const res = await getSaleForRefund(saleNumberQuery.trim());
      if (!res.success || !res.data) {
        setSearchError(res.error || "Transaksi tidak ditemukan.");
      } else {
        setFoundSale(res.data);
        // Pre-populate items
        setSelectedItems(
          res.data.items.map((it: any) => ({
            productId: it.productId,
            productName: it.productName,
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
            restoreStock: true,
            maxQty: Number(it.quantity),
          }))
        );
      }
    } catch (err: any) {
      setSearchError(err?.message || "Gagal mencari transaksi.");
    } finally {
      setSearchingSale(false);
    }
  };

  const totalRefundAmount = selectedItems.reduce(
    (sum, it) => sum + it.quantity * it.unitPrice,
    0
  );

  const handleSubmitRefund = async () => {
    if (!foundSale) return;
    if (selectedItems.length === 0 || totalRefundAmount <= 0) {
      setSubmitError("Pilih minimal 1 item untuk direfund.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const res = await createRefund({
        saleId: foundSale.id,
        reason: refundReason,
        items: selectedItems.filter((it) => it.quantity > 0),
      });

      if (!res.success) {
        setSubmitError(res.error || "Gagal memproses refund.");
      } else {
        const created = {
          ...res.data!,
          refundAmount: Number(res.data?.refundAmount),
          sale: {
            saleNumber: foundSale.saleNumber,
            grandTotal: Number(foundSale.grandTotal),
            paymentMethod: foundSale.paymentMethod,
          },
          items: selectedItems.map((it, idx) => ({
            id: `ri-${idx}`,
            productName: it.productName,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            lineTotal: it.quantity * it.unitPrice,
            restoreStock: it.restoreStock,
          })),
          user: { name: "Anda" },
        };

        setRefunds([created as any, ...refunds]);
        setIsProcessModalOpen(false);
        setFoundSale(null);
        setSaleNumberQuery("");
        router.refresh();
      }
    } catch (err: any) {
      setSubmitError(err?.message || "Terjadi kesalahan sistem.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Retur Penjualan & Pengembalian Dana (Refund)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Proses pengembalian dana pelanggan secara aman dengan opsi pengembalian stok barang kembali ke inventori.
          </p>
        </div>

        {isOwnerOrAdmin && (
          <Button
            onClick={() => {
              setIsProcessModalOpen(true);
              setFoundSale(null);
              setSaleNumberQuery("");
              setSearchError("");
            }}
            size="sm"
            className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-purple-600/20 cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
            Proses Retur Baru
          </Button>
        )}
      </div>

      {/* Refund History Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Riwayat Transaksi Retur & Refund
          </h3>
          <span className="text-xs text-slate-400 font-medium">
            {refunds.length} transaksi retur
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">No. Refund</th>
                <th className="py-3 px-4">Waktu</th>
                <th className="py-3 px-4">No. Struk Asal</th>
                <th className="py-3 px-4">Barang Diretur</th>
                <th className="py-3 px-4 text-right">Total Dana Dikembalikan</th>
                <th className="py-3 px-4">Alasan Retur</th>
                <th className="py-3 px-4">Diotorisasi Oleh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {refunds.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Belum ada riwayat transaksi refund atau retur barang.
                  </td>
                </tr>
              ) : (
                refunds.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-4 font-mono font-bold text-purple-600 dark:text-purple-400">
                      {r.refundNumber}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                      {formatDateTime(r.createdAt)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                      {r.sale?.saleNumber || "-"}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        {r.items?.map((it, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 text-[11px]">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {it.productName}
                            </span>
                            <span className="text-slate-500">
                              ({it.quantity} x {formatCurrency(it.unitPrice)})
                            </span>
                            {it.restoreStock && (
                              <Badge variant="success" className="text-[9px] py-0 px-1.5">
                                Stok Dipulihkan
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-rose-600 dark:text-rose-400">
                      -{formatCurrency(r.refundAmount)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 max-w-[180px] truncate">
                      {r.reason}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {r.user?.name || "Admin"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* NEW REFUND MODAL */}
      {isProcessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Proses Retur / Pengembalian Dana
              </h3>
              <button
                onClick={() => setIsProcessModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Step 1: Search Invoice */}
            <form onSubmit={handleSearchSale} className="space-y-3 mb-6">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Cari Nomor Struk Transaksi Asal (TXN-...)
              </label>
              <div className="flex gap-2">
                <Input
                  value={saleNumberQuery}
                  onChange={(e) => setSaleNumberQuery(e.target.value)}
                  placeholder="Contoh: TXN-20261006-0001"
                  className="font-mono text-xs h-10"
                  required
                />
                <Button
                  type="submit"
                  disabled={searchingSale}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4"
                >
                  {searchingSale ? "Mencari..." : "Cari Struk"}
                </Button>
              </div>

              {searchError && (
                <p className="text-xs font-semibold text-rose-500">{searchError}</p>
              )}
            </form>

            {/* Step 2: Found Sale Details & Items Selection */}
            {foundSale && (
              <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60 text-xs space-y-1">
                  <div className="flex justify-between font-bold">
                    <span>Struk: {foundSale.saleNumber}</span>
                    <span>Total: {formatCurrency(foundSale.grandTotal)}</span>
                  </div>
                  <div className="text-slate-500">
                    Waktu: {formatDateTime(foundSale.date)} • Kasir: {foundSale.user?.name} • Metode: {foundSale.paymentMethod}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    Pilih Item & Jumlah Yang Direfund:
                  </label>

                  {selectedItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">
                          {item.productName}
                        </p>
                        <p className="text-slate-500 text-[11px]">
                          Harga Beli: {formatCurrency(item.unitPrice)} • Maks {item.maxQty} unit
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <label className="text-[11px] text-slate-500">Qty Refund:</label>
                          <input
                            type="number"
                            min={0}
                            max={item.maxQty}
                            value={item.quantity}
                            onChange={(e) => {
                              const val = Math.min(item.maxQty, Math.max(0, Number(e.target.value)));
                              setSelectedItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, quantity: val } : it))
                              );
                            }}
                            className="w-14 text-center font-bold text-xs h-8 border rounded-lg bg-white dark:bg-slate-900"
                          />
                        </div>

                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-medium text-slate-600 dark:text-slate-400">
                          <input
                            type="checkbox"
                            checked={item.restoreStock}
                            onChange={(e) =>
                              setSelectedItems((prev) =>
                                prev.map((it, i) =>
                                  i === idx ? { ...it, restoreStock: e.target.checked } : it
                                )
                              )
                            }
                            className="rounded text-indigo-600"
                          />
                          <span>Pulihkan Stok</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Alasan Retur / Refund *
                  </label>
                  <select
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="h-10 w-full text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 outline-none"
                  >
                    <option value="Salah Varian / Pelanggan Ingin Tukar">
                      Salah Varian / Pelanggan Ingin Tukar Aroma
                    </option>
                    <option value="Botol Bocor / Cacat Produksi">
                      Botol Bocor / Spray Cacat Produksi
                    </option>
                    <option value="Aroma Berbeda Dari Tester">
                      Aroma Berbeda Dari Tester
                    </option>
                    <option value="Pelanggan Batal Beli">Pelanggan Batal Beli</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                {submitError && (
                  <p className="text-xs font-semibold text-rose-500">{submitError}</p>
                )}

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500 block">Total Pengembalian Dana:</span>
                    <span className="text-lg font-black text-rose-600 dark:text-rose-400">
                      {formatCurrency(totalRefundAmount)}
                    </span>
                  </div>

                  <Button
                    onClick={handleSubmitRefund}
                    disabled={isSubmitting || totalRefundAmount <= 0}
                    className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-5 h-11"
                  >
                    {isSubmitting ? "Memproses Refund..." : "Konfirmasi Retur & Refund"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
