import type { Metadata } from "next";
import { Toaster } from "sonner";
import { AppThemeProvider } from "@/components/layout/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meta Reklam Paneli",
  description: "Meta reklam kampanya yönetim paneli",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body>
        <AppThemeProvider>
          {children}
          <Toaster richColors position="top-right" closeButton />
        </AppThemeProvider>
      </body>
    </html>
  );
}
