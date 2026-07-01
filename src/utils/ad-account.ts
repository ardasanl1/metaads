import type { AdAccount } from "@/types/meta";

export type AdAccountRaw = {
  id: string;
  account_id?: string;
  name: string;
  account_status?: number;
  currency?: string;
};

export type NormalizedAdAccount = {
  id: string;
  accountId: string;
  name: string;
  account_status?: number;
  currency?: string;
};

export function getNumericAdAccountId(accountId: string): string {
  return accountId.trim().replace(/^act_/, "");
}

export function normalizeAdAccountId(accountId: string): string {
  const trimmed = accountId.trim();
  if (!trimmed) return "";
  return `act_${getNumericAdAccountId(trimmed)}`;
}

export function adAccountIdsMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  return normalizeAdAccountId(a) === normalizeAdAccountId(b);
}

export function normalizeAdAccountRecord(raw: AdAccountRaw): NormalizedAdAccount {
  const accountId = (raw.account_id ?? getNumericAdAccountId(raw.id)).trim();
  return {
    id: `act_${accountId}`,
    accountId,
    name: raw.name,
    account_status: raw.account_status,
    currency: raw.currency,
  };
}

export function normalizeAdAccountList(rawAccounts: AdAccountRaw[]): NormalizedAdAccount[] {
  const byNumericId = new Map<string, NormalizedAdAccount>();

  for (const raw of rawAccounts) {
    const normalized = normalizeAdAccountRecord(raw);
    byNumericId.set(normalized.accountId, normalized);
  }

  return Array.from(byNumericId.values());
}

export function findAdAccountById(
  accounts: NormalizedAdAccount[],
  accountId: string,
): NormalizedAdAccount | undefined {
  const normalizedId = normalizeAdAccountId(accountId);
  return accounts.find((account) => account.id === normalizedId);
}

export function formatAdAccountLabel(
  account: Pick<NormalizedAdAccount, "name"> & { id?: string },
): string {
  if (account.name?.trim()) {
    return account.name.trim();
  }
  return "Reklam hesabı";
}

export function getFirmDisplayName(connection: {
  metaUserName?: string | null;
  metaUserId?: string | null;
  displayName?: string;
}): string {
  if (connection.displayName?.trim()) {
    return connection.displayName.trim();
  }
  if (connection.metaUserName?.trim()) {
    return connection.metaUserName.trim();
  }
  return "İşletme";
}

export function linkedAccountsToAdAccounts(
  linked: Array<{ id: string; accountId: string; name: string }>,
  connectionId: string,
): AdAccount[] {
  return linked.map((account) => ({
    id: normalizeAdAccountId(account.id),
    accountId: account.accountId || getNumericAdAccountId(account.id),
    name: account.name,
    connectionId,
  }));
}
