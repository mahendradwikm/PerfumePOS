"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
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
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber } from "@/lib/format";
import { createProduct, updateProduct, bulkCreateProducts, deleteProduct, deactivateProduct, createCategory, updateCategory, deleteCategory } from "@/lib/actions/products";
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
  description?: string | null;
  isActive?: boolean;
  _count?: { products: number };
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
  const [prevInitialProducts, setPrevInitialProducts] = useState(initialProducts);
  const router = useRouter();

  // Categories are edited from this page, so they need the same
  // reconcile-with-server-data treatment as the product list.
  const [categoryList, setCategoryList] = useState<Category[]>(categories);
  const [prevInitialCategories, setPrevInitialCategories] = useState(categories);

  if (prevInitialProducts !== initialProducts) {
    setPrevInitialProducts(initialProducts);
    setProducts(initialProducts);
  }

  if (prevInitialCategories !== categories) {
    setPrevInitialCategories(categories);
    setCategoryList(categories);
  }

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
    categoryId: categoryList[0]?.id || "",
    unit: "ml",
    costPrice: 0,
    sellingPrice: 0,
    initialStock: 0,
    minimumStock: 50,
    description: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Delete confirmation state
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [notice, setNotice] = useState("");

  // Category management state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "" });
  const [categoryError, setCategoryError] = useState("");
  const [isCategorySubmitting, setIsCategorySubmitting] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);
  const [categoryDeleteError, setCategoryDeleteError] = useState("");

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

  // A category can be deleted from this page (or on another device). Drop the
  // stale filter instead of leaving the table permanently blank.
  if (categoryFilter !== "ALL" && !categoryList.some((c) => c.name === categoryFilter)) {
    setCategoryFilter("ALL");
  }

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData({
      sku: `PRF-${Math.floor(100 + Math.random() * 900)}`,
      barcode: `899${Math.floor(100000 + Math.random() * 900000)}`,
      name: "",
      fragranceName: "",
      categoryId: categoryList[0]?.id || "",
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
      categoryId: p.categoryId || p.category?.id || categoryList[0]?.id || "",
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
                  category: categoryList.find((c) => c.id === formData.categoryId) || item.category,
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

        const newProd = res.data;
        if (newProd?.id) {
          setProducts((prev) => [
            {
              ...newProd,
              costPrice: Number(newProd.costPrice),
              sellingPrice: Number(newProd.sellingPrice),
              currentStock: Number(newProd.currentStock),
              minimumStock: Number(newProd.minimumStock),
              category: categoryList.find((c) => c.id === formData.categoryId) || null,
            } as any,
            ...prev,
          ]);
        }
      }

      setIsModalOpen(false);
      router.refresh();
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
      if (!newStatus) {
        // Turning it off hides it from Kasir - use the idempotent soft-delete path.
        const res = await deactivateProduct(p.id);
        if (!res.success) {
          setNotice(res.error || "Gagal menonaktifkan produk");
          return;
        }
      } else {
        const res = await updateProduct(p.id, { isActive: true });
        if (!res.success) {
          // Already deleted (here or on another device) - drop it from this list too.
          setProducts((prev) => prev.filter((it) => it.id !== p.id));
          setNotice(`Produk "${p.name}" sudah tidak ada, jadi dihapus dari daftar.`);
          router.refresh();
          return;
        }
      }

      setProducts((prev) =>
        prev.map((it) => (it.id === p.id ? { ...it, isActive: newStatus } : it))
      );
      router.refresh();
    } catch (err) {
      setNotice("Gagal mengubah status aktif produk");
    }
  };

  // ============================================================
  // DELETE PRODUCT
  // ============================================================

  const handleOpenDelete = (p: Product) => {
    setDeletingProduct(p);
    setDeleteError("");
    setDeleteBlocked(false);
  };

  const closeDeleteModal = () => {
    if (isDeleting) return;
    setDeletingProduct(null);
    setDeleteError("");
    setDeleteBlocked(false);
  };

  /** Removes the row locally + refreshes every server-rendered menu. */
  const forgetProduct = (productId: string) => {
    setProducts((prev) => prev.filter((it) => it.id !== productId));
    setCategoryList((prev) =>
      prev.map((c) => ({
        ...c,
        _count: c._count
          ? { products: Math.max(0, c._count.products - 1) }
          : c._count,
      }))
    );
    router.refresh();
  };

  const handleConfirmDelete = async () => {
    if (!deletingProduct || isDeleting) return;
    setIsDeleting(true);
    setDeleteError("");
    setDeleteBlocked(false);

    try {
      const res = await deleteProduct(deletingProduct.id);

      if (res.success) {
        const name = deletingProduct.name;
        forgetProduct(deletingProduct.id);
        setDeletingProduct(null);
        setNotice(
          res.alreadyDeleted
            ? `"${name}" sudah tidak ada di database, daftar sudah diperbarui.`
            : `"${name}" dihapus dari Katalog, Inventori, dan Kasir.`
        );
        return;
      }

      setDeleteBlocked(!!res.canDeactivate);
      setDeleteError(res.error || "Gagal menghapus produk");
    } catch (err: any) {
      setDeleteError(err?.message || "Terjadi kesalahan sistem.");
    } finally {
      setIsDeleting(false);
    }
  };

  /** Fallback for products locked by transaction history: soft delete instead. */
  const handleConfirmDeactivate = async () => {
    if (!deletingProduct || isDeleting) return;
    setIsDeleting(true);
    setDeleteError("");

    try {
      const res = await deactivateProduct(deletingProduct.id);
      const name = deletingProduct.name;

      if (!res.success) {
        setDeleteError(res.error || "Gagal menonaktifkan produk");
        return;
      }

      setProducts((prev) => prev.filter((it) => it.id !== deletingProduct.id));
      setDeletingProduct(null);
      router.refresh();
      setNotice(
        res.alreadyDeactivated
          ? `"${name}" sudah nonaktif, daftar sudah diperbarui.`
          : `"${name}" dinonaktifkan - hilang dari Kasir & Inventori, riwayat penjualan tetap tersimpan.`
      );
    } catch (err: any) {
      setDeleteError(err?.message || "Terjadi kesalahan sistem.");
    } finally {
      setIsDeleting(false);
    }
  };

  // ============================================================
  // CATEGORY MANAGEMENT
  // ============================================================

  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCategoryForm({ name: "", description: "" });
    setCategoryError("");
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (c: Category) => {
    setEditingCategory(c);
    setCategoryForm({ name: c.name, description: c.description || "" });
    setCategoryError("");
    setIsCategoryModalOpen(true);
  };

  const handleSubmitCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCategoryError("");
    setIsCategorySubmitting(true);

    try {
      const res = editingCategory
        ? await updateCategory(editingCategory.id, {
            name: categoryForm.name,
            description: categoryForm.description,
          })
        : await createCategory(categoryForm.name, categoryForm.description);

      if (!res.success || !res.data) {
        setCategoryError(res.error || "Gagal menyimpan kategori");
        return;
      }

      const saved = res.data;
      setCategoryList((prev) =>
        editingCategory
          ? prev.map((c) =>
              c.id === saved.id
                ? {
                    ...c,
                    name: saved.name,
                    description: saved.description,
                    _count: saved._count,
                  }
                : c
            )
          : [...prev, { ...saved, _count: saved._count }]
      );
      // A renamed/deleted category changes the filter label on other menus.
      if (editingCategory) setCategoryFilter("ALL");

      setIsCategoryModalOpen(false);
      router.refresh();
    } catch (err: any) {
      setCategoryError(err?.message || "Terjadi kesalahan sistem.");
    } finally {
      setIsCategorySubmitting(false);
    }
  };

  const handleConfirmDeleteCategory = async () => {
    if (!deletingCategory || isDeletingCategory) return;
    setIsDeletingCategory(true);
    setCategoryDeleteError("");

    try {
      const res = await deleteCategory(deletingCategory.id);

      if (res.success) {
        const name = deletingCategory.name;
        setCategoryList((prev) => prev.filter((c) => c.id !== deletingCategory.id));
        if (categoryFilter === name) setCategoryFilter("ALL");
        setDeletingCategory(null);
        router.refresh();
        setNotice(
          res.alreadyDeleted
            ? `Kategori "${name}" sudah tidak ada, daftar kategori diperbarui.`
            : `Kategori "${name}" dihapus dari semua menu.`
        );
        return;
      }

      setCategoryDeleteError(res.error || "Gagal menghapus kategori");
    } catch (err: any) {
      setCategoryDeleteError(err?.message || "Terjadi kesalahan sistem.");
    } finally {
      setIsDeletingCategory(false);
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
    XLSX.writeFile(workbook, `Katalog_Produk_MISYourPOS_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // CSV/Excel Import Handler
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      let parsedRows: Record<string, unknown>[] = [];

      if (file.name.endsWith(".csv")) {
        const text = await file.text();
        const result = Papa.parse<Record<string, unknown>>(text, {
          header: true,
          skipEmptyLines: true,
        });
        parsedRows = result.data;
      } else {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        parsedRows = XLSX.utils.sheet_to_json(sheet);
      }

      if (parsedRows.length === 0) {
        alert("File kosong atau format tidak sesuai");
        setIsImporting(false);
        return;
      }

      // Map rows to schema items
      const itemsToImport = parsedRows.map((row) => {
        const sku = String(row.SKU || row.sku || row.Kode || row.code || `PRF-${Date.now()}-${Math.floor(Math.random() * 1000)}`);
        const name = String(row.Nama_Produk || row.Nama || row.name || row.Name || sku);
        const fragranceName = row.Aroma || row.fragranceName || row.fragrance ? String(row.Aroma || row.fragranceName || row.fragrance) : undefined;
        const categoryName = row.Kategori || row.category || row.categoryName ? String(row.Kategori || row.category || row.categoryName) : undefined;
        const unit = String(row.Satuan || row.unit || "ml");
        const costPrice = Number(row.Harga_Beli_HPP || row.Harga_Beli || row.HPP || row.costPrice || 0);
        const sellingPrice = Number(row.Harga_Jual || row.sellingPrice || row.Price || row.harga || 0);
        const initialStock = Number(row.Stok_Sekarang || row.Stok || row.currentStock || row.stock || 0);
        const minimumStock = Number(row.Stok_Minimum || row.minimumStock || 20);

        return {
          sku,
          name,
          fragranceName,
          categoryName,
          unit,
          costPrice,
          sellingPrice,
          initialStock,
          minimumStock,
        };
      });

      const res = await bulkCreateProducts(itemsToImport);
      if (res.success) {
        alert(`Berhasil mengimpor produk!\n- Baru ditambahkan: ${res.createdCount}\n- Diperbarui: ${res.updatedCount}`);
        window.location.reload();
      } else {
        alert(`Gagal impor: ${res.error}`);
      }
    } catch (err: unknown) {
      console.error("Error parsing import file:", err);
      alert("Terjadi kesalahan saat membaca file spreadsheet.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden file input for import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportFile}
        accept=".csv,.xlsx,.xls"
        className="hidden"
      />

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
          {isOwnerOrAdmin && (
            <Button
              variant="outline"
              size="sm"
              disabled={isImporting}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            >
              {isImporting ? (
                <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
              ) : (
                <Upload className="h-4 w-4 text-indigo-600" />
              )}
              {isImporting ? "Mengimpor..." : "Impor CSV / Excel"}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="rounded-xl flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
          >
            <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
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
              {categoryList.map((c) => (
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

      {/* Action feedback banner */}
      {notice && (
        <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3">
          <CheckCircle className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="flex-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300">{notice}</p>
          <button
            onClick={() => setNotice("")}
            className="p-0.5 rounded-full text-emerald-600 hover:text-emerald-800 cursor-pointer"
            aria-label="Tutup notifikasi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
                        !p.isActive ? "opacity-60 bg-slate-50/40 dark:bg-slate-800/30" : ""
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
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                          }`}
                        >
                          {p.isActive ? "Aktif" : "Nonaktif"}
                        </button>
                      </td>
                      {isOwnerOrAdmin && (
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Edit produk"
                              aria-label={`Edit ${p.name}`}
                              onClick={() => handleOpenEdit(p)}
                              className="rounded-lg text-slate-500 hover:text-indigo-600"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Hapus produk"
                              aria-label={`Hapus ${p.name}`}
                              onClick={() => handleOpenDelete(p)}
                              className="rounded-lg text-slate-500 hover:text-rose-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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

      {/* Category Management */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Kategori Produk</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Kategori yang dipakai di Katalog, Inventori, Kasir, dan Laporan.
            </p>
          </div>
          {isOwnerOrAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenAddCategory}
              className="rounded-xl flex items-center gap-1.5 text-xs font-semibold cursor-pointer shrink-0"
            >
              <Plus className="h-4 w-4 text-indigo-600" />
              Tambah Kategori
            </Button>
          )}
        </div>

        {categoryList.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400">
            Belum ada kategori. Tambahkan kategori agar produk lebih mudah difilter.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {categoryList.map((c) => {
              const count = c._count?.products ?? 0;
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {c.name}
                    </div>
                    {c.description && (
                      <div className="text-[11px] text-slate-500 truncate">{c.description}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                      {count} produk
                    </span>
                    {isOwnerOrAdmin && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title={`Ubah kategori ${c.name}`}
                          aria-label={`Ubah kategori ${c.name}`}
                          onClick={() => handleOpenEditCategory(c)}
                          className="rounded-lg text-slate-500 hover:text-indigo-600"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title={`Hapus kategori ${c.name}`}
                          aria-label={`Hapus kategori ${c.name}`}
                          onClick={() => {
                            setDeletingCategory(c);
                            setCategoryDeleteError("");
                          }}
                          className="rounded-lg text-slate-500 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* DELETE PRODUCT CONFIRMATION */}
      {deletingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden p-6">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Hapus produk ini?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {deletingProduct.name}
                  </span>{" "}
                  ({deletingProduct.sku}) beserta seluruh riwayat stoknya akan dihapus permanen.
                </p>
              </div>
              <button
                onClick={closeDeleteModal}
                disabled={isDeleting}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer shrink-0"
                aria-label="Batal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3 text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
              <p className="font-bold">Produk ini akan langsung hilang dari:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Katalog Produk &amp; Kategori</li>
                <li>Inventori &amp; Stok (ringkasan nilai &amp; daftar produk)</li>
                <li>Kasir / POS (tidak bisa lagi dijual atau discan)</li>
                <li>Laporan Penjualan &amp; Laporan Produk</li>
              </ul>
              <p className="pt-1">Transaksi yang sudah pernah tercatat tidak ikut terhapus.</p>
            </div>

            {deleteError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 text-xs font-semibold border border-rose-200 dark:border-rose-900 leading-relaxed">
                {deleteError}
              </div>
            )}

            <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeDeleteModal}
                disabled={isDeleting}
                className="rounded-xl cursor-pointer"
              >
                Batal
              </Button>
              {!deleteBlocked && (
                <Button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold cursor-pointer"
                >
                  {isDeleting ? "Menghapus..." : "Ya, Hapus Permanen"}
                </Button>
              )}
              {deleteBlocked && (
                <Button
                  type="button"
                  onClick={handleConfirmDeactivate}
                  disabled={isDeleting}
                  className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold cursor-pointer"
                >
                  {isDeleting ? "Memproses..." : "Nonaktifkan Saja"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DELETE CATEGORY CONFIRMATION */}
      {deletingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden p-6">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Hapus kategori ini?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Kategori{" "}
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {deletingCategory.name}
                  </span>{" "}
                  akan dihapus. Filter kategori di Kasir dan Inventori ikut diperbarui.
                </p>
              </div>
              <button
                onClick={() => {
                  setDeletingCategory(null);
                  setCategoryDeleteError("");
                }}
                disabled={isDeletingCategory}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer shrink-0"
                aria-label="Batal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {categoryDeleteError ? (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 text-xs font-semibold border border-rose-200 dark:border-rose-900 leading-relaxed">
                {categoryDeleteError}
              </div>
            ) : (
              <p className="mt-4 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Produk di dalam kategori ini tidak ikut terhapus.
              </p>
            )}

            <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDeletingCategory(null);
                  setCategoryDeleteError("");
                }}
                disabled={isDeletingCategory}
                className="rounded-xl cursor-pointer"
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={handleConfirmDeleteCategory}
                disabled={isDeletingCategory || !!categoryDeleteError}
                className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold cursor-pointer"
              >
                {isDeletingCategory ? "Menghapus..." : "Ya, Hapus Kategori"}
              </Button>
            </div>
          </div>
        </div>
      )}

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
                    {categoryList.map((c) => (
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

      {/* CREATE / EDIT CATEGORY MODAL */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingCategory ? "Ubah Kategori" : "Tambah Kategori"}
              </h3>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Tutup"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {categoryError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 text-xs font-semibold border border-rose-200">
                {categoryError}
              </div>
            )}

            <form onSubmit={handleSubmitCategory} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Nama Kategori *
                </label>
                <Input
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="Contoh: Floral & Fresh"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Deskripsi (Opsional)
                </label>
                <Input
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  placeholder="Contoh: Kategori aroma floral yang menyegarkan"
                />
              </div>

              {editingCategory && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Mengubah nama kategori akan otomatis menyesuaikan tampilan kategori di Katalog,
                  Inventori, Kasir, dan Laporan.
                </p>
              )}

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="rounded-xl cursor-pointer"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isCategorySubmitting}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer"
                >
                  {isCategorySubmitting
                    ? "Menyimpan..."
                    : editingCategory
                      ? "Simpan Perubahan"
                      : "Tambah Kategori"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
