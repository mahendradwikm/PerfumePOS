import { getUsers } from "@/lib/actions/users";
import { requireRole } from "@/lib/auth";
import { UsersClient } from "@/components/users/users-client";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  await requireRole("OWNER", "ADMIN");
  const users = await getUsers();

  return <UsersClient initialUsers={users as any} />;
}
