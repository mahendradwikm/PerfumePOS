"use client";

import { useState } from "react";
import {
  Wallet,
  CheckCircle2,
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  DollarSign,
  Clock,
  History,
  Lock,
  Plus,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { openCashSession, closeCashSession } from "@/lib/actions/cash";
import { notifyCashSessionChanged } from "@/lib/cash-session-events";
import { useRouter } from "next/navigation";

interface CashSession {
  id: string;
  sessionDate: Date | string;
  openingCash: number;
  closingCash: number | null;
  expectedCash: number | null;
  variance: number | null;
  cashSales: number;
  qrisSales: number;
  cashExpenses: number;
  cashRefunds: number;
  totalSales: number;
  status: "OPEN" | "CLOSED";
  notes?: string | null;
  user?: { id: string; name: string };
  createdAt?: Date | string;
  closedAt?: Date | string;
}

interface CashClientProps {
  currentSession: CashSession | null;
  sessionHistory: CashSession[];
  currentUser: any;
}

/**
 * Remove duplicated sessions by id (keeping the first / newest occurrence).
 * Prevents React "two children with the same key" errors when a session is
 * both already present in the server list and prepended optimistically.
 */
function dedupeSessions(sessions: CashSession[]): CashSession[] {
  const seen = new Set<string>();
  const out: CashSession[] = [];
  for (const s of sessions) {
    if (!s?.id || seen.has(s.id)) continue;
    seen.add(s.id);
    out.push(s);
  }
  return out;
}

export function CashClient({
  currentSession: initialSession,
  sessionHistory: initialHistory,
  currentUser,
}: CashClientProps) {
  const router = useRouter();
  const [currentSession, setCurrentSession] = useState<CashSession | null>(initialSession);
  const [history, setHistory] = useState<CashSession[]>(initialHistory);

  // Keep local state in sync with server data (after router.refresh())
  const [prevSession, setPrevSession] = useState(initialSession);
  if (prevSession !== initialSession) {
    setPrevSession(initialSession);
    setCurrentSession(initialSession);
  }
  const [prevHistory, setPrevHistory] = useState(initialHistory);
  if (prevHistory !== initialHistory) {
    setPrevHistory(initialHistory);
    setHistory(dedupeSessions(initialHistory));
  }

  // Merge a session into history without ever creating duplicate rows (unique React keys)
  const upsertSession = (session: CashSession) => {
    setHistory((prev) => dedupeSessions([session, ...prev]));
  };

  // Open Session State
  const [isOpenModalVisible, setIsOpenModalVisible] = useState(false);
  const [openingCash, setOpeningCash] = useState<number>(100000);
  const [openNotes, setOpenNotes] = useState("Modal kembalian kasir");
  const [isOpening, setIsOpening] = useState(false);
  const [openError, setOpenError] = useState("");

  // Close Session State
  const [isCloseModalVisible, setIsCloseModalVisible] = useState(false);
  const [actualCash, setActualCash] = useState<number>(0);
  const [closeNotes, setCloseNotes] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const [closeError, setCloseError] = useState("");

  // Calculations for current session
  const expectedCash = currentSession
    ? currentSession.openingCash +
      currentSession.cashSales -
      currentSession.cashExpenses -
      currentSession.cashRefunds
    : 0;

  const variance = actualCash - expectedCash;

  // Handle Open Session
  const handleOpenSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setOpenError("");
    setIsOpening(true);

    try {
      const res = await openCashSession({
        openingCash: Number(openingCash),
        notes: openNotes,
      });

      if (!res.success) {
        setOpenError(res.error || "Gagal membuka sesi.");
      } else {
        const newSes = {
          ...res.data,
          openingCash: Number(res.data?.openingCash),
          cashSales: 0,
          qrisSales: 0,
          cashExpenses: 0,
          cashRefunds: 0,
          totalSales: 0,
          expectedCash: Number(res.data?.openingCash),
          closingCash: null,
          variance: null,
          user: { name: currentUser?.name || "Kasir" },
        };
        setCurrentSession(newSes as CashSession);
        setIsOpenModalVisible(false);
        router.refresh();
        // Update the header status chip immediately — it reads the session on
        // the client, so router.refresh() alone would leave it stale.
        notifyCashSessionChanged(newSes);
      }
    } catch (err: any) {
      setOpenError(err?.message || "Terjadi kesalahan sistem.");
    } finally {
      setIsOpening(false);
    }
  };

  // Open Close Modal
  const handlePromptClose = () => {
    setActualCash(expectedCash);
    setCloseNotes("");
    setCloseError("");
    setIsCloseModalVisible(true);
  };

  // Handle Close Session
  const handleCloseSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSession) return;
    setCloseError("");
    setIsClosing(true);

    try {
      const res = await closeCashSession({
        sessionId: currentSession.id,
        closingCash: Number(actualCash),
        notes: closeNotes,
      });

      if (!res.success) {
        setCloseError(res.error || "Gagal menutup sesi.");
      } else {
        const closed = {
          ...currentSession,
          status: "CLOSED" as const,
          closingCash: Number(actualCash),
          expectedCash,
          variance,
          notes: closeNotes || currentSession.notes,
        };
        setCurrentSession(null);
        upsertSession(closed as CashSession);
        setIsCloseModalVisible(false);
        router.refresh();
        // Mirror the header status chip back to "Kasir Tutup" without a reload.
        notifyCashSessionChanged(null);
      }
    } catch (err: any) {
      setCloseError(err?.message || "Terjadi kesalahan sistem.");
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Manajemen Sesi Kasir & Cash Drawer
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Rekonsiliasi uang fisik kasir, modal kembalian awal, omset tunai vs QRIS, dan hitung selisih tutup laci.
          </p>
        </div>

        <div>
          {!currentSession ? (
            <Button
              onClick={() => setIsOpenModalVisible(true)}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Buka Sesi Kasir Baru
            </Button>
          ) : (
            <Button
              onClick={handlePromptClose}
              variant="destructive"
              className="rounded-xl font-bold text-xs flex items-center gap-2 shadow-md shadow-rose-600/20 cursor-pointer"
            >
              <Lock className="h-4 w-4" />
              Tutup Sesi (Rekonsiliasi Kas)
            </Button>
          )}
        </div>
      </div>

      {/* ACTIVE SESSION CARD */}
      {currentSession ? (
        <div className="rounded-3xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/40 via-white to-purple-50/20 dark:from-slate-900 dark:to-indigo-950/30 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-indigo-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30">
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    Sesi Kasir Sedang Aktif
                  </h3>
                  <Badge variant="success" className="text-[10px]">
                    OPEN
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Petugas: <span className="font-semibold text-slate-800 dark:text-slate-200">{currentSession.user?.name || "Kasir"}</span> • Dibuka sejak: {formatDateTime(currentSession.sessionDate)}
                </p>
              </div>
            </div>

            <Button
              onClick={handlePromptClose}
              className="rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-white font-bold text-xs cursor-pointer"
            >
              Tutup Sesi & Hitung Uang
            </Button>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-500">
                Modal Awal Kembalian
              </span>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                {formatCurrency(currentSession.openingCash)}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Tidak dihitung omset</p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                Penjualan Tunai Masuk
              </span>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                +{formatCurrency(currentSession.cashSales)}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Uang fisik di laci</p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                Penjualan QRIS
              </span>
              <p className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                {formatCurrency(currentSession.qrisSales)}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Masuk rekening bank</p>
            </div>

            <div className="p-4 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
              <span className="text-[11px] font-medium text-indigo-100">
                Kas Fisik Seharusnya
              </span>
              <p className="text-2xl font-extrabold text-white mt-1">
                {formatCurrency(expectedCash)}
              </p>
              <p className="text-[10px] text-indigo-200 mt-0.5">
                Modal + Penjualan Tunai
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center bg-white dark:bg-slate-900">
          <div className="h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-4">
            <Lock className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Tidak Ada Sesi Kasir yang Terbuka
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-6">
            Buka sesi kasir baru dan masukkan modal uang kembalian sebelum kasir mulai melayani pelanggan di POS.
          </p>
          <Button
            onClick={() => setIsOpenModalVisible(true)}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer shadow-md shadow-indigo-600/20"
          >
            <Plus className="h-4 w-4 mr-1" />
            Buka Sesi Kasir Sekarang
          </Button>
        </div>
      )}

      {/* SESSION HISTORY TABLE */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Riwayat Sesi Kasir (Shift Log)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Catatan historis modal awal, uang fisik penutupan, dan selisih (variance).
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Waktu Buka</th>
                <th className="py-3 px-4">Kasir</th>
                <th className="py-3 px-4 text-right">Modal Awal</th>
                <th className="py-3 px-4 text-right">Penjualan Tunai</th>
                <th className="py-3 px-4 text-right">Penjualan QRIS</th>
                <th className="py-3 px-4 text-right">Kas Diharapkan</th>
                <th className="py-3 px-4 text-right">Uang Aktual Dihitung</th>
                <th className="py-3 px-4 text-right">Selisih</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    Belum ada riwayat sesi kasir sebelumnya.
                  </td>
                </tr>
              ) : (
                history.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {formatDateTime(s.sessionDate)}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      {s.user?.name || "Kasir"}
                    </td>
                    <td className="py-3 px-4 text-right font-medium">
                      {formatCurrency(s.openingCash)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(s.cashSales)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-purple-600 dark:text-purple-400">
                      {formatCurrency(s.qrisSales)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold">
                      {formatCurrency(s.expectedCash || s.openingCash + s.cashSales)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                      {s.closingCash !== null ? formatCurrency(s.closingCash) : "-"}
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold">
                      {s.variance !== null ? (
                        s.variance === 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400">Cocok (Rp0)</span>
                        ) : s.variance > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            +{formatCurrency(s.variance)} (Lebih)
                          </span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-400">
                            {formatCurrency(s.variance)} (Kurang)
                          </span>
                        )
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge
                        variant={s.status === "OPEN" ? "success" : "secondary"}
                        className="text-[10px]"
                      >
                        {s.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* OPEN SESSION MODAL */}
      {isOpenModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Buka Sesi Kasir Baru
            </h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Masukkan uang kas awal di laci yang disediakan untuk uang kembalian pelanggan.
            </p>

            {openError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 text-rose-600 text-xs font-semibold border border-rose-200">
                {openError}
              </div>
            )}

            <form onSubmit={handleOpenSession} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Modal Awal Kembalian (Rp) *
                </label>
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  value={openingCash}
                  onChange={(e) => setOpeningCash(Number(e.target.value))}
                  className="h-12 text-lg font-bold"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Catatan Sesi (Opsional)
                </label>
                <Input
                  type="text"
                  value={openNotes}
                  onChange={(e) => setOpenNotes(e.target.value)}
                  placeholder="Misal: Shift 1 Kasir Rina"
                  className="h-10 text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpenModalVisible(false)}
                  className="rounded-xl cursor-pointer"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isOpening}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
                >
                  {isOpening ? "Membuka..." : "Buka Sesi"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLOSE SESSION MODAL (RECONCILIATION) */}
      {isCloseModalVisible && currentSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Tutup Sesi & Hitung Uang Kas Laci
            </h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Hitung uang fisik tunai di laci untuk mencocokkan dengan saldo sistem.
            </p>

            {closeError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 text-rose-600 text-xs font-semibold border border-rose-200">
                {closeError}
              </div>
            )}

            <form onSubmit={handleCloseSession} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Modal Awal:</span>
                  <span>{formatCurrency(currentSession.openingCash)}</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Penjualan Tunai:</span>
                  <span>+{formatCurrency(currentSession.cashSales)}</span>
                </div>
                <div className="flex justify-between text-slate-900 dark:text-white font-bold pt-1 border-t border-slate-200 dark:border-slate-800 text-sm">
                  <span>Kas Diharapkan di Laci:</span>
                  <span>{formatCurrency(expectedCash)}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Uang Fisik Aktual Dihitung (Rp) *
                </label>
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  value={actualCash}
                  onChange={(e) => setActualCash(Number(e.target.value))}
                  className="h-12 text-lg font-extrabold text-indigo-600 dark:text-indigo-400"
                  required
                />
              </div>

              {/* Real-time Variance status */}
              <div className="p-3 rounded-xl border flex items-center justify-between text-xs font-bold">
                <span>Selisih Fisik:</span>
                <span
                  className={
                    variance === 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : variance > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }
                >
                  {variance === 0
                    ? "Sempurna Cocok (Rp0)"
                    : variance > 0
                    ? `Lebih +${formatCurrency(variance)}`
                    : `Kurang ${formatCurrency(Math.abs(variance))}`}
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Catatan Penutupan Sesi
                </label>
                <Input
                  type="text"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="Catatan penyerahan uang setoran..."
                  className="h-10 text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCloseModalVisible(false)}
                  className="rounded-xl cursor-pointer"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isClosing}
                  className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
                >
                  {isClosing ? "Menutup Sesi..." : "Konfirmasi Tutup Sesi"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
