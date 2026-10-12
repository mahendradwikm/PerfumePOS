"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X, ShieldCheck, Ban, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createUser, updateUser, toggleUserActive, deleteUser } from "@/lib/actions/users";

interface UserItem {
  id: string;
  name: string;
  email: string;
  username: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  createdAt: string | Date;
}

export function UsersClient({ initialUsers }: { initialUsers: UserItem[] }) {
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [prevUsers, setPrevUsers] = useState(initialUsers);
  if (prevUsers !== initialUsers) {
    setPrevUsers(initialUsers);
    setUsers(initialUsers);
  }

  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    username: "",
    password: "",
    phone: "",
    role: "CASHIER" as "ADMIN" | "CASHIER",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    username: "",
    phone: "",
    role: "CASHIER" as "OWNER" | "ADMIN" | "CASHIER",
    password: "",
  });
  const [editError, setEditError] = useState("");
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const res = await createUser({
        name: form.name,
        email: form.email,
        username: form.username,
        password: form.password,
        role: form.role,
        phone: form.phone || undefined,
      });
      if (!res.success) {
        setError(res.error || "Gagal membuat user.");
        return;
      }
      setIsModalOpen(false);
      setForm({ name: "", email: "", username: "", password: "", phone: "", role: "CASHIER" });
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Terjadi kesalahan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (u: UserItem) => {
    const res = await toggleUserActive(u.id, !u.isActive);
    if (!res.success) {
      alert(res.error || "Gagal mengubah status user.");
      return;
    }
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isActive: !u.isActive } : x)));
    router.refresh();
  };

  const handleDelete = async (u: UserItem) => {
    if (!confirm(`Hapus user "${u.name}" (${u.username})? Tindakan ini tidak dapat dibatalkan.`)) return;
    const res = await deleteUser(u.id);
    if (!res.success) {
      alert(res.error || "Gagal menghapus user.");
      return;
    }
    setUsers((prev) => prev.filter((x) => x.id !== u.id));
    router.refresh();
  };

  const openEdit = (u: UserItem) => {
    setEditingUser(u);
    setEditForm({
      name: u.name,
      email: u.email,
      username: u.username,
      phone: u.phone || "",
      role: u.role as "OWNER" | "ADMIN" | "CASHIER",
      password: "",
    });
    setEditError("");
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditError("");
    setIsEditSubmitting(true);
    try {
      const res = await updateUser(editingUser.id, {
        name: editForm.name,
        email: editForm.email,
        username: editForm.username,
        phone: editForm.phone || undefined,
        role: editForm.role,
        password: editForm.password || undefined,
      });
      if (!res.success) {
        setEditError(res.error || "Gagal mengupdate user.");
        return;
      }
      setIsEditModalOpen(false);
      setEditingUser(null);
      router.refresh();
    } catch (err: any) {
      setEditError(err?.message || "Terjadi kesalahan.");
    } finally {
      setIsEditSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Manajemen User
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Buat akun kasir baru dan kelola status aktifnya.
          </p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="rounded-xl flex items-center gap-2 text-xs font-semibold cursor-pointer"
        >
          <UserPlus className="h-4 w-4" />
          Tambah User Kasir
        </Button>
      </div>

      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400">
              <th className="text-left p-4">Nama</th>
              <th className="text-left p-4">Username</th>
              <th className="text-left p-4">Email</th>
              <th className="text-left p-4">Role</th>
              <th className="text-left p-4">Status</th>
              <th className="text-right p-4">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">{u.name}</td>
                <td className="p-4 font-mono text-slate-500">{u.username}</td>
                <td className="p-4 text-slate-500">{u.email}</td>
                <td className="p-4">
                  <Badge variant={u.role === "CASHIER" ? "default" : "secondary"}>
                    {u.role === "CASHIER" ? "Kasir" : u.role === "ADMIN" ? "Admin" : "Owner"}
                  </Badge>
                </td>
                <td className="p-4">
                  {u.isActive ? (
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Aktif
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-rose-500">
                      <Ban className="h-3.5 w-3.5" /> Nonaktif
                    </span>
                  )}
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(u)}
                      className="rounded-lg text-xs cursor-pointer"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggle(u)}
                      className="rounded-lg text-xs cursor-pointer"
                    >
                      {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(u)}
                      className="rounded-lg text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                    >
                      Hapus
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isEditModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 relative">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              Edit User
            </h2>
            <p className="text-xs text-slate-500 mb-5">
              Perbarui data user. Kosongkan password jika tidak ingin mengubahnya.
            </p>

            <form onSubmit={handleEditSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-500">Nama Lengkap</label>
                <Input
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Username</label>
                <Input
                  required
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Email</label>
                <Input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">No. HP</label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Password Baru (opsional)</label>
                <Input
                  type="password"
                  minLength={6}
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as "OWNER" | "ADMIN" | "CASHIER" })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                >
                  <option value="CASHIER">Kasir</option>
                  <option value="ADMIN">Admin</option>
                  <option value="OWNER">Owner</option>
                </select>
              </div>

              {editError && <p className="text-xs text-rose-500">{editError}</p>}

              <Button type="submit" disabled={isEditSubmitting} className="w-full rounded-xl cursor-pointer">
                {isEditSubmitting ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </form>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              Buat Akun Baru
            </h2>
            <p className="text-xs text-slate-500 mb-5">
              Akun kasir bisa login ke halaman POS dan mengelola sesi kasir.
            </p>

            <form onSubmit={handleCreate} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-500">Nama Lengkap</label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Username</label>
                <Input
                  required
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Email</label>
                <Input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">No. HP (opsional)</label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Password</label>
                <Input
                  type="password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as "ADMIN" | "CASHIER" })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                >
                  <option value="CASHIER">Kasir</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              {error && <p className="text-xs text-rose-500">{error}</p>}

              <Button type="submit" disabled={isSubmitting} className="w-full rounded-xl cursor-pointer">
                {isSubmitting ? "Menyimpan..." : "Buat Akun"}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
