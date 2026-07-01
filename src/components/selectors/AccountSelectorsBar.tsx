"use client";

import { FirmSelector } from "@/components/selectors/FirmSelector";
import { AdAccountSelector } from "@/components/selectors/AdAccountSelector";
import { AddAdAccountForm } from "@/components/selectors/AddAdAccountForm";
import { useMetaAccount } from "@/hooks/use-meta-account";

export function AccountSelectorsBar() {
  const {
    status,
    connections,
    activeConnectionId,
    activeConnection,
    selectFirm,
    adAccounts,
    selectedAdAccountId,
    selectAdAccountById,
    addAdAccountManually,
    loading,
  } = useMetaAccount();

  if (!status?.connected) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 border-b border-border bg-card px-4 py-3 sm:flex-row sm:flex-wrap sm:items-end sm:px-6">
      <FirmSelector
        connections={connections}
        value={activeConnectionId}
        onChange={(connectionId) => void selectFirm(connectionId)}
        loading={loading}
        metaUserId={activeConnection?.metaUserId}
      />
      <AdAccountSelector
        adAccounts={adAccounts}
        value={selectedAdAccountId}
        onChange={(adAccountId) => void selectAdAccountById(adAccountId)}
        loading={loading}
      />
      <AddAdAccountForm onAdd={addAdAccountManually} disabled={loading || !activeConnectionId} />
    </div>
  );
}
