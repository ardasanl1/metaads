"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const menuItems = [
  { label: "Genel Bakış", href: "/dashboard" },
  { label: "Kampanyalar", href: "/campaigns" },
  { label: "Entegrasyonlar", href: "/settings/integrations" },
];

export default function PanelLayout({
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
      <aside className="w-full shrink-0 border-b border-gray-200 bg-white md:w-56 md:border-b-0 md:border-r">
        <div className="border-b border-gray-200 px-4 py-5">
          <p className="text-sm font-semibold text-blue-600">Meta Ads Panel</p>
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
                    ? "bg-blue-50 font-medium text-blue-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
          <h1 className="truncate text-lg font-semibold sm:text-xl">{title}</h1>
          <button
            type="button"
            onClick={handleLogout}
            className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
          >
            Çıkış
          </button>
        </header>
        <main className="min-w-0 flex-1 overflow-x-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
