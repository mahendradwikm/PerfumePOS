"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Sparkles,
  CreditCard,
  QrCode,
  Banknote,
  AlertTriangle,
  CheckCircle,
  Tag,
  Package,
  Layers,
  Percent,
  X,
  RefreshCw,
  QrCode as QrIcon,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createSale } from "@/lib/actions/sales";
import { ReceiptModal } from "@/components/pos/receipt-modal";
import { OpenSessionDialog } from "@/components/pos/open-session-dialog";

interface ProductItem {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  fragranceName: string | null;
  unit: string;
  sellingPrice: number;
  costPrice: number;
  currentStock: number;
  minimumStock: number;
  description?: string | null;
  category?: { id: string; name: string } | null;
  categoryId?: string | null;
}

interface CategoryItem {
  id: string;
  name: string;
}

interface CartItem {
  productId: string;
  sku: string;
  productName: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  total: number;
  maxStock: number;
}

interface POSClientProps {
  initialProducts: ProductItem[];
  categories: CategoryItem[];
  activeSession: any;
  currentUser: any;
  storeSettings?: any;
}

export function POSClient({
  initialProducts,
  categories,
  activeSession: initialSession,
  currentUser,
  storeSettings,
}: POSClientProps) {
  const router = useRouter();
  const [products, setProducts] = useState<ProductItem[]>(initialProducts);
  const [activeSession, setActiveSession] = useState<any>(initialSession);
  const [showOpenSessionModal, setShowOpenSessionModal] = useState<boolean>(!initialSession);

  const [prevInitialProducts, setPrevInitialProducts] = useState(initialProducts);
  if (prevInitialProducts !== initialProducts) {
    setPrevInitialProducts(initialProducts);
    setProducts(initialProducts);
  }

  const [prevInitialSession, setPrevInitialSession] = useState(initialSession);
  if (prevInitialSession !== initialSession) {
    setPrevInitialSession(initialSession);
    setActiveSession(initialSession);
  }

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [notes, setNotes] = useState("");

  // Checkout modal states
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "QRIS">("CASH");
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [customerName, setCustomerName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Receipt modal states
  const [receiptData, setReceiptData] = useState<any>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory =
        selectedCategory === "ALL" ||
        p.category?.name === selectedCategory ||
        p.categoryId === selectedCategory;

      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.fragranceName && p.fragranceName.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    });
  }, [products, selectedCategory, searchQuery]);

  // Cart Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.total, 0);
  }, [cart]);

  const grandTotal = useMemo(() => {
    const total = subtotal - discountAmount;
    return total > 0 ? total : 0;
  }, [subtotal, discountAmount]);

  const changeAmount = useMemo(() => {
    if (paymentMethod !== "CASH") return 0;
    return cashReceived >= grandTotal ? cashReceived - grandTotal : 0;
  }, [cashReceived, grandTotal, paymentMethod]);

  // Add to Cart
  const addToCart = (product: ProductItem, quantityToAdd: number = 1) => {
    if (product.currentStock <= 0) {
      alert("Stok produk ini sedang habis!");
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        const newQty = existing.quantity + quantityToAdd;
        if (newQty > product.currentStock) {
          alert(`Stok tidak mencukupi! Tersedia hanya ${product.currentStock} ${product.unit}`);
          return prev;
        }
        return prev.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                quantity: newQty,
                total: newQty * item.unitPrice - item.discount,
              }
            : item
        );
      } else {
        if (quantityToAdd > product.currentStock) {
          alert(`Stok tidak mencukupi! Tersedia hanya ${product.currentStock} ${product.unit}`);
          return prev;
        }
        return [
          ...prev,
          {
            productId: product.id,
            sku: product.sku,
            productName: product.name,
            unit: product.unit,
            unitPrice: product.sellingPrice,
            quantity: quantityToAdd,
            discount: 0,
            total: quantityToAdd * product.sellingPrice,
            maxStock: product.currentStock,
          },
        ];
      }
    });
  };

  // Update Cart Quantity
  const updateCartQty = (productId: string, newQty: number) => {
    const qty = Math.max(0, Number(newQty) || 0);
    setCart((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
          if (qty > item.maxStock) {
            alert(`Jumlah melebihi stok yang tersedia (${item.maxStock} ${item.unit})`);
            return item;
          }
          return {
            ...item,
            quantity: qty,
            total: qty * item.unitPrice - item.discount,
          };
        }
        return item;
      })
    );
  };

  // Remove from Cart
  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  // Clear Cart
  const clearCart = () => {
    setCart([]);
    setDiscountAmount(0);
    setNotes("");
  };

  // Open Checkout
  const handleOpenCheckout = () => {
    if (!activeSession) {
      setShowOpenSessionModal(true);
      return;
    }
    if (!cart.some((it) => it.quantity > 0)) return;
    setCashReceived(grandTotal); // default exact amount
    setErrorMessage("");
    setIsCheckoutOpen(true);
  };

  // Submit Sale
  const handleProcessCheckout = async () => {
    if (!activeSession) {
      setErrorMessage("Sesi kasir belum dibuka.");
      return;
    }

    // Only items with quantity > 0 are actually sold
    const saleItems = cart.filter((it) => it.quantity > 0);

    if (saleItems.length === 0) {
      setErrorMessage("Keranjang kosong. Tambahkan produk dengan jumlah lebih dari 0.");
      return;
    }

    if (paymentMethod === "CASH" && cashReceived < grandTotal) {
      setErrorMessage("Nominal uang tunai kurang dari total belanja!");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const res = await createSale({
        paymentMethod,
        items: saleItems.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          productSku: it.sku,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          costPrice: products.find((p) => p.id === it.productId)?.costPrice ?? 0,
          discount: it.discount,
          unit: it.unit,
        })),
        discountAmount,
        discountPercent: 0,
        cashReceived: paymentMethod === "CASH" ? cashReceived : undefined,
        notes: notes || undefined,
        customerName: customerName || undefined,
        cashSessionId: activeSession?.id || undefined,
      });

      if (!res.success) {
        setErrorMessage(res.error || "Gagal memproses transaksi.");
        setIsSubmitting(false);
        return;
      }

      // Update local product stocks atomically
      setProducts((prev) =>
        prev.map((p) => {
          const cartItem = saleItems.find((ci) => ci.productId === p.id);
          if (cartItem && cartItem.quantity > 0) {
            return {
              ...p,
              currentStock: p.currentStock - cartItem.quantity,
            };
          }
          return p;
        })
      );

      // Refresh server data so stock/summary stay in sync
      router.refresh();

      // Prepare receipt
      const createdSale = res.data;
      setReceiptData({
        transactionNumber: createdSale?.transactionNumber,
        date: new Date().toISOString(),
        cashierName: currentUser?.name || "Kasir",
        paymentMethod,
        subtotal,
        discountAmount,
        grandTotal,
        cashReceived: paymentMethod === "CASH" ? cashReceived : undefined,
        changeAmount: paymentMethod === "CASH" ? changeAmount : 0,
        items: cart.map((it) => ({
          productName: it.productName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          total: it.total,
          unit: it.unit,
        })),
      });

      setIsCheckoutOpen(false);
      setShowReceipt(true);
      clearCart();
    } catch (err: any) {
      setErrorMessage(err?.message || "Terjadi kesalahan sistem saat checkout.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-[calc(100vh-5.5rem)] lg:h-[calc(100vh-6.5rem)]">
      {/* LEFT COLUMN: Catalog & Products */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Top Header / Search & Category Filters */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 space-y-3.5 bg-slate-50/50 dark:bg-slate-900/50">
          {/* Active Session Warning Bar if closed */}
          {!activeSession && (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <span>Sesi kasir belum dibuka. Anda harus membuka sesi kasir sebelum transaksi.</span>
              </div>
              <Button
                size="sm"
                onClick={() => setShowOpenSessionModal(true)}
                className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-xs cursor-pointer"
              >
                Buka Sesi Kasir
              </Button>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Cari parfum (nama, SKU, aroma, barcode)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 h-12 sm:h-13 rounded-2xl bg-white dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 text-base font-medium shadow-inner"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="hidden sm:flex text-xs font-medium text-slate-400 items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <Package className="h-4 w-4 text-indigo-500" />
              <span>{filteredProducts.length} Produk</span>
            </div>
          </div>

          {/* Categories Horizontal Scroll */}
          <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedCategory("ALL")}
              className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === "ALL"
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/25"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              Semua Kategori
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.name)}
                className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === c.name
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/25"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12 text-center">
              <Package className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-3" />
              <p className="text-sm font-semibold">Produk tidak ditemukan</p>
              <p className="text-xs text-slate-400 mt-1">
                Coba cari dengan kata kunci lain atau pilih kategori lain.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
              {filteredProducts.map((p) => {
                const isOutOfStock = p.currentStock <= 0;
                const isLowStock = p.currentStock <= p.minimumStock && !isOutOfStock;
                const isPerfumeRefill = p.unit === "ml";

                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      if (isOutOfStock) return;
                      addToCart(p, isPerfumeRefill ? 30 : 1);
                    }}
                    className={`group relative flex flex-col justify-between rounded-2xl border p-4 transition-all duration-200 ${
                      isOutOfStock
                        ? "border-slate-200 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/40 opacity-70 cursor-not-allowed"
                        : "border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 cursor-pointer"
                    }`}
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-1.5 mb-2 flex-wrap">
                        <span className="text-[11px] font-mono font-bold text-slate-400 truncate">
                          {p.sku}
                        </span>
                        {isOutOfStock ? (
                          <Badge variant="destructive" className="text-[11px] px-2 py-0.5">
                            Stok Habis
                          </Badge>
                        ) : isLowStock ? (
                          <Badge variant="warning" className="text-[11px] px-2 py-0.5">
                            Sisa {p.currentStock} {p.unit}
                          </Badge>
                        ) : (
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            Stok {p.currentStock} {p.unit}
                          </span>
                        )}
                      </div>

                      {/* Product Title */}
                      <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                        {p.name}
                      </h4>

                      {/* Description / Aroma notes */}
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {p.fragranceName ? `Wangi: ${p.fragranceName}. ` : ""}
                        {p.description || "Aroma parfum refill premium tahan lama."}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="min-w-0">
                          <p className="text-xs text-slate-400">Harga per {p.unit}</p>
                          <p className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">
                            {formatCurrency(p.sellingPrice)}
                          </p>
                        </div>

                        {/* Standard add button */}
                        {!isPerfumeRefill && (
                          <Button
                            size="sm"
                            disabled={isOutOfStock}
                            onClick={(e) => {
                              e.stopPropagation();
                              addToCart(p, 1);
                            }}
                            className="rounded-xl bg-slate-900 hover:bg-indigo-600 dark:bg-slate-800 dark:hover:bg-indigo-600 text-white font-semibold cursor-pointer shrink-0"
                          >
                            <Plus className="h-4 w-4" /> Tambah
                          </Button>
                        )}
                      </div>

                      {/* Quick Refill presets for perfumes (30ml, 50ml, 100ml) */}
                      {isPerfumeRefill && !isOutOfStock && (
                        <div className="flex items-center gap-1.5 pt-1">
                          {[30, 50, 100].map((ml) => (
                            <button
                              key={ml}
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCart(p, ml);
                              }}
                              disabled={p.currentStock < ml}
                              className={`flex-1 min-w-0 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold border-2 transition-all cursor-pointer ${
                                p.currentStock >= ml
                                  ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-600 hover:text-white hover:border-indigo-600"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-50"
                              }`}
                            >
                              +{ml}ml
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Interactive Cart & Checkout Panel */}
      <div className="w-full lg:w-[380px] xl:w-[420px] flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden shrink-0">
        {/* Cart Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Keranjang Belanja
              </h3>
              <p className="text-[11px] text-slate-400">
                {cart.filter((it) => it.quantity > 0).length} jenis item dipilih
              </p>
            </div>
          </div>

          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-rose-500 hover:text-rose-600 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              Kosongkan
            </button>
          )}
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-16 text-center">
              <ShoppingCart className="h-12 w-12 text-slate-300 dark:text-slate-800 mb-3" />
              <p className="text-sm font-semibold">Keranjang masih kosong</p>
              <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
                Pilih parfum atau botol di katalog sebelah kiri untuk mulai transaksi.
              </p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.productId}
                className={`p-3.5 rounded-2xl border flex flex-col gap-2.5 ${
                  item.quantity === 0
                    ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60"
                    : "bg-slate-50 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-800"
                }`}
              >
                {item.quantity === 0 && (
                  <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    Jumlah 0 — produk ini tidak akan ikut transaksi
                  </p>
                )}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {item.productName}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {formatCurrency(item.unitPrice)} / {item.unit}
                    </p>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.productId)}
                    className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 p-2.5 rounded-xl cursor-pointer transition-colors"
                    aria-label="Hapus produk"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  {/* Quantity adjustment buttons */}
                  <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-1">
                    <button
                      onClick={() => updateCartQty(item.productId, item.quantity - 1)}
                      aria-label="Kurangi jumlah"
                      className="h-12 w-12 rounded-lg flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 cursor-pointer"
                    >
                      <Minus className="h-5 w-5" />
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={item.maxStock}
                      value={item.quantity}
                      aria-label={`Jumlah ${item.productName}`}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") {
                          updateCartQty(item.productId, 0);
                          return;
                        }
                        updateCartQty(item.productId, Number(raw));
                      }}
                      className="w-16 text-center text-lg font-black bg-transparent outline-none"
                    />
                    <button
                      onClick={() => updateCartQty(item.productId, item.quantity + 1)}
                      aria-label="Tambah jumlah"
                      className="h-12 w-12 rounded-lg flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 cursor-pointer"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="text-right">
                    <p className="text-base font-black text-slate-900 dark:text-white">
                      {formatCurrency(item.total)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Calculation & Payment Summary */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 space-y-3">
          {/* Discount input */}
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-2">
              <Percent className="h-4 w-4 text-indigo-500" />
              Diskon Toko (Rp)
            </span>
            <input
              type="number"
              min={0}
              step={1000}
              placeholder="0"
              aria-label="Diskon toko dalam rupiah"
              value={discountAmount || ""}
              onChange={(e) => setDiscountAmount(Number(e.target.value))}
              className="w-32 h-11 text-right font-bold text-base px-3 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-4 focus:ring-indigo-200 focus:border-indigo-500"
            />
          </div>

          <div className="space-y-2 pt-3 border-t border-slate-200/60 dark:border-slate-800 text-sm">
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span>Subtotal:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {formatCurrency(subtotal)}
              </span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-rose-500 font-semibold">
                <span>Diskon:</span>
                <span>-{formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-2 border-t border-slate-200 dark:border-slate-800">
              <span className="text-base font-bold text-slate-900 dark:text-white">
                Total Bayar:
              </span>
              <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                {formatCurrency(grandTotal)}
              </span>
            </div>
          </div>

          {/* Checkout Action Button */}
          <Button
            disabled={!cart.some((it) => it.quantity > 0)}
            onClick={handleOpenCheckout}
            className="w-full h-14 sm:h-16 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-base sm:text-lg shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 sm:gap-3 cursor-pointer transition-all active:scale-[0.99]"
          >
            <Banknote className="h-5 w-5 sm:h-6 sm:w-6" />
            <span className="truncate">Bayar Sekarang ({formatCurrency(grandTotal)})</span>
          </Button>
        </div>
      </div>

      {/* CHECKOUT MODAL */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden p-6 sm:p-7 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Pembayaran Kasir
                </h3>
                <p className="text-xs text-slate-500">
                  Total Tagihan:{" "}
                  <span className="font-extrabold text-indigo-600 dark:text-indigo-400 text-sm">
                    {formatCurrency(grandTotal)}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 text-xs font-semibold border border-rose-200 dark:border-rose-900">
                {errorMessage}
              </div>
            )}

            {/* Payment Method Selector */}
            <div className="space-y-4">
              <div>
                <label className="text-base font-bold text-slate-800 dark:text-slate-200 mb-3 block">
                  Metode Pembayaran
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("CASH")}
                    className={`flex items-center justify-center gap-3 p-5 rounded-2xl border-2 font-bold text-base transition-all cursor-pointer ${
                      paymentMethod === "CASH"
                        ? "border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 shadow-md"
                        : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    }`}
                  >
                    <Banknote className="h-6 w-6 text-indigo-600" />
                    Tunai (Cash)
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("QRIS")}
                    className={`flex items-center justify-center gap-3 p-5 rounded-2xl border-2 font-bold text-base transition-all cursor-pointer ${
                      paymentMethod === "QRIS"
                        ? "border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 shadow-md"
                        : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    }`}
                  >
                    <QrIcon className="h-6 w-6 text-purple-600" />
                    QRIS Dinamis
                  </button>
                </div>
              </div>

              {/* CASH PAYMENT UI */}
              {paymentMethod === "CASH" && (
                <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <label className="text-base font-bold text-slate-800 dark:text-slate-200 block mb-2">
                    Uang Tunai Diterima (Rp)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={1000}
                    value={cashReceived || ""}
                    onChange={(e) => setCashReceived(Number(e.target.value))}
                    className="text-xl font-black text-slate-900 dark:text-white h-14 bg-white dark:bg-slate-900"
                  />

                  {/* Quick Preset Buttons */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setCashReceived(grandTotal)}
                      className="px-5 py-3 rounded-xl text-sm font-bold bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-500 cursor-pointer"
                    >
                      Uang Pas
                    </button>
                    {[50000, 100000, 150000, 200000, 500000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setCashReceived(amt)}
                        className={`px-5 py-3 rounded-xl text-sm font-bold border-2 transition-all cursor-pointer ${
                          cashReceived === amt
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {formatCurrency(amt)}
                      </button>
                    ))}
                  </div>

                  {/* Change calculation */}
                  <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-800 text-sm">
                    <span className="font-bold text-slate-600 dark:text-slate-400">
                      Uang Kembalian:
                    </span>
                    <span
                      className={`text-lg font-extrabold ${
                        cashReceived < grandTotal
                          ? "text-rose-500"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {cashReceived < grandTotal
                        ? `Kurang ${formatCurrency(grandTotal - cashReceived)}`
                        : formatCurrency(changeAmount)}
                    </span>
                  </div>
                </div>
              )}

              {/* QRIS PAYMENT UI */}
              {paymentMethod === "QRIS" && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center">
                  <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200 mb-2">
                    <div className="w-40 h-40 bg-slate-900 rounded-xl flex items-center justify-center p-2 text-white">
                      {/* Stylized QRIS box */}
                      <div className="w-full h-full border-4 border-dashed border-white/60 flex flex-col items-center justify-center p-2">
                        <QrCode className="h-16 w-16 text-white" />
                        <span className="text-[10px] font-mono tracking-tighter mt-1">
                          QRIS STANDAR BI
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    MISYourPOS (NMID: ID1029384756)
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Silakan arahkan kamera GoPay, OVO, Dana, BCA, atau Livin Mandiri ke kode QR di atas.
                  </p>
                </div>
              )}

              {/* Customer Name & Notes */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Nama Pelanggan (Opsional)
                  </label>
                  <Input
                    type="text"
                    placeholder="Pelanggan Umum"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-12 text-base"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Catatan Transaksi (Opsional)
                  </label>
                  <Input
                    type="text"
                    placeholder="Contoh: Botol dibawa sendiri"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="h-12 text-base"
                  />
                </div>
              </div>

              {/* Submit Checkout Button */}
              <Button
                disabled={
                  isSubmitting ||
                  (paymentMethod === "CASH" && cashReceived < grandTotal)
                }
                onClick={handleProcessCheckout}
                className="w-full h-14 sm:h-16 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-base sm:text-lg shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 sm:gap-3 cursor-pointer mt-3"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-3">
                    <RefreshCw className="h-5 w-5 sm:h-6 sm:w-6 animate-spin" />
                    Menyimpan & Mengurangi Stok...
                  </span>
                ) : (
                  <span className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />
                    <span className="truncate">
                      Selesaikan Pembayaran ({formatCurrency(grandTotal)})
                    </span>
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* RECEIPT MODAL */}
      <ReceiptModal
        isOpen={showReceipt}
        onClose={() => setShowReceipt(false)}
        sale={receiptData}
        storeSettings={storeSettings}
      />

      {/* OPEN CASH SESSION MODAL */}
      <OpenSessionDialog
        isOpen={showOpenSessionModal}
        onSuccess={(session) => {
          setActiveSession(session);
          setShowOpenSessionModal(false);
        }}
      />
    </div>
  );
}
