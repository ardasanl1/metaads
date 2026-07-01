"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Megaphone, Moon, Settings, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { AccountSelectorsBar } from "@/components/selectors/AccountSelectorsBar";
import { MetaAccountProvider } from "@/hooks/use-meta-account";
import { cn } from "@/utils/cn";

const menuItems = [
  { label: "Genel Bakış", href: "/dashboard", icon: LayoutDashboard },
  { label: "Kampanyalar", href: "/campaigns", icon: Megaphone },
  { label: "Ayarlar", href: "/settings", icon: Settings },
];

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-full justify-start gap-2"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Tema değiştir"
    >
      <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      </span>
      <span className="dark:hidden">Açık Tema</span>
      <span className="hidden dark:inline">Koyu Tema</span>
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

  function isActive(href: string): boolean {
    if (href === "/campaigns") {
      return pathname === href || pathname.startsWith("/campaigns/");
    }
    if (href === "/settings") {
      return pathname === href || pathname.startsWith("/settings/");
    }
    return pathname === href;
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card">
        <div className="border-b border-border px-4 py-5">
          <p className="text-sm font-semibold text-primary">Meta Reklam Paneli</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Yönetim</p>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-border p-3">
          <ThemeToggle />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => void handleLogout()}
          >
            Çıkış
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-border bg-card px-4 py-4 sm:px-6">
          <h1 className="truncate text-lg font-semibold sm:text-xl">{title}</h1>
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
