"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Sparkles, Lock, User, ArrowRight, ShieldCheck, ShoppingBag } from "lucide-react";
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
        setError(res.error || "Gagal masuk. Periksa username dan password.");
      } else {
        router.push("/pos");
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message || "Terjadi kesalahan saat masuk.");
    } finally {
      setLoading(false);
    }
  }

  function handleQuickLogin(u: string, p: string) {
    setUsername(u);
    setPassword(p);
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white flex-col justify-center items-center p-4 selection:bg-indigo-500 selection:text-white">
      {/* Decorative ambient blur glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Brand Card Header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-white shadow-xl shadow-indigo-500/30 ring-4 ring-indigo-400/20 mb-4">
            <Sparkles className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            Aroma Luxury Refill
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Sistem Kasir & Manajemen Stok Parfum Refill
          </p>
        </div>

        {/* Login Box */}
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl">
          <h2 className="text-lg font-semibold text-white mb-2">Masuk ke Sistem</h2>
          <p className="text-xs text-slate-400 mb-6">
            Silakan masukkan kredensial akun kasir atau pemilik Anda.
          </p>

          {error && (
            <div className="mb-5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <Input
                  type="text"
                  placeholder="admin atau kasir1"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10 bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-indigo-500 focus-visible:border-indigo-500"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-indigo-500 focus-visible:border-indigo-500"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 shadow-lg shadow-indigo-600/30 mt-2"
            >
              {loading ? (
                "Memproses..."
              ) : (
                <span className="flex items-center gap-2">
                  Masuk Sekarang <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          {/* Quick Demo Login Credentials */}
          <div className="mt-8 pt-6 border-t border-slate-800">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Akses Cepat (Quick Demo Fill)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin("admin", "admin123")}
                className="flex flex-col items-start p-2.5 rounded-xl border border-slate-800 bg-slate-950/50 hover:bg-indigo-950/40 hover:border-indigo-500/40 transition-all text-left cursor-pointer group"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 group-hover:text-indigo-300">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Owner / Admin
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  admin • admin123
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin("kasir1", "kasir123")}
                className="flex flex-col items-start p-2.5 rounded-xl border border-slate-800 bg-slate-950/50 hover:bg-emerald-950/40 hover:border-emerald-500/40 transition-all text-left cursor-pointer group"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 group-hover:text-emerald-300">
                  <ShoppingBag className="h-3.5 w-3.5" />
                  Kasir Shift
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  kasir1 • kasir123
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-500 mt-6">
          AromaPOS &copy; 2026 • Sistem Retail Parfum Terintegrasi
        </p>
      </div>
    </div>
  );
}
