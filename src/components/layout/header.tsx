"use client";

import { useState, useEffect } from "react";
import { Menu, Wallet, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { getActiveCashSession } from "@/lib/actions/cash";
import { formatCurrency } from "@/lib/utils";

interface HeaderProps {
  onToggleSidebar?: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const { data: session } = useSession();
  const [time, setTime] = useState<string>("");
  const [activeSession, setActiveSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Digital clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }) + " WIB"
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Check active cash session
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await getActiveCashSession();
        setActiveSession(res);
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    checkSession();
    // Poll every 30 seconds
    const interval = setInterval(checkSession, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-4 md:px-8 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="rounded-lg p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden cursor-pointer"
          aria-label="Buka Menu"
        >
          <Menu className="h-6 w-6" />
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
          <Clock className="h-3.5 w-3.5 text-indigo-500" />
          <span>{time || "Loading..."}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Cash Session Status Chip */}
        {!loading && (
          <Link
            href="/cash"
            className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-all hover:scale-105"
          >
            {activeSession ? (
              <span className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 px-3 py-1 rounded-full shadow-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
                <span>Kasir Buka</span>
                <span className="text-emerald-500 font-bold hidden md:inline">
                  • Modal {formatCurrency(Number(activeSession.openingCash))}
                </span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 px-3 py-1 rounded-full shadow-xs">
                <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                <span>Kasir Tutup (Buka Sesi)</span>
              </span>
            )}
          </Link>
        )}

        {/* User indicator */}
        <div className="flex items-center gap-2 pl-2">
          <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs border border-indigo-200 dark:border-indigo-800">
            {session?.user?.name?.[0] || "U"}
          </div>
          <div className="hidden md:block text-left text-xs">
            <p className="font-semibold text-slate-800 dark:text-slate-200 leading-tight">
              {session?.user?.name || "Kasir"}
            </p>
            <p className="text-[10px] text-slate-400 capitalize">
              {session?.user?.role?.toLowerCase() || "staff"}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
