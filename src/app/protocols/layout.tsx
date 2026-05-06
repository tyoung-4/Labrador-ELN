import { Suspense } from "react";
import AppTopNav from "@/components/AppTopNav";
import ProtocolsRunsSubNav from "@/components/ProtocolsRunsSubNav";

export default function ProtocolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppTopNav />
      <Suspense>
        <ProtocolsRunsSubNav />
      </Suspense>
      {children}
    </>
  );
}
