import { getCurrentCashSession, getCashSessions } from "@/lib/actions/cash";
import { getCurrentUser } from "@/lib/auth";
import { CashClient } from "@/components/cash/cash-client";

export const dynamic = "force-dynamic";

export default async function CashPage() {
  const currentUser = await getCurrentUser();
  const [currentSession, historyRes] = await Promise.all([
    getCurrentCashSession(),
    getCashSessions({ limit: 50 }),
  ]);

  return (
    <CashClient
      currentSession={currentSession as any}
      sessionHistory={historyRes.sessions as any}
      currentUser={currentUser}
    />
  );
}
