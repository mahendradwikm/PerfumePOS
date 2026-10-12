// ============================================================
// STOCK STATUS
// ============================================================

export function getStockStatus(
  currentStock: number,
  minimumStock: number
): { label: string; color: string; variant: "destructive" | "warning" | "success" } {
  // Colours come from the shared semantic ramps in globals.css, with an
  // explicit dark step so the status stays readable on a dark card. The label
  // text is always present, so meaning never depends on colour alone.
  if (currentStock <= 0) {
    return {
      label: "Habis",
      color: "text-rose-500 dark:text-rose-400",
      variant: "destructive",
    };
  }
  if (currentStock <= minimumStock) {
    return {
      label: "Stok Rendah",
      color: "text-amber-500 dark:text-amber-400",
      variant: "warning",
    };
  }
  return {
    label: "Tersedia",
    color: "text-emerald-500 dark:text-emerald-400",
    variant: "success",
  };
}