// ============================================================
// STOCK STATUS
// ============================================================

export function getStockStatus(
  currentStock: number,
  minimumStock: number
): { label: string; color: string; variant: "destructive" | "warning" | "success" } {
  if (currentStock <= 0) {
    return { label: "Habis", color: "text-red-500", variant: "destructive" };
  }
  if (currentStock <= minimumStock) {
    return { label: "Stok Rendah", color: "text-yellow-500", variant: "warning" };
  }
  return { label: "Tersedia", color: "text-green-500", variant: "success" };
}