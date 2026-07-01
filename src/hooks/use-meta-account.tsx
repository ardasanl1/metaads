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
import type { AdAccount, Business, MetaConnectionStatus, MetaConnectionSummary } from "@/types/meta";
import {
  activateConnection,
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
  connections: MetaConnectionSummary[];
  activeConnectionId: string | null;
  selectFirm: (connectionId: string) => Promise<void>;
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
  const [connections, setConnections] = useState<MetaConnectionSummary[]>([]);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessIdState] = useState<string | null>(null);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [selectedAdAccountId, setSelectedAdAccountId] = useState<string | null>(null);
  const [selectedAdAccountName, setSelectedAdAccountName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const loadFirmData = useCallback(
    async (
      connectionId: string,
      preferredAccountId?: string | null,
      preferredBusinessId?: string | null,
    ) => {
      const nextBusinesses = await fetchBusinesses(connectionId);
      setBusinesses(nextBusinesses);

      const storedBusinessId = readStorage(LOCAL_STORAGE_KEYS.SELECTED_BUSINESS_ID);
      const businessId =
        preferredBusinessId && nextBusinesses.some((business) => business.id === preferredBusinessId)
          ? preferredBusinessId
          : storedBusinessId && nextBusinesses.some((business) => business.id === storedBusinessId)
            ? storedBusinessId
            : nextBusinesses[0]?.id ?? null;

      setSelectedBusinessIdState(businessId);
      if (businessId) {
        writeStorage(LOCAL_STORAGE_KEYS.SELECTED_BUSINESS_ID, businessId);
      }

      const accounts = await fetchAdAccounts(connectionId, businessId);
      setAdAccounts(accounts);

      const storedAccountId = readStorage(
        `${LOCAL_STORAGE_KEYS.SELECTED_AD_ACCOUNT_ID}:${connectionId}`,
      );
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
      writeStorage(`${LOCAL_STORAGE_KEYS.SELECTED_AD_ACCOUNT_ID}:${connectionId}`, candidate.id);

      if (!serverAccountId || !adAccountIdsMatch(candidate.id, serverAccountId)) {
        await selectAdAccount(candidate.id, candidate.name, connectionId);
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
      setConnections(nextStatus.connections);

      if (!nextStatus.connected || !nextStatus.activeConnectionId) {
        setActiveConnectionId(null);
        setBusinesses([]);
        setAdAccounts([]);
        setSelectedBusinessIdState(null);
        setSelectedAdAccountId(null);
        setSelectedAdAccountName(null);
        return;
      }

      const connectionId = nextStatus.activeConnectionId;
      setActiveConnectionId(connectionId);
      writeStorage(LOCAL_STORAGE_KEYS.ACTIVE_CONNECTION_ID, connectionId);

      await loadFirmData(
        connectionId,
        nextStatus.selectedAdAccountId,
        readStorage(LOCAL_STORAGE_KEYS.SELECTED_BUSINESS_ID),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Hesap bilgileri yüklenemedi";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [loadFirmData]);

  useEffect(() => {
    void initialize();
  }, [initialize, reloadToken]);

  const selectFirm = useCallback(
    async (connectionId: string) => {
      setLoading(true);
      setError(null);
      try {
        const activated = await activateConnection(connectionId);
        setActiveConnectionId(connectionId);
        writeStorage(LOCAL_STORAGE_KEYS.ACTIVE_CONNECTION_ID, connectionId);
        setConnections((current) =>
          current.map((item) => ({
            ...item,
            isActive: item.id === connectionId,
            selectedAdAccountId:
              item.id === connectionId ? activated.selectedAdAccountId : item.selectedAdAccountId,
            selectedAdAccountName:
              item.id === connectionId ? activated.selectedAdAccountName : item.selectedAdAccountName,
          })),
        );
        setStatus((current) =>
          current
            ? {
                ...current,
                activeConnectionId: connectionId,
                metaUserId: activated.metaUserId,
                metaUserName: activated.metaUserName,
                selectedAdAccountId: activated.selectedAdAccountId || null,
                selectedAdAccountName: activated.selectedAdAccountName || null,
              }
            : current,
        );
        await loadFirmData(connectionId, activated.selectedAdAccountId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Firma seçilemedi";
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [loadFirmData],
  );

  const setSelectedBusinessId = useCallback(
    async (businessId: string) => {
      if (!activeConnectionId) return;
      setSelectedBusinessIdState(businessId);
      writeStorage(LOCAL_STORAGE_KEYS.SELECTED_BUSINESS_ID, businessId);
      setLoading(true);
      try {
        const accounts = await fetchAdAccounts(activeConnectionId, businessId);
        setAdAccounts(accounts);
        const current = findAdAccountById(accounts, selectedAdAccountId ?? "");
        if (!current && accounts[0]) {
          await selectAdAccount(accounts[0].id, accounts[0].name, activeConnectionId);
          setSelectedAdAccountId(accounts[0].id);
          setSelectedAdAccountName(accounts[0].name);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Reklam hesapları yüklenemedi";
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [activeConnectionId, selectedAdAccountId],
  );

  const selectAdAccountById = useCallback(
    async (adAccountId: string) => {
      if (!activeConnectionId) return;
      const account = findAdAccountById(adAccounts, adAccountId);
      if (!account) return;

      setLoading(true);
      setError(null);
      try {
        await selectAdAccount(account.id, account.name, activeConnectionId);
        setSelectedAdAccountId(account.id);
        setSelectedAdAccountName(account.name);
        writeStorage(`${LOCAL_STORAGE_KEYS.SELECTED_AD_ACCOUNT_ID}:${activeConnectionId}`, account.id);
        setStatus((current) =>
          current
            ? {
                ...current,
                selectedAdAccountId: account.id,
                selectedAdAccountName: account.name,
              }
            : current,
        );
        setConnections((current) =>
          current.map((item) =>
            item.id === activeConnectionId
              ? {
                  ...item,
                  selectedAdAccountId: account.id,
                  selectedAdAccountName: account.name,
                }
              : item,
          ),
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
    [activeConnectionId, adAccounts],
  );

  const addAdAccountManually = useCallback(
    async (rawAdAccountId: string) => {
      if (!activeConnectionId) return;
      setLoading(true);
      setError(null);
      try {
        const result = await selectAdAccount(rawAdAccountId, "", activeConnectionId);
        const normalizedId = normalizeAdAccountId(result.selectedAdAccountId);
        setSelectedAdAccountId(normalizedId);
        setSelectedAdAccountName(result.selectedAdAccountName);
        writeStorage(
          `${LOCAL_STORAGE_KEYS.SELECTED_AD_ACCOUNT_ID}:${activeConnectionId}`,
          normalizedId,
        );
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
              connectionId: activeConnectionId,
            },
          ];
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Reklam hesabı eklenemedi";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [activeConnectionId],
  );

  const retry = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  const accountKey =
    activeConnectionId && selectedAdAccountId
      ? `${activeConnectionId}:${selectedAdAccountId}`
      : "none";

  const isReady = Boolean(status?.connected && activeConnectionId && selectedAdAccountId);

  const value = useMemo<MetaAccountContextValue>(
    () => ({
      status,
      connections,
      activeConnectionId,
      selectFirm,
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
      connections,
      activeConnectionId,
      selectFirm,
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
