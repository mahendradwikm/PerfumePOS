"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Lock, User, ArrowRight, ShieldCheck, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Username atau password salah. Silakan coba lagi.");
        setLoading(false);
      } else if (res?.ok) {
        window.location.href = "/pos";
      } else {
        setError("Gagal terhubung ke server autentikasi.");
        setLoading(false);
      }
    } catch (err: any) {
      setError(err?.message || "Terjadi kesalahan saat masuk.");
      setLoading(false);
    }
  }

  function handleQuickLogin(u: string, p: string) {
    setUsername(u);
    setPassword(p);
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50 text-slate-800 flex-col justify-center items-center p-4 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 dark:text-slate-100">
      {/* Decorative ambient blur glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-300/25 rounded-full blur-3xl pointer-events-none dark:bg-indigo-600/15" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-indigo-200/25 rounded-full blur-3xl pointer-events-none dark:bg-indigo-800/15" />

      <div className="relative w-full max-w-md">
        {/* Brand Card Header */}
        <div className="text-center mb-8">
          <img
            src="/logo.svg"
            alt="MISYourPOS Logo"
            className="h-16 w-16 rounded-full object-cover shadow-xl shadow-indigo-600/15 ring-4 ring-indigo-500/15 mb-4 dark:shadow-indigo-500/20 dark:ring-indigo-400/20"
          />
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white">
            MISYourPOS
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-300 mt-1">
            Sistem Kasir &amp; Manajemen Stok Parfum Refill
          </p>
        </div>

        {/* Login Box */}
        <div className="rounded-3xl border-2 border-slate-200 bg-white/80 p-8 shadow-xl shadow-slate-300/40 backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/70 dark:shadow-2xl">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
            Masuk ke Sistem
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
            Silakan masukkan kredensial akun kasir atau pemilik Anda.
          </p>

          {error && (
            <div className="mb-5 rounded-xl border-2 border-rose-300 bg-rose-50 p-4 text-sm text-rose-700 font-semibold dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-base font-bold text-slate-700 dark:text-slate-200">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="admin atau kasir1"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-12 bg-white dark:bg-slate-800/70 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400 focus-visible:ring-indigo-500 focus-visible:border-indigo-500 dark:focus-visible:ring-indigo-500/40 dark:focus-visible:border-indigo-400"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-base font-bold text-slate-700 dark:text-slate-200">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-12 bg-white dark:bg-slate-800/70 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400 focus-visible:ring-indigo-500 focus-visible:border-indigo-500 dark:focus-visible:ring-indigo-500/40 dark:focus-visible:border-indigo-400"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-14 rounded-2xl text-lg font-bold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-lg shadow-indigo-600/20 mt-3"
            >
              {loading ? (
                "Memproses..."
              ) : (
                <span className="flex items-center gap-2">
                  Masuk Sekarang <ArrowRight className="h-5 w-5" />
                </span>
              )}
            </Button>
          </form>

          {/* Quick Demo Login Credentials */}
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
              Akses Cepat (Isi Otomatis)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleQuickLogin("admin", "admin123")}
                className="flex flex-col items-start p-4 rounded-2xl border-2 border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 transition-all text-left cursor-pointer group dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-indigo-500/10 dark:hover:border-indigo-500/50"
              >
                <div className="flex items-center gap-2 text-sm font-bold text-indigo-700 group-hover:text-indigo-800 dark:text-indigo-300 dark:group-hover:text-indigo-200">
                  <ShieldCheck className="h-5 w-5" />
                  Owner / Admin
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  admin • admin123
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin("kasir1", "kasir123")}
                className="flex flex-col items-start p-4 rounded-2xl border-2 border-slate-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 transition-all text-left cursor-pointer group dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-emerald-500/10 dark:hover:border-emerald-500/50"
              >
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 group-hover:text-emerald-800 dark:text-emerald-300 dark:group-hover:text-emerald-200">
                  <ShoppingBag className="h-5 w-5" />
                  Kasir Shift
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  kasir1 • kasir123
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-500 mt-6">
          MISYourPOS &copy; 2026 • Sistem Retail Parfum Terintegrasi
        </p>
      </div>
    </div>
  );
}
