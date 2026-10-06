"use client";

import { useRef } from "react";
import { Printer, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/utils";

interface ReceiptItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  unit?: string;
}

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: {
    transactionNumber: string;
    date: Date | string;
    cashierName: string;
    paymentMethod: string;
    subtotal: number;
    discountAmount: number;
    grandTotal: number;
    cashReceived?: number;
    changeAmount?: number;
    items: ReceiptItem[];
  } | null;
  storeSettings?: {
    storeName?: string;
    address?: string;
    phone?: string;
    receiptHeader?: string;
    receiptFooter?: string;
  };
}

export function ReceiptModal({
  isOpen,
  onClose,
  sale,
  storeSettings,
}: ReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !sale) return null;

  const handlePrint = () => {
    const printContent = receiptRef.current;
    if (!printContent) return;

    const winPrint = window.open("", "", "left=0,top=0,width=400,height=600,toolbar=0,scrollbars=0,status=0");
    if (!winPrint) return;

    winPrint.document.write(`
      <html>
        <head>
          <title>Struk Pembayaran - ${sale.transactionNumber}</title>
          <style>
            @page { margin: 0; size: 80mm auto; }
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 12px;
              line-height: 1.3;
              color: #000;
              margin: 12px;
              width: 72mm;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .border-top { border-top: 1px dashed #444; margin-top: 6px; padding-top: 6px; }
            .border-bottom { border-bottom: 1px dashed #444; margin-bottom: 6px; padding-bottom: 6px; }
            .flex-between { display: flex; justify-content: space-between; }
            .item-row { margin-bottom: 4px; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    winPrint.document.close();
    winPrint.focus();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="relative w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
            <CheckCircle2 className="h-5 w-5" />
            <span>Transaksi Berhasil</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Receipt Paper Simulation */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          <div
            ref={receiptRef}
            className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-5 font-mono text-xs text-slate-800 dark:text-slate-200 leading-relaxed shadow-inner"
          >
            {/* Store Branding */}
            <div className="text-center pb-3 border-b border-dashed border-slate-300 dark:border-slate-700">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                {storeSettings?.storeName || "AROMA LUXURY REFILL"}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {storeSettings?.address || "Jl. Malioboro No. 45, Yogyakarta"}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Telp: {storeSettings?.phone || "0812-3456-7890"}
              </p>
            </div>

            {/* Metadata */}
            <div className="py-2.5 border-b border-dashed border-slate-300 dark:border-slate-700 text-[11px] space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">No. Struk:</span>
                <span className="font-semibold">{sale.transactionNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Waktu:</span>
                <span>{formatDateTime(sale.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Kasir:</span>
                <span>{sale.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Metode:</span>
                <span className="font-bold uppercase">
                  {sale.paymentMethod === "CASH" ? "TUNAI" : "QRIS"}
                </span>
              </div>
            </div>

            {/* Line Items */}
            <div className="py-3 border-b border-dashed border-slate-300 dark:border-slate-700 space-y-2">
              {sale.items.map((it, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="font-semibold text-slate-900 dark:text-white truncate">
                    {it.productName}
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400 text-[11px]">
                    <span>
                      {it.quantity} {it.unit || "ml"} x {formatCurrency(it.unitPrice)}
                    </span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {formatCurrency(it.total)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="pt-2.5 pb-2 text-[11px] space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal:</span>
                <span>{formatCurrency(sale.subtotal)}</span>
              </div>
              {sale.discountAmount > 0 && (
                <div className="flex justify-between text-rose-600 dark:text-rose-400 font-medium">
                  <span>Diskon:</span>
                  <span>-{formatCurrency(sale.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs font-bold pt-1 border-t border-slate-200 dark:border-slate-800">
                <span>TOTAL AKHIR:</span>
                <span className="text-indigo-600 dark:text-indigo-400">
                  {formatCurrency(sale.grandTotal)}
                </span>
              </div>

              {sale.paymentMethod === "CASH" && (
                <>
                  <div className="flex justify-between pt-1 text-slate-600 dark:text-slate-400">
                    <span>Tunai Diterima:</span>
                    <span>{formatCurrency(sale.cashReceived || sale.grandTotal)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-600 dark:text-emerald-400">
                    <span>Kembalian:</span>
                    <span>{formatCurrency(sale.changeAmount || 0)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Receipt Footer */}
            <div className="text-center pt-3 border-t border-dashed border-slate-300 dark:border-slate-700 text-[10px] text-slate-500">
              <p className="whitespace-pre-line font-medium">
                {storeSettings?.receiptFooter ||
                  "Terima kasih atas kunjungan Anda!\nWangi Tahan Hingga 24 Jam."}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 rounded-xl cursor-pointer"
          >
            Transaksi Baru
          </Button>
          <Button
            onClick={handlePrint}
            className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            Cetak Struk
          </Button>
        </div>
      </div>
    </div>
  );
}
