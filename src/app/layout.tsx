import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JCW Lab ELN",
  description: "JCW Lab Electronic Lab Notebook",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
