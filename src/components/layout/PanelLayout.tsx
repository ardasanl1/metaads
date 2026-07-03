"use client";

import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AccountContextBar } from "@/components/layout/AccountContextBar";
import { PageHeader } from "@/components/layout/PageHeader";
import { MetaAccountProvider } from "@/hooks/use-meta-account";

function PanelLayoutInner({
  title,
  subtitle,
  actions,
  showAccountBar = true,
  wide,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  showAccountBar?: boolean;
  wide?: boolean;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-page">
      <AppSidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-card/90 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Menü"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="min-w-0 flex-1 lg:hidden">
              <p className="truncate text-sm font-semibold">{title}</p>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className={wide ? "mx-auto max-w-[1400px] space-y-6" : "mx-auto max-w-6xl space-y-6"}>
            <PageHeader title={title} subtitle={subtitle} actions={actions} className="hidden lg:flex" />
            <div className="lg:hidden">
              <PageHeader title={title} subtitle={subtitle} actions={actions} />
            </div>
            {showAccountBar && <AccountContextBar />}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function PanelLayout({
  title,
  subtitle,
  actions,
  showAccountBar = true,
  wide = false,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  showAccountBar?: boolean;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <MetaAccountProvider>
      <PanelLayoutInner
        title={title}
        subtitle={subtitle}
        actions={actions}
        showAccountBar={showAccountBar}
        wide={wide}
      >
        {children}
      </PanelLayoutInner>
    </MetaAccountProvider>
  );
}
