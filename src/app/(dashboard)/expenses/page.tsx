import { getExpenses } from "@/lib/actions/expenses";
import { getActiveCashSession } from "@/lib/actions/cash";
import { getCurrentUser } from "@/lib/auth";
import { ExpensesClient } from "@/components/expenses/expenses-client";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const currentUser = await getCurrentUser();
  const isOwnerOrAdmin = currentUser?.role === "OWNER" || currentUser?.role === "ADMIN";

  const [expensesRes, activeSession] = await Promise.all([
    getExpenses({ limit: 100 }),
    getActiveCashSession(),
  ]);

  return (
    <ExpensesClient
      initialExpenses={expensesRes.expenses as any}
      activeCashSession={activeSession}
      isOwnerOrAdmin={isOwnerOrAdmin}
    />
  );
}
