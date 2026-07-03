"use client";

import { Building2, Target } from "lucide-react";
import { FirmSelector } from "@/components/selectors/FirmSelector";
import { AdAccountSelector } from "@/components/selectors/AdAccountSelector";
import { useMetaAccount } from "@/hooks/use-meta-account";

export function AccountContextBar() {
  const {
    status,
    connections,
    activeConnectionId,
    selectFirm,
    adAccounts,
    selectedAdAccountId,
    selectAdAccountById,
    loading,
  } = useMetaAccount();

  if (!status?.connected) return null;

  return (
    <div className="panel-card flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
      <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:max-w-2xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            İşletme
          </div>
          <FirmSelector
            connections={connections}
            value={activeConnectionId}
            onChange={(connectionId) => void selectFirm(connectionId)}
            loading={loading}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Target className="h-3.5 w-3.5" />
            Reklam Hesabı
          </div>
          <AdAccountSelector
            adAccounts={adAccounts}
            value={selectedAdAccountId}
            onChange={(adAccountId) => void selectAdAccountById(adAccountId)}
            loading={loading}
          />
        </div>
      </div>
      <p className="hidden text-sm text-muted-foreground lg:block">
        Hedefiniz nedir? Seçili hesap üzerinden kampanya yönetimi yapılır.
      </p>
    </div>
  );
}
