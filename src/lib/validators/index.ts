import { z } from "zod";

// ============================================================
// AUTH VALIDATORS
// ============================================================

export const loginSchema = z.object({
  username: z.string().min(1, "Username wajib diisi"),
  password: z.string().min(1, "Password wajib diisi"),
});

export const createUserSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi").max(100),
  email: z.string().email("Email tidak valid"),
  username: z.string().min(3, "Username minimal 3 karakter").max(50),
  password: z.string().min(6, "Password minimal 6 karakter"),
  role: z.enum(["OWNER", "ADMIN", "CASHIER"]),
  phone: z.string().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi").max(100).optional(),
  email: z.string().email("Email tidak valid").optional(),
  password: z.string().min(6, "Password minimal 6 karakter").optional(),
  role: z.enum(["OWNER", "ADMIN", "CASHIER"]).optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
});

// ============================================================
// PRODUCT VALIDATORS
// ============================================================

export const createProductSchema = z.object({
  sku: z.string().min(1, "SKU wajib diisi"),
  barcode: z.string().optional().nullable(),
  name: z.string().min(1, "Nama produk wajib diisi"),
  fragranceName: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  unit: z.string().min(1, "Unit wajib diisi").default("ml"),
  costPrice: z.number().min(0, "HPP tidak boleh negatif"),
  sellingPrice: z.number().min(0, "Harga jual tidak boleh negatif"),
  initialStock: z.number().min(0, "Stok awal tidak boleh negatif").default(0),
  minimumStock: z.number().min(0, "Stok minimum tidak boleh negatif").default(0),
  image: z.string().optional().nullable(),
  rackLocation: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const updateProductSchema = createProductSchema.partial().omit({ initialStock: true });

// ============================================================
// CATEGORY VALIDATORS
// ============================================================

export const categorySchema = z.object({
  name: z.string().min(1, "Nama kategori wajib diisi"),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

// ============================================================
// SUPPLIER VALIDATORS
// ============================================================

export const supplierSchema = z.object({
  name: z.string().min(1, "Nama supplier wajib diisi"),
  phone: z.string().optional().nullable(),
  email: z.string().email("Email tidak valid").optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

// ============================================================
// INVENTORY VALIDATORS
// ============================================================

export const restockSchema = z.object({
  productId: z.string().min(1, "Produk wajib dipilih"),
  quantity: z.number().positive("Jumlah harus lebih dari 0"),
  supplierId: z.string().optional().nullable(),
  referenceNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const stockAdjustmentSchema = z.object({
  productId: z.string().min(1, "Produk wajib dipilih"),
  movementType: z.enum([
    "ADJUSTMENT_IN",
    "ADJUSTMENT_OUT",
    "DAMAGE",
    "LOST",
    "RETURN_TO_SUPPLIER",
    "CORRECTION",
  ]),
  quantity: z.number().positive("Jumlah harus lebih dari 0"),
  reason: z.string().min(1, "Alasan wajib diisi"),
  notes: z.string().optional().nullable(),
});

// ============================================================
// SALE VALIDATORS
// ============================================================

export const saleItemSchema = z.object({
  productId: z.string().min(1, "Produk wajib dipilih"),
  quantity: z.number().positive("Jumlah harus lebih dari 0"),
  unitPrice: z.number().min(0),
  costPrice: z.number().min(0),
  discount: z.number().min(0).default(0),
  productName: z.string(),
  productSku: z.string(),
  unit: z.string().default("ml"),
});

export const createSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1, "Minimal 1 item"),
  paymentMethod: z.enum(["CASH", "QRIS"]),
  cashReceived: z.number().optional(),
  discountAmount: z.number().min(0).default(0),
  discountPercent: z.number().min(0).max(100).optional().default(0),
  notes: z.string().optional().nullable(),
  cashSessionId: z.string().optional().nullable(),
  customerName: z.string().optional().nullable(),
});

// ============================================================
// CASH SESSION VALIDATORS
// ============================================================

export const openCashSessionSchema = z.object({
  openingCash: z.number().min(0, "Uang kembalian tidak boleh negatif"),
  notes: z.string().optional().nullable(),
});

export const closeCashSessionSchema = z.object({
  sessionId: z.string().min(1),
  closingCash: z.number().min(0, "Uang tunai aktual tidak boleh negatif"),
  notes: z.string().optional().nullable(),
});

// ============================================================
// EXPENSE VALIDATORS
// ============================================================

export const expenseSchema = z.object({
  date: z.string().or(z.date()),
  category: z.string().min(1, "Kategori wajib diisi"),
  description: z.string().min(1, "Deskripsi wajib diisi"),
  amount: z.number().positive("Jumlah harus lebih dari 0"),
  paymentMethod: z.enum(["CASH", "QRIS", "OTHER"]),
  notes: z.string().optional().nullable(),
  cashSessionId: z.string().optional().nullable(),
});

// ============================================================
// REFUND VALIDATORS
// ============================================================

export const refundItemSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  quantity: z.number().positive("Jumlah harus lebih dari 0"),
  unitPrice: z.number().min(0),
  restoreStock: z.boolean().default(true),
});

export const createRefundSchema = z.object({
  saleId: z.string().min(1, "Transaksi asal wajib dipilih"),
  items: z.array(refundItemSchema).min(1, "Minimal 1 item refund"),
  reason: z.string().min(1, "Alasan refund wajib diisi"),
});

// ============================================================
// STORE SETTING VALIDATORS
// ============================================================

export const storeSettingSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  label: z.string().optional(),
  type: z.string().default("string"),
});

// ============================================================
// FILTER / QUERY VALIDATORS
// ============================================================

export const dateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

// ============================================================
// CSV IMPORT VALIDATOR
// ============================================================

export const csvProductRowSchema = z.object({
  sku: z.string().min(1, "SKU wajib diisi"),
  barcode: z.string().optional(),
  name: z.string().min(1, "Nama produk wajib diisi"),
  fragranceName: z.string().optional(),
  category: z.string().optional(),
  unit: z.string().default("ml"),
  costPrice: z.number().min(0, "HPP tidak boleh negatif"),
  sellingPrice: z.number().min(0, "Harga jual tidak boleh negatif"),
  initialStock: z.number().min(0).default(0),
  minimumStock: z.number().min(0).default(0),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type SupplierInput = z.infer<typeof supplierSchema>;
export type RestockInput = z.infer<typeof restockSchema>;
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
export type SaleItemInput = z.infer<typeof saleItemSchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type OpenCashSessionInput = z.infer<typeof openCashSessionSchema>;
export type CloseCashSessionInput = z.infer<typeof closeCashSessionSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type RefundItemInput = z.infer<typeof refundItemSchema>;
export type CreateRefundInput = z.infer<typeof createRefundSchema>;
export type CsvProductRow = z.infer<typeof csvProductRowSchema>;
