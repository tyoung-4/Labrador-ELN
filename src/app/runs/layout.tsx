import { Suspense } from "react";
import AppTopNav from "@/components/AppTopNav";
import ProtocolsRunsSubNav from "@/components/ProtocolsRunsSubNav";

export default function RunsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <div className="px-6 pt-6 [&>nav]:mb-0">
        <AppTopNav />
      </div>
      <Suspense>
        <ProtocolsRunsSubNav />
      </Suspense>
      {children}
    </div>
  );
}
