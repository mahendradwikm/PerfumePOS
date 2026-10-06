"use client";

import { useState, useMemo } from "react";
import {
  Package,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  Edit,
  Trash2,
  AlertTriangle,
  CheckCircle,
  X,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { createProduct, updateProduct } from "@/lib/actions/products";
import Papa from "papaparse";
import * as XLSX from "xlsx";

interface Product {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  fragranceName: string | null;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  currentStock: number;
  minimumStock: number;
  isActive: boolean;
  category?: { id: string; name: string } | null;
  categoryId?: string | null;
  description?: string | null;
}

interface Category {
  id: string;
  name: string;
}

interface ProductsClientProps {
  initialProducts: Product[];
  categories: Category[];
  isOwnerOrAdmin: boolean;
}

export function ProductsClient({
  initialProducts,
  categories,
  isOwnerOrAdmin,
}: ProductsClientProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [stockStatusFilter, setStockStatusFilter] = useState("ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    sku: "",
    barcode: "",
    name: "",
    fragranceName: "",
    categoryId: categories[0]?.id || "",
    unit: "ml",
    costPrice: 0,
    sellingPrice: 0,
    initialStock: 0,
    minimumStock: 50,
    description: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat =
        categoryFilter === "ALL" ||
        p.category?.name === categoryFilter ||
        p.categoryId === categoryFilter;

      if (!matchCat) return false;

      if (stockStatusFilter === "LOW") {
        if (p.currentStock > p.minimumStock || p.currentStock <= 0) return false;
      } else if (stockStatusFilter === "OUT") {
        if (p.currentStock > 0) return false;
      }

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.fragranceName && p.fragranceName.toLowerCase().includes(q))
      );
    });
  }, [products, categoryFilter, stockStatusFilter, search]);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData({
      sku: `PRF-${Math.floor(100 + Math.random() * 900)}`,
      barcode: `899${Math.floor(100000 + Math.random() * 900000)}`,
      name: "",
      fragranceName: "",
      categoryId: categories[0]?.id || "",
      unit: "ml",
      costPrice: 1000,
      sellingPrice: 3000,
      initialStock: 500,
      minimumStock: 100,
      description: "",
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      sku: p.sku,
      barcode: p.barcode || "",
      name: p.name,
      fragranceName: p.fragranceName || "",
      categoryId: p.categoryId || p.category?.id || categories[0]?.id || "",
      unit: p.unit,
      costPrice: p.costPrice,
      sellingPrice: p.sellingPrice,
      initialStock: p.currentStock,
      minimumStock: p.minimumStock,
      description: p.description || "",
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setIsSubmitting(true);

    try {
      if (editingProduct) {
        // Update product
        const res = await updateProduct(editingProduct.id, {
          sku: formData.sku,
          barcode: formData.barcode || undefined,
          name: formData.name,
          fragranceName: formData.fragranceName || undefined,
          categoryId: formData.categoryId || undefined,
          unit: formData.unit,
          costPrice: Number(formData.costPrice),
          sellingPrice: Number(formData.sellingPrice),
          minimumStock: Number(formData.minimumStock),
          description: formData.description || undefined,
        });

        if (!res.success) {
          setFormError(res.error || "Gagal mengupdate produk");
          setIsSubmitting(false);
          return;
        }

        setProducts((prev) =>
          prev.map((item) =>
            item.id === editingProduct.id
              ? {
                  ...item,
                  ...formData,
                  costPrice: Number(formData.costPrice),
                  sellingPrice: Number(formData.sellingPrice),
                  minimumStock: Number(formData.minimumStock),
                  category: categories.find((c) => c.id === formData.categoryId) || item.category,
                }
              : item
          )
        );
      } else {
        // Create product
        const res = await createProduct({
          sku: formData.sku,
          barcode: formData.barcode || undefined,
          name: formData.name,
          fragranceName: formData.fragranceName || undefined,
          categoryId: formData.categoryId || undefined,
          unit: formData.unit,
          costPrice: Number(formData.costPrice),
          sellingPrice: Number(formData.sellingPrice),
          initialStock: Number(formData.initialStock),
          minimumStock: Number(formData.minimumStock),
          description: formData.description || undefined,
          isActive: true,
        });

        if (!res.success) {
          setFormError(res.error || "Gagal menambah produk");
          setIsSubmitting(false);
          return;
        }

        const newProd = res.data!;
        setProducts((prev) => [
          {
            ...newProd,
            costPrice: Number(newProd!.costPrice),
            sellingPrice: Number(newProd!.sellingPrice),
            currentStock: Number(newProd!.currentStock),
            minimumStock: Number(newProd!.minimumStock),
            category: categories.find((c) => c.id === formData.categoryId) || null,
          } as any,
          ...prev,
        ]);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err?.message || "Terjadi kesalahan sistem.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Active Status
  const handleToggleActive = async (p: Product) => {
    if (!isOwnerOrAdmin) return;
    const newStatus = !p.isActive;
    try {
      await updateProduct(p.id, { isActive: newStatus });
      setProducts((prev) =>
        prev.map((it) => (it.id === p.id ? { ...it, isActive: newStatus } : it))
      );
    } catch (err) {
      alert("Gagal mengubah status aktif produk");
    }
  };

  // CSV/Excel Export
  const handleExportCSV = () => {
    const exportData = products.map((p) => ({
      SKU: p.sku,
      Barcode: p.barcode || "",
      Nama_Produk: p.name,
      Kategori: p.category?.name || "",
      Aroma: p.fragranceName || "",
      Satuan: p.unit,
      Harga_Beli_HPP: p.costPrice,
      Harga_Jual: p.sellingPrice,
      Stok_Sekarang: p.currentStock,
      Stok_Minimum: p.minimumStock,
      Status: p.isActive ? "Aktif" : "Nonaktif",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Katalog Produk");
    XLSX.writeFile(workbook, `Katalog_Produk_AromaPOS_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Katalog Produk & Kategori
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Kelola seluruh varian bibit parfum refill, botol kaca spray, harga beli, dan harga jual.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
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
              Tambah Produk
            </Button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Cari berdasarkan nama parfum, SKU, barcode, atau aroma..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 text-xs rounded-xl"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-10 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 outline-none"
            >
              <option value="ALL">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value)}
              className="h-10 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 outline-none"
            >
              <option value="ALL">Semua Kondisi Stok</option>
              <option value="LOW">Stok Menipis</option>
              <option value="OUT">Stok Habis</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Produk / Varian</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4">SKU / Barcode</th>
                <th className="py-3 px-4 text-right">Harga Beli (HPP)</th>
                <th className="py-3 px-4 text-right">Harga Jual</th>
                <th className="py-3 px-4 text-center">Stok Fisik</th>
                <th className="py-3 px-4 text-center">Status</th>
                {isOwnerOrAdmin && <th className="py-3 px-4 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Tidak ada produk yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isOut = p.currentStock <= 0;
                  const isLow = p.currentStock <= p.minimumStock && !isOut;

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                        !p.isActive ? "opacity-60 bg-slate-50/40" : ""
                      }`}
                    >
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                        <div className="font-bold text-sm truncate max-w-[220px]">
                          {p.name}
                        </div>
                        {p.fragranceName && (
                          <div className="text-[11px] text-slate-500 truncate max-w-[200px]">
                            {p.fragranceName}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          {p.category?.name || "Umum"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                        <div>{p.sku}</div>
                        {p.barcode && <div className="text-[10px] text-slate-400">{p.barcode}</div>}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-600 dark:text-slate-400">
                        {formatCurrency(p.costPrice)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-indigo-600 dark:text-indigo-400">
                        {formatCurrency(p.sellingPrice)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1 font-bold">
                          {isOut ? (
                            <Badge variant="destructive" className="text-[10px]">
                              0 {p.unit}
                            </Badge>
                          ) : isLow ? (
                            <Badge variant="warning" className="text-[10px]">
                              {formatNumber(p.currentStock)} {p.unit}
                            </Badge>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                              {formatNumber(p.currentStock)} {p.unit}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleToggleActive(p)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                            p.isActive
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-300"
                          }`}
                        >
                          {p.isActive ? "Aktif" : "Nonaktif"}
                        </button>
                      </td>
                      {isOwnerOrAdmin && (
                        <td className="py-3.5 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleOpenEdit(p)}
                            className="rounded-lg text-slate-500 hover:text-indigo-600"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden p-6 sm:p-7 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingProduct ? "Edit Informasi Produk" : "Tambah Produk Parfum Baru"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 text-xs font-semibold border border-rose-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Kode SKU *
                  </label>
                  <Input
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    required
                    className="font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Barcode (Opsional)
                  </label>
                  <Input
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Nama Produk / Varian *
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Baccarat Rouge 540 Refill"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Kategori
                  </label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="h-10 w-full text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Satuan Ukuran
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="h-10 w-full text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 outline-none"
                  >
                    <option value="ml">ml (Mililiter Refill)</option>
                    <option value="pcs">pcs (Botol / Aksesoris)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Harga Beli HPP (Rp) *
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Harga Jual (Rp) *
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {!editingProduct && (
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Stok Awal ({formData.unit})
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={formData.initialStock}
                      onChange={(e) => setFormData({ ...formData, initialStock: Number(e.target.value) })}
                    />
                  </div>
                )}
                <div className={editingProduct ? "col-span-2" : ""}>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Ambang Stok Minimum (Peringatan Menipis)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.minimumStock}
                    onChange={(e) => setFormData({ ...formData, minimumStock: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Deskripsi / Karakter Aroma
                </label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Catatan wangi saffron, jasmine, amberwood..."
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
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
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer"
                >
                  {isSubmitting ? "Menyimpan..." : editingProduct ? "Simpan Perubahan" : "Simpan Produk Baru"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
