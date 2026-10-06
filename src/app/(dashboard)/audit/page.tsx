import { requireRole } from "@/lib/auth";
import { AuditClient } from "@/components/audit/audit-client";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requireRole("OWNER", "ADMIN");

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { name: true, username: true, role: true } },
    },
  });

  return <AuditClient logs={logs as any} />;
}
