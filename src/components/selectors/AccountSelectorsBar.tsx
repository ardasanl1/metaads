"use client";

import { BusinessSelector } from "@/components/selectors/BusinessSelector";
import { AdAccountSelector } from "@/components/selectors/AdAccountSelector";
import { useMetaAccount } from "@/hooks/use-meta-account";

export function AccountSelectorsBar() {
  const {
    status,
    businesses,
    selectedBusinessId,
    setSelectedBusinessId,
    adAccounts,
    selectedAdAccountId,
    selectAdAccountById,
    loading,
  } = useMetaAccount();

  if (!status?.connected) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 border-b border-border bg-card px-4 py-3 sm:flex-row sm:items-end sm:px-6">
      <BusinessSelector
        businesses={businesses}
        value={selectedBusinessId}
        onChange={(businessId) => void setSelectedBusinessId(businessId)}
        loading={loading}
      />
      <AdAccountSelector
        adAccounts={adAccounts}
        value={selectedAdAccountId}
        onChange={(adAccountId) => void selectAdAccountById(adAccountId)}
        loading={loading}
      />
    </div>
  );
}
