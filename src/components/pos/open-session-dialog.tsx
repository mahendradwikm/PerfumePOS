"use client";

import { useState } from "react";
import { Wallet, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { openCashSession } from "@/lib/actions/cash";
import { formatCurrency } from "@/lib/format";

interface OpenSessionDialogProps {
  isOpen: boolean;
  onSuccess: (session: any) => void;
}

export function OpenSessionDialog({ isOpen, onSuccess }: OpenSessionDialogProps) {
  const [openingCash, setOpeningCash] = useState<number>(100000);
  const [notes, setNotes] = useState<string>("Modal awal kasir untuk uang kembalian");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const quickAmounts = [50000, 100000, 150000, 200000, 300000];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await openCashSession({
        openingCash: Number(openingCash),
        notes,
      });

      if (!res.success) {
        setError(res.error || "Gagal membuka sesi kasir.");
      } else {
        onSuccess(res.data);
      }
    } catch (err: any) {
      setError(err?.message || "Terjadi kesalahan sistem.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
      <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden p-6 sm:p-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mb-4 border border-indigo-100 dark:border-indigo-900">
          <Wallet className="h-7 w-7" />
        </div>

        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
          Buka Sesi Kasir Baru
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-6">
          Sesi kasir wajib dibuka sebelum memulai transaksi penjualan untuk memastikan akurasi saldo uang kembalian.
        </p>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 p-3 text-xs text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
              Modal Awal / Uang Kembalian (Rp)
            </label>
            <Input
              type="number"
              min={0}
              step={1000}
              value={openingCash}
              onChange={(e) => setOpeningCash(Number(e.target.value))}
              className="text-lg font-bold text-slate-900 dark:text-white h-12"
              required
            />
            {/* Quick buttons */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setOpeningCash(amt)}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                    openingCash === amt
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {formatCurrency(amt)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
              Catatan Pembukaan Sesi
            </label>
            <Input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Misal: Shift Pagi Rina"
              className="text-sm"
            />
          </div>

          <Button
            type="submit"
            disabled={loading || openingCash < 0}
            className="w-full h-12 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/25 mt-2 cursor-pointer"
          >
            {loading ? "Membuka Sesi..." : "Mulai Sesi Kasir Sekarang"}
          </Button>
        </form>
      </div>
    </div>
  );
}
