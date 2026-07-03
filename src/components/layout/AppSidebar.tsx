"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Megaphone, Moon, Settings, Sparkles, Sun, X } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

const menuItems = [
  { label: "Genel Bakış", href: "/dashboard", icon: LayoutDashboard },
  { label: "Kampanyalar", href: "/campaigns", icon: Megaphone },
  { label: "Ayarlar", href: "/settings", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/campaigns") return pathname === href || pathname.startsWith("/campaigns/");
  if (href === "/settings") return pathname === href || pathname.startsWith("/settings/");
  return pathname === href;
}

function ThemeToggle({ compact }: { compact?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        "w-full justify-start gap-2 text-sidebar-muted hover:bg-sidebar-border hover:text-sidebar-foreground",
        compact && "px-2",
      )}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
        <Sun className="h-4 w-4 rotate-0 scale-100 dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-4 w-4 rotate-90 scale-0 dark:rotate-0 dark:scale-100" />
      </span>
      <span className="dark:hidden">Açık Tema</span>
      <span className="hidden dark:inline">Koyu Tema</span>
    </Button>
  );
}

type AppSidebarProps = {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export function AppSidebar({ mobileOpen, onMobileClose }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const content = (
    <>
      <div className="flex items-center justify-between border-b border-sidebar-border px-5 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-active text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-sidebar-foreground">Meta Reklam Paneli</p>
            <p className="text-xs text-sidebar-muted">Yönetim</p>
          </div>
        </div>
        {onMobileClose && (
          <Button variant="ghost" size="icon" className="text-sidebar-muted lg:hidden" onClick={onMobileClose}>
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-sidebar-active font-medium text-white shadow-sm"
                  : "text-sidebar-muted hover:bg-sidebar-border hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}

        <div className="mt-4 rounded-xl border border-sidebar-border bg-sidebar-border/30 p-3">
          <p className="text-xs font-medium text-sidebar-muted">Kısa yol</p>
          <Button
            asChild
            size="sm"
            className="mt-2 w-full bg-sidebar-active text-white hover:bg-sidebar-active/90"
          >
            <Link href="/campaigns/new" onClick={onMobileClose}>
              + Hızlı Kampanya
            </Link>
          </Button>
        </div>
      </nav>

      <div className="space-y-2 border-t border-sidebar-border p-3">
        <ThemeToggle />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-muted hover:bg-sidebar-border hover:text-sidebar-foreground"
          onClick={() => void handleLogout()}
        >
          Çıkış Yap
        </Button>
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        {content}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={onMobileClose} />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-sidebar shadow-xl">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
