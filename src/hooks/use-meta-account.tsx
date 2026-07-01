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
import type { AdAccount, MetaConnectionStatus, MetaConnectionSummary } from "@/types/meta";
import {
  activateConnection,
  addLinkedAdAccount,
  fetchLinkedAdAccounts,
  fetchMetaStatus,
  selectAdAccount,
} from "@/services/meta/client";
import { LOCAL_STORAGE_KEYS } from "@/utils/meta-constants";
import {
  adAccountIdsMatch,
  findAdAccountById,
  linkedAccountsToAdAccounts,
} from "@/utils/ad-account";

type MetaAccountContextValue = {
  status: MetaConnectionStatus | null;
  connections: MetaConnectionSummary[];
  activeConnectionId: string | null;
  activeConnection: MetaConnectionSummary | null;
  selectFirm: (connectionId: string) => Promise<void>;
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
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [selectedAdAccountId, setSelectedAdAccountId] = useState<string | null>(null);
  const [selectedAdAccountName, setSelectedAdAccountName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const applyAdAccountSelection = useCallback(
    (connectionId: string, accountId: string | null, accountName: string | null) => {
      setSelectedAdAccountId(accountId);
      setSelectedAdAccountName(accountName);
      if (accountId) {
        writeStorage(`${LOCAL_STORAGE_KEYS.SELECTED_AD_ACCOUNT_ID}:${connectionId}`, accountId);
      }
      setStatus((current) =>
        current
          ? {
              ...current,
              selectedAdAccountId: accountId,
              selectedAdAccountName: accountName,
            }
          : current,
      );
      setConnections((current) =>
        current.map((item) =>
          item.id === connectionId
            ? {
                ...item,
                selectedAdAccountId: accountId ?? "",
                selectedAdAccountName: accountName ?? "",
              }
            : item,
        ),
      );
    },
    [],
  );

  const loadFirmData = useCallback(
    async (
      connectionId: string,
      preferredAccountId?: string | null,
      linkedFromStatus?: MetaConnectionSummary["linkedAdAccounts"],
    ) => {
      const accounts =
        linkedFromStatus && linkedFromStatus.length > 0
          ? linkedAccountsToAdAccounts(linkedFromStatus, connectionId)
          : await fetchLinkedAdAccounts(connectionId);

      setAdAccounts(accounts);

      const storedAccountId = readStorage(
        `${LOCAL_STORAGE_KEYS.SELECTED_AD_ACCOUNT_ID}:${connectionId}`,
      );
      const serverAccountId = preferredAccountId ?? null;

      const storedMatch = storedAccountId ? findAdAccountById(accounts, storedAccountId) : undefined;
      const serverMatch = serverAccountId ? findAdAccountById(accounts, serverAccountId) : undefined;
      const candidate = serverMatch ?? storedMatch ?? accounts[0] ?? null;

      if (!candidate) {
        applyAdAccountSelection(connectionId, null, null);
        return;
      }

      applyAdAccountSelection(connectionId, candidate.id, candidate.name);

      if (!serverAccountId || !adAccountIdsMatch(candidate.id, serverAccountId)) {
        await selectAdAccount(candidate.id, connectionId);
      }
    },
    [applyAdAccountSelection],
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
        setAdAccounts([]);
        applyAdAccountSelection("", null, null);
        return;
      }

      const connectionId = nextStatus.activeConnectionId;
      setActiveConnectionId(connectionId);
      writeStorage(LOCAL_STORAGE_KEYS.ACTIVE_CONNECTION_ID, connectionId);

      const activeConnection = nextStatus.connections.find((item) => item.id === connectionId);

      await loadFirmData(
        connectionId,
        nextStatus.selectedAdAccountId,
        activeConnection?.linkedAdAccounts,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Hesap bilgileri yüklenemedi";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [applyAdAccountSelection, loadFirmData]);

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
            linkedAdAccounts:
              item.id === connectionId ? activated.linkedAdAccounts : item.linkedAdAccounts,
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
        await loadFirmData(
          connectionId,
          activated.selectedAdAccountId,
          activated.linkedAdAccounts,
        );
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

  const selectAdAccountById = useCallback(
    async (adAccountId: string) => {
      if (!activeConnectionId) return;
      const account = findAdAccountById(adAccounts, adAccountId);
      if (!account) return;

      setLoading(true);
      setError(null);
      try {
        await selectAdAccount(account.id, activeConnectionId);
        applyAdAccountSelection(activeConnectionId, account.id, account.name);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Reklam hesabı seçilemedi";
        setError(message);
        toast.error(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [activeConnectionId, adAccounts, applyAdAccountSelection],
  );

  const addAdAccountManually = useCallback(
    async (rawAdAccountId: string) => {
      if (!activeConnectionId) return;
      setLoading(true);
      setError(null);
      try {
        const result = await addLinkedAdAccount(rawAdAccountId, activeConnectionId);
        setAdAccounts(result.adAccounts);
        applyAdAccountSelection(
          activeConnectionId,
          result.selectedAdAccountId,
          result.selectedAdAccountName,
        );
        setConnections((current) =>
          current.map((item) =>
            item.id === activeConnectionId
              ? {
                  ...item,
                  linkedAdAccounts: result.adAccounts.map((account) => ({
                    id: account.id,
                    accountId: account.accountId,
                    name: account.name,
                    addedAt: item.linkedAdAccounts.find((linked) => linked.id === account.id)
                      ?.addedAt ?? new Date().toISOString(),
                  })),
                  selectedAdAccountId: result.selectedAdAccountId,
                  selectedAdAccountName: result.selectedAdAccountName,
                }
              : item,
          ),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Reklam hesabı eklenemedi";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [activeConnectionId, applyAdAccountSelection],
  );

  const retry = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  const activeConnection = useMemo(
    () => connections.find((item) => item.id === activeConnectionId) ?? null,
    [connections, activeConnectionId],
  );

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
      activeConnection,
      selectFirm,
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
      activeConnection,
      selectFirm,
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
