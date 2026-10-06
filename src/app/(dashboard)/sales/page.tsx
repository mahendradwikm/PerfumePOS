import { getSales } from "@/lib/actions/sales";
import { getCurrentUser } from "@/lib/auth";
import { SalesClient } from "@/components/sales/sales-client";

export const dynamic = "force-dynamic";

type Period = "day" | "week" | "month" | "custom";

function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDateRange(period: Period, customDate?: string) {
  const now = new Date();
  if (period === "custom" && customDate && /^\d{4}-\d{2}-\d{2}$/.test(customDate)) {
    const start = new Date(customDate + "T00:00:00");
    start.setHours(0, 0, 0, 0);
    return { startDate: customDate, endDate: customDate };
  }
  if (period === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { startDate: fmt(start), endDate: fmt(now) };
  }
  if (period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: fmt(start), endDate: fmt(now) };
  }
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return { startDate: fmt(start), endDate: fmt(now) };
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; date?: string }>;
}) {
  const currentUser = await getCurrentUser();
  const sp = await searchParams;

  const period: Period =
    sp?.period === "week"
      ? "week"
      : sp?.period === "month"
        ? "month"
        : sp?.period === "custom"
          ? "custom"
          : "day";

  const { startDate, endDate } = getDateRange(period, sp?.date);

  const salesRes = await getSales({ startDate, endDate, limit: 200, page: 1 });

  return (
    <SalesClient
      initialSales={salesRes.sales as any}
      total={salesRes.total}
      period={period}
      customDate={sp?.date}
      isOwnerOrAdmin={currentUser?.role === "OWNER" || currentUser?.role === "ADMIN"}
    />
  );
}