"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { AccountSelectorsBar } from "@/components/selectors/AccountSelectorsBar";
import { MetaAccountProvider } from "@/hooks/use-meta-account";

const menuItems = [
  { label: "Genel Bakış", href: "/dashboard" },
  { label: "Kampanyalar", href: "/campaigns" },
  { label: "Entegrasyonlar", href: "/settings/integrations" },
];

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="relative"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Tema değiştir"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}

function PanelLayoutInner({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="w-full shrink-0 border-b border-border bg-card md:w-56 md:border-b-0 md:border-r">
        <div className="border-b border-border px-4 py-5">
          <p className="text-sm font-semibold text-primary">Meta Ads Panel</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 py-3 md:flex-col md:overflow-x-visible">
          {menuItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href === "/campaigns" && pathname.startsWith("/campaigns"));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-border bg-card px-4 py-4 sm:px-6">
          <h1 className="truncate text-lg font-semibold sm:text-xl">{title}</h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button type="button" variant="outline" size="sm" onClick={() => void handleLogout()}>
              Çıkış
            </Button>
          </div>
        </header>
        <AccountSelectorsBar />
        <main className="min-w-0 flex-1 overflow-x-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

export default function PanelLayout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <MetaAccountProvider>
      <PanelLayoutInner title={title}>{children}</PanelLayoutInner>
    </MetaAccountProvider>
  );
}
