"use client";

import { useState, useMemo } from "react";
import {
  ShieldAlert,
  Search,
  Download,
  Calendar,
  Filter,
  Eye,
  X,
  FileCode,
} from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  previousValue: string | null;
  newValue: string | null;
  createdAt: Date | string;
  user?: { name: string; username: string; role: string } | null;
}

interface AuditClientProps {
  logs: AuditLog[];
}

export function AuditClient({ logs }: AuditClientProps) {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const actions = useMemo(() => {
    const set = new Set(logs.map((l) => l.action));
    return Array.from(set);
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (actionFilter !== "ALL" && l.action !== actionFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        l.action.toLowerCase().includes(q) ||
        l.entity.toLowerCase().includes(q) ||
        (l.entityId && l.entityId.toLowerCase().includes(q)) ||
        (l.user?.name && l.user.name.toLowerCase().includes(q))
      );
    });
  }, [logs, actionFilter, search]);

  const handleExport = () => {
    const data = filteredLogs.map((l) => ({
      ID: l.id,
      Waktu: formatDateTime(l.createdAt),
      Aksi: l.action,
      Entitas: l.entity,
      Entity_ID: l.entityId || "",
      Pengguna: l.user?.name || "Sistem",
      Perubahan_Baru: l.newValue || "",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Audit Log");
    XLSX.writeFile(wb, `Audit_Trail_MISYourPOS_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Audit Trail & Rekam Jejak Sistem
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Rekam jejak seluruh aktivitas penting (login, restok, opname, transaksi kasir, refund, dan perubahan data).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="rounded-xl flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
          >
            <Download className="h-4 w-4 text-emerald-600" />
            Ekspor Excel
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Cari audit log berdasarkan aksi, entitas, ID, atau nama pengguna..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 text-xs rounded-xl"
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="h-10 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 outline-none"
        >
          <option value="ALL">Semua Aksi</option>
          {actions.map((act) => (
            <option key={act} value={act}>
              {act}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="py-3 px-4">Waktu</th>
              <th className="py-3 px-4">Aksi</th>
              <th className="py-3 px-4">Entitas Terkait</th>
              <th className="py-3 px-4">Pengguna</th>
              <th className="py-3 px-4">Ringkasan Data</th>
              <th className="py-3 px-4 text-right">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  Tidak ada audit log yang sesuai filter.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {log.entity}
                    </span>
                    {log.entityId && (
                      <span className="text-[10px] text-slate-400 block font-mono">
                        {log.entityId}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {log.user?.name || "Sistem"}
                    </div>
                    {log.user?.role && (
                      <span className="text-[10px] text-slate-400">
                        {log.user.role}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-[10px] text-slate-500 max-w-[240px] truncate">
                    {log.newValue || log.previousValue || "-"}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setSelectedLog(log)}
                      className="rounded-lg text-slate-500 hover:text-indigo-600 cursor-pointer"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* DETAIL MODAL */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Rincian Log: {selectedLog.action}
                </h3>
                <p className="text-[11px] text-slate-500 font-mono">
                  {formatDateTime(selectedLog.createdAt)} • Oleh {selectedLog.user?.name || "Sistem"}
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Nilai Sebelum (Previous Value):
                </span>
                <pre className="p-3 rounded-xl bg-slate-100 dark:bg-slate-950 font-mono text-[11px] text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap">
                  {selectedLog.previousValue
                    ? JSON.stringify(JSON.parse(selectedLog.previousValue), null, 2)
                    : "null"}
                </pre>
              </div>

              <div>
                <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Nilai Baru (New Value):
                </span>
                <pre className="p-3 rounded-xl bg-slate-100 dark:bg-slate-950 font-mono text-[11px] text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap">
                  {selectedLog.newValue
                    ? JSON.stringify(JSON.parse(selectedLog.newValue), null, 2)
                    : "null"}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
