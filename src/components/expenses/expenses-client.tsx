"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  DollarSign,
  Plus,
  Search,
  Download,
  Calendar,
  Filter,
  CreditCard,
  Banknote,
  Receipt,
  X,
} from "lucide-react";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createExpense } from "@/lib/actions/expenses";
import * as XLSX from "xlsx";

interface ExpenseItem {
  id: string;
  date: Date | string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  notes?: string | null;
  user?: { name: string };
}

interface ExpensesClientProps {
  initialExpenses: ExpenseItem[];
  activeCashSession: any;
  isOwnerOrAdmin: boolean;
}

export function ExpensesClient({
  initialExpenses,
  activeCashSession,
  isOwnerOrAdmin,
}: ExpensesClientProps) {
  const [expenses, setExpenses] = useState<ExpenseItem[]>(initialExpenses);
  const [prevInitialExpenses, setPrevInitialExpenses] = useState(initialExpenses);
  const router = useRouter();

  if (prevInitialExpenses !== initialExpenses) {
    setPrevInitialExpenses(initialExpenses);
    setExpenses(initialExpenses);
  }

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    category: "Operasional",
    description: "",
    amount: 50000,
    paymentMethod: "CASH" as "CASH" | "QRIS" | "OTHER",
    useCashSession: true,
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const categories = [
    "Operasional",
    "Bahan Baku & Bibit",
    "Botol & Kemasan",
    "Listrik & Air",
    "Sewa Tempat",
    "Gaji Pegawai",
    "Lain-lain",
  ];

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const matchCat =
        selectedCategory === "ALL" || e.category === selectedCategory;
      if (!matchCat) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        (e.notes && e.notes.toLowerCase().includes(q))
      );
    });
  }, [expenses, selectedCategory, search]);

  const totalExpense = useMemo(() => {
    return filteredExpenses.reduce((sum, item) => sum + Number(item.amount), 0);
  }, [filteredExpenses]);

  const handleOpenAdd = () => {
    setFormData({
      date: new Date().toISOString().slice(0, 10),
      category: "Operasional",
      description: "",
      amount: 50000,
      paymentMethod: "CASH",
      useCashSession: !!activeCashSession,
      notes: "",
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setIsSubmitting(true);

    try {
      const res = await createExpense({
        date: formData.date,
        category: formData.category,
        description: formData.description,
        amount: Number(formData.amount),
        paymentMethod: formData.paymentMethod,
        notes: formData.notes || undefined,
        cashSessionId:
          formData.useCashSession && activeCashSession ? activeCashSession.id : undefined,
      });

      if (!res.success) {
        setFormError(res.error || "Gagal mencatat pengeluaran.");
      } else if (res.data?.id) {
        const created: ExpenseItem = {
          id: res.data.id,
          date: res.data.date,
          category: res.data.category ?? formData.category,
          description: res.data.description ?? formData.description,
          amount: Number(res.data.amount),
          paymentMethod: res.data.paymentMethod ?? formData.paymentMethod,
          notes: res.data?.notes,
          user: { name: "Anda" },
        };
        setExpenses((prev) => [created, ...prev]);
        setIsModalOpen(false);
        router.refresh();
      } else {
        setIsModalOpen(false);
        router.refresh();
      }
    } catch (err: any) {
      setFormError(err?.message || "Terjadi kesalahan sistem.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExport = () => {
    const data = expenses.map((e) => ({
      Tanggal: formatDate(e.date),
      Kategori: e.category,
      Deskripsi: e.description,
      Jumlah: Number(e.amount),
      Metode_Bayar: e.paymentMethod,
      Catatan: e.notes || "",
      Petugas: e.user?.name || "",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pengeluaran");
    XLSX.writeFile(wb, `Pengeluaran_Toko_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Pengeluaran Operasional Toko
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Catat semua beban operasional toko (listrik, sewa, perlengkapan, makan, gaji) agar laba bersih akurat.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="rounded-xl flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
          >
            <Download className="h-4 w-4 text-emerald-600" />
            Ekspor Excel
          </Button>

          {isOwnerOrAdmin && (
            <Button
              onClick={handleOpenAdd}
              size="sm"
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Catat Pengeluaran
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Total Pengeluaran Tercatat
            </span>
            <div className="h-8 w-8 rounded-xl bg-rose-50 dark:bg-rose-950 flex items-center justify-center text-rose-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-2">
            {formatCurrency(totalExpense)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {filteredExpenses.length} transaksi beban
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Pengeluaran Tunai (Kas Laci)
            </span>
            <div className="h-8 w-8 rounded-xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center text-amber-600">
              <Banknote className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
            {formatCurrency(
              filteredExpenses
                .filter((e) => e.paymentMethod === "CASH")
                .reduce((s, it) => s + Number(it.amount), 0)
            )}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Mengurangi fisik kasir</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Pengeluaran Bank / Transfer
            </span>
            <div className="h-8 w-8 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
            {formatCurrency(
              filteredExpenses
                .filter((e) => e.paymentMethod !== "CASH")
                .reduce((s, it) => s + Number(it.amount), 0)
            )}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Rekening operasional</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Cari pengeluaran..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 text-xs rounded-xl"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="h-10 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 outline-none"
        >
          <option value="ALL">Semua Kategori</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="py-3 px-4">Tanggal</th>
              <th className="py-3 px-4">Kategori</th>
              <th className="py-3 px-4">Deskripsi</th>
              <th className="py-3 px-4">Metode Bayar</th>
              <th className="py-3 px-4 text-right">Nominal</th>
              <th className="py-3 px-4">Catatan</th>
              <th className="py-3 px-4">Dicatat Oleh</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredExpenses.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  Belum ada catatan pengeluaran.
                </td>
              </tr>
            ) : (
              filteredExpenses.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                    {formatDate(e.date)}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {e.category}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                    {e.description}
                  </td>
                  <td className="py-3.5 px-4">
                    <Badge variant={e.paymentMethod === "CASH" ? "default" : "secondary"}>
                      {e.paymentMethod === "CASH" ? "TUNAI" : "NON-TUNAI"}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 text-right font-extrabold text-rose-600 dark:text-rose-400">
                    {formatCurrency(e.amount)}
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 max-w-[180px] truncate">
                    {e.notes || "-"}
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                    {e.user?.name || "Kasir"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CREATE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Catat Pengeluaran Toko
            </h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Masukkan rincian pengeluaran operasional dan pilih sumber pembayaran.
            </p>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 text-rose-600 text-xs font-semibold border border-rose-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Tanggal *
                  </label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="h-10 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Kategori *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="h-10 w-full text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Deskripsi Pengeluaran *
                </label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Misal: Beli pita kado & plastik kemasan"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Nominal (Rp) *
                  </label>
                  <Input
                    type="number"
                    min={1000}
                    step={1000}
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                    className="h-10 text-sm font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Metode Pembayaran
                  </label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) =>
                      setFormData({ ...formData, paymentMethod: e.target.value as any })
                    }
                    className="h-10 w-full text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 outline-none"
                  >
                    <option value="CASH">Kas Tunai di Laci</option>
                    <option value="OTHER">Transfer Bank / Lainnya</option>
                  </select>
                </div>
              </div>

              {formData.paymentMethod === "CASH" && activeCashSession && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200">
                  <input
                    type="checkbox"
                    id="useCashSession"
                    checked={formData.useCashSession}
                    onChange={(e) =>
                      setFormData({ ...formData, useCashSession: e.target.checked })
                    }
                    className="rounded text-indigo-600 cursor-pointer"
                  />
                  <label htmlFor="useCashSession" className="cursor-pointer font-medium">
                    Kurangi saldo kas fisik sesi aktif (Modal kasir saat ini)
                  </label>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Catatan Tambahan
                </label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Keterangan toko atau nomor struk nota beli..."
                  className="h-10 text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl cursor-pointer"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan Pengeluaran"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
