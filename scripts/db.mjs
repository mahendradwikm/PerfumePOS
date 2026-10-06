/**
 * MISYourPOS — Database Viewer (CLI)
 *
 * Contoh:
 *   npm run db:tables                 daftar tabel + jumlah baris
 *   npm run db:stats                  ringkasan seluruh data
 *   npm run db:view products          lihat isi tabel products
 *   npm run db:view sales --limit 20  batasi jumlah baris
 *   npm run db:sql "SELECT * FROM users"
 *
 * Semua perintah berjalan lokal di terminal, tidak mengubah data
 * (kecuali Anda menjalankan perintah UPDATE/DELETE lewat db:sql).
 */
import { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const TABLE_MAP = {
  users: () => prisma.user.findMany({
    include: { _count: { select: { sales: true, cashSessions: true } } },
    orderBy: { createdAt: "desc" },
  }),
  categories: () => prisma.category.findMany({ orderBy: { name: "asc" } }),
  suppliers: () => prisma.supplier.findMany({ orderBy: { name: "asc" } }),
  products: () => prisma.product.findMany({ include: { category: true }, orderBy: { name: "asc" } }),
  sales: () => prisma.sale.findMany({
    include: { user: { select: { name: true } }, items: true, _count: { select: { refunds: true } } },
    orderBy: { date: "desc" },
  }),
  sale_items: () => prisma.saleItem.findMany({ orderBy: { id: "asc" } }),
  stock_movements: () => prisma.stockMovement.findMany({
    include: { product: { select: { name: true, sku: true, unit: true } }, user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  }),
  cash_sessions: () => prisma.cashSession.findMany({
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  }),
  expenses: () => prisma.expense.findMany({ orderBy: { date: "desc" } }),
  refunds: () => prisma.refund.findMany({
    include: { sale: { select: { transactionNumber: true } }, items: true },
    orderBy: { createdAt: "desc" },
  }),
  refund_items: () => prisma.refundItem.findMany(),
  audit_logs: () => prisma.auditLog.findMany({
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  }),
  store_settings: () => prisma.storeSetting.findMany({ orderBy: { key: "asc" } }),
};

const MODELS = {
  users: "user",
  categories: "category",
  suppliers: "supplier",
  products: "product",
  sales: "sale",
  sale_items: "saleItem",
  stock_movements: "stockMovement",
  cash_sessions: "cashSession",
  expenses: "expense",
  refunds: "refund",
  refund_items: "refundItem",
  audit_logs: "auditLog",
  store_settings: "storeSetting",
};

const money = (v) =>
  typeof v === "object" && v !== null && typeof v.toNumber === "function"
    ? `Rp${Number(v).toLocaleString("id-ID")}`
    : typeof v === "number"
      ? `Rp${v.toLocaleString("id-ID")}`
      : v;

const fmt = (v) => {
  if (v === null || v === undefined) return "-";
  if (v instanceof Date) return v.toLocaleString("id-ID");
  if (typeof v === "object" && typeof v.toNumber === "function") return Number(v).toLocaleString("id-ID");
  if (typeof v === "boolean") return v ? "ya" : "tidak";
  return String(v);
};

function printRows(rows, limit) {
  if (!rows.length) {
    console.log("(tabel kosong)");
    return;
  }
  const sliced = rows.slice(0, limit);
  // Flatten nested objects into readable strings
  const flat = sliced.map((r) => {
    const out = {};
    for (const [k, val] of Object.entries(r)) {
      if (val === null || val === undefined) out[k] = "-";
      else if (val instanceof Date) out[k] = val.toLocaleString("id-ID");
      else if (Array.isArray(val)) out[k] = `[${val.length}]`;
      else if (typeof val === "object" && typeof val.toNumber === "function") {
        // Prisma Decimal
        out[k] = Number(val).toLocaleString("id-ID");
      } else if (typeof val === "object") {
        out[k] = val.name ?? val.transactionNumber ?? val.sku ?? JSON.stringify(val).slice(0, 40);
      } else out[k] = String(val);
    }
    return out;
  });
  console.table(flat);
  if (rows.length > limit) console.log(`... ${rows.length - limit} baris lainnya (gunakan --limit lebih besar)`);
}

async function showTables() {
  const rows = await prisma.$queryRaw`
    SELECT table_name AS "Tabel",
           (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), true, true, '')))[1]::text::int AS "Jumlah Baris"
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name`;
  console.table(rows);
}

async function showStats() {
  const [users, products, sales, saleItems, sessions, expenses, refunds, movements] = await Promise.all([
    prisma.user.count(),
    prisma.product.count(),
    prisma.sale.count(),
    prisma.saleItem.count(),
    prisma.cashSession.count(),
    prisma.expense.count(),
    prisma.refund.count(),
    prisma.stockMovement.count(),
  ]);

  const revenue = await prisma.sale.aggregate({
    where: { status: "COMPLETED" },
    _sum: { grandTotal: true },
    _count: { _all: true },
  });

  const lowStock = await prisma.product.count({
    where: { isActive: true, currentStock: { lte: prisma.product.fields.minimumStock } },
  }).catch(() => prisma.product.count({ where: { isActive: true } }));

  console.log("\n=== RINGKASAN DATABASE MISYourPOS ===");
  console.table([
    { Keterangan: "User terdaftar", Nilai: users },
    { Keterangan: "Produk", Nilai: products },
    { Keterangan: "Total transaksi", Nilai: sales },
    { Keterangan: "Item penjualan", Nilai: saleItems },
    { Keterangan: "Sesi kasir", Nilai: sessions },
    { Keterangan: "Pengeluaran", Nilai: expenses },
    { Keterangan: "Refund", Nilai: refunds },
    { Keterangan: "Pergerakan stok", Nilai: movements },
    { Keterangan: "Total omzet (COMPLETED)", Nilai: money(revenue._sum.grandTotal || 0) },
  ]);
  void lowStock;
}

async function runSql(sql) {
  const isSelect = /^\s*(select|with|show|explain)/i.test(sql);
  if (isSelect) {
    const rows = await prisma.$queryRawUnsafe(sql);
    printRows(rows, 500);
  } else {
    console.warn("\n⚠️  Perintah bukan SELECT — risultnya TIDAK ditampilkan.");
    console.warn("   Jalankan manual di Prisma Studio / DBeaver bila yakin.\n");
    return;
  }
}

async function main() {
  const [, , command, ...rest] = process.argv;

  const limitIdx = rest.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(rest[limitIdx + 1]) || 20 : 20;
  const args =
    limitIdx >= 0
      ? rest.filter((_, i) => i !== limitIdx && i !== limitIdx + 1)
      : rest;

  // Set DB_DEBUG=1 untuk melihat argumen yang diterima ( troubleshoot PowerShell )

  switch (command) {
    case "tables":
      await showTables();
      break;
    case "stats":
      await showStats();
      break;
    case "view": {
      const table = (args[0] || "").toLowerCase();
      if (!TABLE_MAP[table]) {
        console.log(`Tabel tidak dikenal. Pilihan: ${Object.keys(TABLE_MAP).join(", ")}`);
        process.exitCode = 1;
        break;
      }
      const rows = await TABLE_MAP[table]();
      console.log(`\n=== ${table} (menampilkan ${Math.min(limit, rows.length)} dari ${rows.length}) ===\n`);
      printRows(rows, limit);
      break;
    }
    case "sql": {
      const sql = args.join(" ");
      if (!sql) {
        console.log('Contoh: npm run db:sql "SELECT * FROM users LIMIT 5"');
        break;
      }
      await runSql(sql);
      break;
    }
    default:
      console.log(`
MISYourPOS Database Viewer

  npm run db:tables                 Daftar tabel + jumlah baris
  npm run db:stats                  Ringkasan seluruh data
  npm run db:view <tabel>           Lihat isi tabel
  npm run db:view <tabel> --limit 50   Batasi jumlah baris
  npm run db:sql "<query SQL>"      Jalankan query SELECT

Tabel yang tersedia:
  ${Object.keys(TABLE_MAP).join(", ")}

GUI browser (opsional):
  npm run db:studio                 buka Prisma Studio di http://localhost:5555
`);
  }
}

main()
  .catch((e) => {
    console.error("\n❌ Gagal:", e.message);
    if (e.code === "P1001" || /connect ECONNREFUSED/i.test(e.message)) {
      console.error("   Database tidak aktif. Jalankan dulu: npm run db:start\n");
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(`   Kode error: ${e.code}`);
    }
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

export { fmt };