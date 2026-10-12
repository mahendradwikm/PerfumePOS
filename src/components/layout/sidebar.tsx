"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShoppingCart,
  Receipt,
  Package,
  Boxes,
  Wallet,
  DollarSign,
  RotateCcw,
  BarChart3,
  ShieldAlert,
  ShieldCheck,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { signOut, useSession } from "next-auth/react";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const isOwnerOrAdmin = role === "OWNER" || role === "ADMIN";

  // Icon accents are deliberately drawn from a narrow, low-saturation set.
  // Ten saturated rainbow icons made the rail feel noisy and tiring; keeping
  // them cool and muted matches the "cool mist" palette.
  const navigation = [
    {
      name: "Kasir (POS)",
      href: "/pos",
      icon: ShoppingCart,
      color: "text-indigo-600 dark:text-indigo-300",
      badge: "Utama",
    },
    {
      name: "Riwayat Struk",
      href: "/sales",
      icon: Receipt,
      color: "text-slate-600 dark:text-slate-300",
      adminOnly: false,
    },
    {
      name: "Produk & Kategori",
      href: "/products",
      icon: Package,
      color: "text-emerald-600 dark:text-emerald-400",
      adminOnly: false,
    },
    {
      name: "Inventori & Stok",
      href: "/inventory",
      icon: Boxes,
      color: "text-amber-600 dark:text-amber-400",
      adminOnly: false,
    },
    {
      name: "Sesi Kasir (Cash)",
      href: "/cash",
      icon: Wallet,
      color: "text-indigo-600 dark:text-indigo-300",
      adminOnly: false,
    },
    {
      name: "Pengeluaran",
      href: "/expenses",
      icon: DollarSign,
      color: "text-rose-600 dark:text-rose-400",
      adminOnly: true,
    },
    {
      name: "Retur / Refund",
      href: "/refunds",
      icon: RotateCcw,
      color: "text-rose-600 dark:text-rose-400",
      adminOnly: true,
    },
    {
      name: "Laporan & Keuangan",
      href: "/reports",
      icon: BarChart3,
      color: "text-indigo-600 dark:text-indigo-300",
      adminOnly: true,
    },
    {
      name: "Audit Log",
      href: "/audit",
      icon: ShieldAlert,
      color: "text-slate-600 dark:text-slate-300",
      adminOnly: true,
    },
    {
      name: "Manajemen User",
      href: "/users",
      icon: ShieldCheck,
      color: "text-emerald-600 dark:text-emerald-400",
      adminOnly: true,
    },
  ];

  const filteredNavigation = navigation.filter(
    (item) => !item.adminOnly || isOwnerOrAdmin
  );

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-50 flex w-64 sm:w-72 max-w-[85vw] flex-col transition-transform duration-300 lg:static lg:translate-x-0 shadow-xl",
          // Light: misty panel that blends with the app. Dark: deep slate.
          "bg-slate-100 text-slate-800 border-r border-slate-200",
          "dark:bg-slate-900 dark:text-slate-200 dark:border-slate-800",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand Header */}
        <div className="flex h-20 items-center justify-between px-6 border-b border-slate-200 bg-white/70 dark:border-slate-800 dark:bg-slate-950/60">
          <Link href="/pos" className="flex items-center gap-3">
            <img
              src="/logo.svg"
              alt="MISYourPOS Logo"
              className="h-11 w-11 rounded-full object-cover shadow-lg shadow-indigo-600/20 ring-2 ring-indigo-500/20"
            />
            <div>
              <div className="text-base font-bold tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                MISYourPOS
                <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/25">
                  Refill
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate max-w-[140px]">
                Parfum &amp; Botol
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-2 scrollbar-thin">
          <div className="px-3 pb-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Menu Utama
          </div>
          {filteredNavigation.map((item) => {
            const isActive =
              pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "group flex items-center justify-between rounded-2xl px-4 py-3 sm:py-3.5 text-sm sm:text-base font-semibold transition-all duration-150",
                  // Selected item: a soft accent tint (not a slab of solid
                  // accent) so the rail stays calm during a long shift.
                  isActive
                    ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-200 shadow-sm shadow-indigo-600/10 font-semibold"
                    : "text-slate-700 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-slate-50"
                )}
              >
                <div className="flex items-center gap-3.5">
                  <item.icon
                    className={cn(
                      "h-6 w-6 transition-transform group-hover:scale-110",
                      isActive ? "text-indigo-600 dark:text-indigo-300" : item.color
                    )}
                  />
                  <span>{item.name}</span>
                </div>
                {item.badge && !isActive && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/25">
                    {item.badge}
                  </span>
                )}
                {isActive && (
                  <ChevronRight className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
                )}
              </Link>
            );
          })}
        </div>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-slate-200 bg-white/70 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="flex items-center justify-between gap-3 mb-3 px-2">
            <div className="flex items-center gap-3 truncate">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-slate-800 text-sm font-bold text-indigo-600 dark:text-indigo-300 border border-slate-200 dark:border-slate-700">
                {session?.user?.name?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                  {session?.user?.name || "Kasir"}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {role === "OWNER"
                    ? "Pemilik (Owner)"
                    : role === "ADMIN"
                    ? "Administrator"
                    : "Kasir Toko"}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white dark:bg-slate-800/70 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-300 dark:hover:bg-rose-500/15 dark:hover:text-rose-200 transition-colors border border-rose-200 dark:border-rose-500/20 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Keluar (Sign Out)
          </button>
        </div>
      </aside>
    </>
  );
}
