"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { RealtimeRefresh } from "@/components/layout/realtime-refresh";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider>
      {/* Keep stock / sales / reports data fresh without manual reload */}
      <RealtimeRefresh intervalMs={15000} />
      {children}
    </NextAuthSessionProvider>
  );
}