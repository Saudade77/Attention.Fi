import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Attention.Fi",
  description: "Trade creator attention and prediction markets",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-white dark:bg-[#05060b] text-gray-900 dark:text-white transition-colors">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}