"use client";

import { useState, useEffect } from "react";
import { Menu, Wallet, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { getActiveCashSession } from "@/lib/actions/cash";
import { CASH_SESSION_CHANGED_EVENT } from "@/lib/cash-session-events";
import { formatCurrency } from "@/lib/format";
import { ThemeToggle } from "@/components/layout/theme-toggle";

interface HeaderProps {
  onToggleSidebar?: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const { data: session } = useSession();
  const [time, setTime] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("");
  const [activeSession, setActiveSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Digital clock + date
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
      setDateStr(
        now.toLocaleDateString("id-ID", {
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Check active cash session.
  // This chip reads the session on the client, so `router.refresh()` does not
  // reach it. Re-read on mount, whenever the cash page reports a change (so the
  // chip flips the moment a session is opened/closed), and poll as a fallback
  // to catch changes made in another tab or by another user.
  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const res = await getActiveCashSession();
        if (!cancelled) setActiveSession(res);
      } catch (e) {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    checkSession();

    const interval = setInterval(checkSession, 30000);
    const onSessionChanged = () => {
      setLoading(false);
      checkSession();
    };
    window.addEventListener(CASH_SESSION_CHANGED_EVENT, onSessionChanged);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener(CASH_SESSION_CHANGED_EVENT, onSessionChanged);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-3 sm:px-4 md:px-8 backdrop-blur-md">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="rounded-lg p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden cursor-pointer shrink-0"
          aria-label="Buka Menu"
        >
          <Menu className="h-6 w-6" />
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/60 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-slate-200 dark:border-slate-700 shrink-0">
          <Clock className="h-4 w-4 text-indigo-500 shrink-0" />
          <span>{time || "Loading..."}</span>
        </div>

        <div className="hidden lg:flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 bg-indigo-50 dark:bg-indigo-950/40 px-4 py-2 rounded-full border border-indigo-200 dark:border-indigo-800/60 truncate">
          <span className="truncate">{dateStr}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <ThemeToggle />

        {/* Cash Session Status Chip */}
        {!loading && (
          <Link
            href="/cash"
            className="flex items-center gap-2 rounded-full text-xs sm:text-sm font-bold transition-all hover:scale-105"
          >
            {activeSession ? (
              <span className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-xs">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 animate-pulse shrink-0" />
                <span className="whitespace-nowrap">Kasir Buka</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-black hidden lg:inline whitespace-nowrap">
                  • Modal {formatCurrency(Number(activeSession.openingCash))}
                </span>
              </span>
            ) : (
              <span className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-xs">
                <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                <span className="whitespace-nowrap">Kasir Tutup</span>
              </span>
            )}
          </Link>
        )}

        {/* User indicator */}
        <div className="flex items-center gap-2 pl-1 sm:pl-2">
          <div className="h-8 w-8 shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs border border-indigo-200 dark:border-indigo-800">
            {session?.user?.name?.[0] || "U"}
          </div>
          <div className="hidden xl:block text-left text-xs max-w-[130px]">
            <p className="font-semibold text-slate-800 dark:text-slate-200 leading-tight truncate">
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
