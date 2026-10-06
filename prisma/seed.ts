import { PrismaClient, UserRole, MovementType, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // 1. Store Settings (Key-Value)
  const settings = [
    { key: "store_name", value: "MISYourPOS Parfumerie", label: "Nama Toko", type: "string" },
    { key: "store_address", value: "Jl. Malioboro No. 45, Danurejan, Yogyakarta", label: "Alamat Toko", type: "string" },
    { key: "store_phone", value: "0812-3456-7890", label: "Nomor Telepon Toko", type: "string" },
    { key: "store_email", value: "info@aromaperfume.com", label: "Email Toko", type: "string" },
    { key: "receipt_header", value: "MISYourPOS\nSolusi Wangi Mewah Berkualitas", label: "Header Struk", type: "string" },
    { key: "receipt_footer", value: "Terima kasih atas kunjungan Anda!\nWangi Tahan Hingga 24 Jam.", label: "Footer Struk", type: "string" },
  ];

  for (const s of settings) {
    await prisma.storeSetting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }

  // 2. Users
  const adminPassword = await bcrypt.hash("admin123", 10);
  const cashierPassword = await bcrypt.hash("kasir123", 10);

  const owner = await prisma.user.upsert({
    where: { username: "admin" },
    update: { password: adminPassword },
    create: {
      name: "Hendra Setiawan (Owner)",
      email: "owner@aromaperfume.com",
      username: "admin",
      password: adminPassword,
      role: UserRole.OWNER,
      isActive: true,
      phone: "0812-3456-7891",
    },
  });

  const cashier1 = await prisma.user.upsert({
    where: { username: "kasir1" },
    update: { password: cashierPassword },
    create: {
      name: "Rina Melati (Kasir Pagi)",
      email: "rina@aromaperfume.com",
      username: "kasir1",
      password: cashierPassword,
      role: UserRole.CASHIER,
      isActive: true,
      phone: "0812-3456-7892",
    },
  });

  const cashier2 = await prisma.user.upsert({
    where: { username: "kasir2" },
    update: { password: cashierPassword },
    create: {
      name: "Budi Santoso (Kasir Sore)",
      email: "budi@aromaperfume.com",
      username: "kasir2",
      password: cashierPassword,
      role: UserRole.CASHIER,
      isActive: true,
      phone: "0812-3456-7893",
    },
  });

  // 3. Suppliers
  let sup1 = await prisma.supplier.findFirst({ where: { name: "PT Aroma Essence Megah" } });
  if (!sup1) {
    sup1 = await prisma.supplier.create({
      data: {
        name: "PT Aroma Essence Megah",
        phone: "0811-2233-4455",
        address: "Kawasan Industri Pulo Gadung, Jakarta",
      },
    });
  }

  let sup2 = await prisma.supplier.findFirst({ where: { name: "CV Botol Kaca Nusantara" } });
  if (!sup2) {
    sup2 = await prisma.supplier.create({
      data: {
        name: "CV Botol Kaca Nusantara",
        phone: "0813-9988-7766",
        address: "Surabaya Industrial Estate Rungkut",
      },
    });
  }

  // 4. Categories
  const categoriesData = [
    { name: "Floral & Fresh", description: "Wewangian bunga segar, feminin, dan elegan" },
    { name: "Woody & Warm", description: "Aroma kayu maskulin, hangat, dan berwibawa" },
    { name: "Citrus & Fruity", description: "Aroma segar buah sitrus, ceria, dan menyegarkan" },
    { name: "Oriental & Spicy", description: "Aroma rempah eksotis, sensual, dan mewah" },
    { name: "Gourmand & Sweet", description: "Aroma manis vanila, cokelat, dan karamel" },
    { name: "Botol & Aksesoris", description: "Botol spray kaca premium berbagai ukuran" },
  ];

  const categoryMap = new Map<string, string>();
  for (const cat of categoriesData) {
    const created = await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
    categoryMap.set(cat.name, created.id);
  }

  // 5. Products Catalog
  const products = [
    // Floral & Fresh
    {
      name: "Baccarat Rouge 540 Extract Refill",
      sku: "PRF-BCR-540",
      barcode: "899001001",
      categoryName: "Floral & Fresh",
      unit: "ml",
      costPrice: 1500,
      sellingPrice: 3500,
      stock: 2500,
      minStock: 200,
      description: "Aroma manis mewah amber floral dengan sentuhan saffron dan cedarwood",
    },
    {
      name: "English Pear & Freesia Refill",
      sku: "PRF-JML-002",
      barcode: "899001002",
      categoryName: "Floral & Fresh",
      unit: "ml",
      costPrice: 1200,
      sellingPrice: 3000,
      stock: 1800,
      minStock: 150,
      description: "Kesegaran buah pir matang berpadu bunga freesia putih lembut",
    },
    {
      name: "Miss Dior Blooming Bouquet Refill",
      sku: "PRF-MDR-003",
      barcode: "899001003",
      categoryName: "Floral & Fresh",
      unit: "ml",
      costPrice: 1300,
      sellingPrice: 3000,
      stock: 1200,
      minStock: 100,
      description: "Buket bunga peony lembut dan mawar damask dengan white musk",
    },
    {
      name: "Marc Jacobs Daisy Refill",
      sku: "PRF-MJD-004",
      barcode: "899001004",
      categoryName: "Floral & Fresh",
      unit: "ml",
      costPrice: 1100,
      sellingPrice: 2800,
      stock: 1500,
      minStock: 150,
      description: "Aroma ceria strawberry liar, kelopak violet, dan melati",
    },
    {
      name: "Gucci Bloom Refill",
      sku: "PRF-GCB-005",
      barcode: "899001005",
      categoryName: "Floral & Fresh",
      unit: "ml",
      costPrice: 1300,
      sellingPrice: 3200,
      stock: 90, // Low stock demo!
      minStock: 100,
      description: "Kombinasi harum sedap malam (tuberose) dan melati alami yang intens",
    },

    // Woody & Warm
    {
      name: "Sauvage Dior Eau de Parfum Refill",
      sku: "PRF-SVG-006",
      barcode: "899001006",
      categoryName: "Woody & Warm",
      unit: "ml",
      costPrice: 1400,
      sellingPrice: 3500,
      stock: 3000,
      minStock: 250,
      description: "Aroma segar bergamot Calabria dipadu kayu cedar dan ambroxan maskulin",
    },
    {
      name: "Creed Aventus Refill",
      sku: "PRF-CRD-007",
      barcode: "899001007",
      categoryName: "Woody & Warm",
      unit: "ml",
      costPrice: 1800,
      sellingPrice: 4500,
      stock: 2200,
      minStock: 200,
      description: "Aroma nanas smoky, birch hitam, ambergris khas pria sukses",
    },
    {
      name: "Bleu de Chanel Refill",
      sku: "PRF-BDC-008",
      barcode: "899001008",
      categoryName: "Woody & Warm",
      unit: "ml",
      costPrice: 1500,
      sellingPrice: 3800,
      stock: 1900,
      minStock: 150,
      description: "Aroma woody aromatik dengan kehangatan dupa, amber, dan jahe",
    },
    {
      name: "Santal 33 Le Labo Refill",
      sku: "PRF-SNT-009",
      barcode: "899001009",
      categoryName: "Woody & Warm",
      unit: "ml",
      costPrice: 1700,
      sellingPrice: 4000,
      stock: 80, // Low stock demo
      minStock: 150,
      description: "Aroma khas sandalwood, kapulaga, iris, dan leather hangat",
    },
    {
      name: "Terre d'Hermes Refill",
      sku: "PRF-TDH-010",
      barcode: "899001010",
      categoryName: "Woody & Warm",
      unit: "ml",
      costPrice: 1300,
      sellingPrice: 3200,
      stock: 1400,
      minStock: 100,
      description: "Harmoni jeruk grapefruit, batu api (flint), dan vetiver membumi",
    },

    // Citrus & Fruity
    {
      name: "D&G Light Blue Refill",
      sku: "PRF-DGL-011",
      barcode: "899001011",
      categoryName: "Citrus & Fruity",
      unit: "ml",
      costPrice: 1100,
      sellingPrice: 2800,
      stock: 2100,
      minStock: 150,
      description: "Sensasi segar apel hijau Sisilia, bambu, dan lemon Mediterania",
    },
    {
      name: "Jo Malone Lime Basil & Mandarin Refill",
      sku: "PRF-JML-012",
      barcode: "899001012",
      categoryName: "Citrus & Fruity",
      unit: "ml",
      costPrice: 1250,
      sellingPrice: 3000,
      stock: 1600,
      minStock: 120,
      description: "Aroma jeruk mandarin segar berpadu daun basil pedas herbal",
    },
    {
      name: "Acqua di Gio Giorgio Armani Refill",
      sku: "PRF-ADG-013",
      barcode: "899001013",
      categoryName: "Citrus & Fruity",
      unit: "ml",
      costPrice: 1350,
      sellingPrice: 3200,
      stock: 2600,
      minStock: 200,
      description: "Aroma laut segar hembusan angin pantai dipadu aroma sitrus aquatic",
    },

    // Oriental & Spicy
    {
      name: "Tom Ford Tobacco Vanille Refill",
      sku: "PRF-TFT-014",
      barcode: "899001014",
      categoryName: "Oriental & Spicy",
      unit: "ml",
      costPrice: 1900,
      sellingPrice: 4800,
      stock: 1300,
      minStock: 100,
      description: "Aroma mewah daun tembakau kaya rempah vanila dan tonka bean",
    },
    {
      name: "YSL Black Opium Refill",
      sku: "PRF-YSL-015",
      barcode: "899001015",
      categoryName: "Oriental & Spicy",
      unit: "ml",
      costPrice: 1400,
      sellingPrice: 3500,
      stock: 2400,
      minStock: 180,
      description: "Kombinasi kopi hitam adiktif dan bunga putih feminin serta vanila hangat",
    },
    {
      name: "Maison Margiela By the Fireplace Refill",
      sku: "PRF-MMF-016",
      barcode: "899001016",
      categoryName: "Oriental & Spicy",
      unit: "ml",
      costPrice: 1600,
      sellingPrice: 3900,
      stock: 1100,
      minStock: 100,
      description: "Aroma hangat kacang kastanye panggang, cengkeh, dan vanila berasap",
    },

    // Gourmand & Sweet
    {
      name: "Vanilla Lace Secret Refill",
      sku: "PRF-VLS-017",
      barcode: "899001017",
      categoryName: "Gourmand & Sweet",
      unit: "ml",
      costPrice: 900,
      sellingPrice: 2500,
      stock: 3500,
      minStock: 200,
      description: "Aroma manis murni vanila lembut menggoda yang disukai semua kalangan",
    },
    {
      name: "Ariana Grande Cloud Refill",
      sku: "PRF-AGC-018",
      barcode: "899001018",
      categoryName: "Gourmand & Sweet",
      unit: "ml",
      costPrice: 1150,
      sellingPrice: 2900,
      stock: 2800,
      minStock: 150,
      description: "Aroma manis kelapa, whipped cream, praline, dan lavender menenangkan",
    },
    {
      name: "Prada Candy Refill",
      sku: "PRF-PRC-019",
      barcode: "899001019",
      categoryName: "Gourmand & Sweet",
      unit: "ml",
      costPrice: 1300,
      sellingPrice: 3200,
      stock: 45, // Critical low stock demo
      minStock: 100,
      description: "Kombinasi karamel manis menggoda dan white musk berkelas",
    },

    // Botol & Aksesoris
    {
      name: "Botol Spray Kaca Silver 30ml",
      sku: "BTL-SLV-030",
      barcode: "899002030",
      categoryName: "Botol & Aksesoris",
      unit: "pcs",
      costPrice: 5000,
      sellingPrice: 15000,
      stock: 150,
      minStock: 20,
      description: "Botol spray kaca bening tutup silver kapasitas 30ml",
    },
    {
      name: "Botol Spray Kaca Gold 50ml",
      sku: "BTL-GLD-050",
      barcode: "899002050",
      categoryName: "Botol & Aksesoris",
      unit: "pcs",
      costPrice: 7500,
      sellingPrice: 20000,
      stock: 120,
      minStock: 20,
      description: "Botol spray kaca premium tutup emas kapasitas 50ml",
    },
    {
      name: "Botol Spray Kaca Hitam Matte 100ml",
      sku: "BTL-BLK-100",
      barcode: "899002100",
      categoryName: "Botol & Aksesoris",
      unit: "pcs",
      costPrice: 11000,
      sellingPrice: 30000,
      stock: 80,
      minStock: 15,
      description: "Botol spray mewah hitam matte elegan kapasitas 100ml",
    },
  ];

  for (const p of products) {
    const categoryId = categoryMap.get(p.categoryName);
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {
        costPrice: new Prisma.Decimal(p.costPrice),
        sellingPrice: new Prisma.Decimal(p.sellingPrice),
        currentStock: new Prisma.Decimal(p.stock),
        minimumStock: new Prisma.Decimal(p.minStock),
      },
      create: {
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        categoryId: categoryId,
        unit: p.unit,
        costPrice: new Prisma.Decimal(p.costPrice),
        sellingPrice: new Prisma.Decimal(p.sellingPrice),
        currentStock: new Prisma.Decimal(p.stock),
        minimumStock: new Prisma.Decimal(p.minStock),
        description: p.description,
        isActive: true,
      },
    });

    // Check if initial stock movement already exists
    const existingMovement = await prisma.stockMovement.findFirst({
      where: { productId: product.id, movementType: MovementType.INITIAL_STOCK },
    });

    if (!existingMovement) {
      await prisma.stockMovement.create({
        data: {
          productId: product.id,
          movementType: MovementType.INITIAL_STOCK,
          quantity: new Prisma.Decimal(p.stock),
          previousStock: new Prisma.Decimal(0),
          newStock: new Prisma.Decimal(p.stock),
          notes: "Saldo stok awal sistem",
          userId: owner.id,
        },
      });
    }
  }

  console.log("✓ Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
