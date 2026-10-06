import { getRefunds } from "@/lib/actions/refunds";
import { getCurrentUser } from "@/lib/auth";
import { RefundsClient } from "@/components/refunds/refunds-client";

export const dynamic = "force-dynamic";

export default async function RefundsPage({
  searchParams,
}: {
  searchParams: Promise<{ txn?: string }>;
}) {
  const currentUser = await getCurrentUser();
  const isOwnerOrAdmin = currentUser?.role === "OWNER" || currentUser?.role === "ADMIN";
  const sp = await searchParams;

  const refundsRes = await getRefunds({ limit: 50 });

  return (
    <RefundsClient
      initialRefunds={refundsRes.refunds as any}
      isOwnerOrAdmin={isOwnerOrAdmin}
      initialTxn={sp?.txn}
    />
  );
}
