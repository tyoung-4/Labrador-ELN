import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ToastProvider";

export const metadata: Metadata = {
  title: "JCW Lab ELN",
  description: "JCW Lab Electronic Lab Notebook",
};

const ENV_LABEL = process.env.NEXT_PUBLIC_ENV_LABEL ?? "";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {/* Sandbox / staging banner */}
        {ENV_LABEL === "staging" && (
          <div className="w-full bg-amber-500 text-black text-sm font-semibold text-center py-2 px-4 z-[9999] relative">
            ⚠ SANDBOX — Test environment. Data will be cleared periodically. Do not enter real lab data.
          </div>
        )}
        <ToastProvider>
          {children}
        </ToastProvider>
        {/* Dev badge */}
        {(ENV_LABEL === "development" || ENV_LABEL === "") && (
          <div className="fixed bottom-3 left-3 z-[9999] bg-zinc-700/80 text-zinc-300 text-[10px] font-mono px-2 py-0.5 rounded pointer-events-none select-none">
            DEV
          </div>
        )}
      </body>
    </html>
  );
}
