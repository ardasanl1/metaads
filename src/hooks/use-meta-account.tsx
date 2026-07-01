"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import type { AdAccount, Business, MetaConnectionStatus } from "@/types/meta";
import {
  fetchAdAccounts,
  fetchBusinesses,
  fetchMetaStatus,
  selectAdAccount,
} from "@/services/meta/client";
import { LOCAL_STORAGE_KEYS } from "@/utils/meta-constants";
import {
  adAccountIdsMatch,
  findAdAccountById,
  normalizeAdAccountId,
} from "@/utils/ad-account";

type MetaAccountContextValue = {
  status: MetaConnectionStatus | null;
  businesses: Business[];
  selectedBusinessId: string | null;
  setSelectedBusinessId: (businessId: string) => void;
  adAccounts: AdAccount[];
  selectedAdAccountId: string | null;
  selectedAdAccountName: string | null;
  selectAdAccountById: (adAccountId: string) => Promise<void>;
  addAdAccountManually: (adAccountId: string) => Promise<void>;
  accountKey: string;
  loading: boolean;
  error: string | null;
  retry: () => void;
  isReady: boolean;
};

const MetaAccountContext = createContext<MetaAccountContextValue | null>(null);

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key);
}

function writeStorage(key: string, value: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, value);
}

export function MetaAccountProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<MetaConnectionStatus | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessIdState] = useState<string | null>(null);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [selectedAdAccountId, setSelectedAdAccountId] = useState<string | null>(null);
  const [selectedAdAccountName, setSelectedAdAccountName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const loadAdAccounts = useCallback(
    async (businessId: string | null, preferredAccountId?: string | null) => {
      const accounts = await fetchAdAccounts(businessId);
      setAdAccounts(accounts);

      const storedAccountId = readStorage(LOCAL_STORAGE_KEYS.SELECTED_AD_ACCOUNT_ID);
      const serverAccountId = preferredAccountId ?? null;

      const storedMatch = storedAccountId ? findAdAccountById(accounts, storedAccountId) : undefined;
      const serverMatch = serverAccountId ? findAdAccountById(accounts, serverAccountId) : undefined;

      const candidate = storedMatch ?? serverMatch ?? accounts[0] ?? null;

      if (!candidate) {
        setSelectedAdAccountId(null);
        setSelectedAdAccountName(null);
        return;
      }

      setSelectedAdAccountId(candidate.id);
      setSelectedAdAccountName(candidate.name);
      writeStorage(LOCAL_STORAGE_KEYS.SELECTED_AD_ACCOUNT_ID, candidate.id);

      if (!serverAccountId || !adAccountIdsMatch(candidate.id, serverAccountId)) {
        await selectAdAccount(candidate.id, candidate.name);
      }
    },
    [],
  );

  const initialize = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextStatus = await fetchMetaStatus();
      setStatus(nextStatus);

      if (!nextStatus.connected) {
        setBusinesses([]);
        setAdAccounts([]);
        setSelectedBusinessIdState(null);
        setSelectedAdAccountId(null);
        setSelectedAdAccountName(null);
        return;
      }

      const nextBusinesses = await fetchBusinesses();
      setBusinesses(nextBusinesses);

      const storedBusinessId = readStorage(LOCAL_STORAGE_KEYS.SELECTED_BUSINESS_ID);
      const businessId =
        storedBusinessId && nextBusinesses.some((business) => business.id === storedBusinessId)
          ? storedBusinessId
          : nextBusinesses[0]?.id ?? null;

      setSelectedBusinessIdState(businessId);
      if (businessId) {
        writeStorage(LOCAL_STORAGE_KEYS.SELECTED_BUSINESS_ID, businessId);
      }

      await loadAdAccounts(businessId, nextStatus.selectedAdAccountId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Hesap bilgileri yüklenemedi";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [loadAdAccounts]);

  useEffect(() => {
    void initialize();
  }, [initialize, reloadToken]);

  const setSelectedBusinessId = useCallback(
    async (businessId: string) => {
      setSelectedBusinessIdState(businessId);
      writeStorage(LOCAL_STORAGE_KEYS.SELECTED_BUSINESS_ID, businessId);
      setLoading(true);
      try {
        await loadAdAccounts(businessId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Reklam hesapları yüklenemedi";
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [loadAdAccounts],
  );

  const selectAdAccountById = useCallback(
    async (adAccountId: string) => {
      const account = findAdAccountById(adAccounts, adAccountId);
      if (!account) return;

      setLoading(true);
      setError(null);
      try {
        await selectAdAccount(account.id, account.name);
        setSelectedAdAccountId(account.id);
        setSelectedAdAccountName(account.name);
        writeStorage(LOCAL_STORAGE_KEYS.SELECTED_AD_ACCOUNT_ID, account.id);
        setStatus((current) =>
          current
            ? {
                ...current,
                selectedAdAccountId: account.id,
                selectedAdAccountName: account.name,
              }
            : current,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Reklam hesabı seçilemedi";
        setError(message);
        toast.error(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [adAccounts],
  );

  const addAdAccountManually = useCallback(async (rawAdAccountId: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await selectAdAccount(rawAdAccountId, "");
      const normalizedId = normalizeAdAccountId(result.selectedAdAccountId);
      setSelectedAdAccountId(normalizedId);
      setSelectedAdAccountName(result.selectedAdAccountName);
      writeStorage(LOCAL_STORAGE_KEYS.SELECTED_AD_ACCOUNT_ID, normalizedId);
      setAdAccounts((current) => {
        if (current.some((account) => adAccountIdsMatch(account.id, normalizedId))) {
          return current;
        }
        return [
          ...current,
          {
            id: normalizedId,
            accountId: normalizedId.replace(/^act_/, ""),
            name: result.selectedAdAccountName,
          },
        ];
      });
      setStatus((current) =>
        current
          ? {
              ...current,
              selectedAdAccountId: normalizedId,
              selectedAdAccountName: result.selectedAdAccountName,
            }
          : current,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Reklam hesabı eklenemedi";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const retry = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  const accountKey = selectedAdAccountId ?? "none";

  const isReady = Boolean(status?.connected && selectedAdAccountId);

  const value = useMemo<MetaAccountContextValue>(
    () => ({
      status,
      businesses,
      selectedBusinessId,
      setSelectedBusinessId,
      adAccounts,
      selectedAdAccountId,
      selectedAdAccountName,
      selectAdAccountById,
      addAdAccountManually,
      accountKey,
      loading,
      error,
      retry,
      isReady,
    }),
    [
      status,
      businesses,
      selectedBusinessId,
      setSelectedBusinessId,
      adAccounts,
      selectedAdAccountId,
      selectedAdAccountName,
      selectAdAccountById,
      addAdAccountManually,
      accountKey,
      loading,
      error,
      retry,
      isReady,
    ],
  );

  return <MetaAccountContext.Provider value={value}>{children}</MetaAccountContext.Provider>;
}

export function useMetaAccount() {
  const context = useContext(MetaAccountContext);
  if (!context) {
    throw new Error("useMetaAccount must be used within MetaAccountProvider");
  }
  return context;
}
