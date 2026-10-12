import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/providers/session-provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "MISYourPOS — Retail Refill Perfume POS System",
  description: "Production-ready POS, Inventory, Cash Management, and Financial Analytics for Perfume Refill Store",
};

// Applied before paint so the chosen theme never flashes the wrong colors
const themeInitScript = `
(function () {
  try {
    var saved = localStorage.getItem("mis-yourpos-theme");
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = saved || (prefersDark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-background text-slate-900 dark:text-slate-100">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
