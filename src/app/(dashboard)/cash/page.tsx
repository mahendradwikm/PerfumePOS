import { getCurrentCashSession, getCashSessions } from "@/lib/actions/cash";
import { getCurrentUser } from "@/lib/auth";
import { CashClient } from "@/components/cash/cash-client";

export const dynamic = "force-dynamic";

export default async function CashPage() {
  const currentUser = await getCurrentUser();
  const [currentSession, historyRes] = await Promise.all([
    getCurrentCashSession(),
    // Only closed sessions belong to the history table — the open session is
    // already rendered separately above it, so listing it twice created
    // duplicate rows (and duplicate React keys).
    getCashSessions({ limit: 50, status: "CLOSED" }),
  ]);

  return (
    <CashClient
      currentSession={currentSession as any}
      sessionHistory={historyRes.sessions as any}
      currentUser={currentUser}
    />
  );
}
