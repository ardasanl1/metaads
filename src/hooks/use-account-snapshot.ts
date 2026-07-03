"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CampaignRecipeId } from "@/config/campaign-recipes";
import { recipeNeedsPageBoundAssets } from "@/services/campaign-planner";
import type { AccountSnapshot, SelectedMetaAssets } from "@/types/meta-assets";
import { fetchAccountSnapshot, fetchPageBoundAssets } from "@/services/meta/client";
import { formatPageOptionLabel } from "@/utils/meta-page";

type UseAccountSnapshotInput = {
  connectionId?: string;
  businessId?: string;
  adAccountId?: string;
  recipeId?: CampaignRecipeId | null;
  pageId?: string;
};

type UseAccountSnapshotResult = {
  snapshot: AccountSnapshot | null;
  loading: boolean;
  error: string;
  selectedAssets: SelectedMetaAssets;
  setSelectedAssets: React.Dispatch<React.SetStateAction<SelectedMetaAssets>>;
  reload: () => Promise<void>;
  reloadPageBound: (pageId: string, pageName?: string) => Promise<void>;
};

function snapshotKey(input: UseAccountSnapshotInput): string {
  return [
    input.connectionId ?? "",
    input.businessId ?? "",
    input.adAccountId ?? "",
    input.recipeId ?? "",
  ].join(":");
}

export function useAccountSnapshot(input: UseAccountSnapshotInput): UseAccountSnapshotResult {
  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedAssets, setSelectedAssets] = useState<SelectedMetaAssets>({});
  const requestRef = useRef(0);
  const prevKeyRef = useRef("");

  const loadKey = useMemo(() => snapshotKey(input), [input.connectionId, input.businessId, input.adAccountId, input.recipeId]);

  const applyAutoSelections = useCallback((nextSnapshot: AccountSnapshot) => {
    if (!nextSnapshot.autoSelected) return;
    setSelectedAssets((current) => {
      const merged = { ...current };
      const auto = nextSnapshot.autoSelected!;
      if (!merged.page && auto.page) merged.page = auto.page;
      if (!merged.pixel && auto.pixel) merged.pixel = auto.pixel;
      if (!merged.instagram && auto.instagram) merged.instagram = auto.instagram;
      if (!merged.instantForm && auto.instantForm) merged.instantForm = auto.instantForm;
      if (!merged.whatsapp && auto.whatsapp) merged.whatsapp = auto.whatsapp;
      if (!merged.catalog && auto.catalog) merged.catalog = auto.catalog;
      if (!merged.productSet && auto.productSet) merged.productSet = auto.productSet;
      if (!merged.app && auto.app) merged.app = auto.app;
      return merged;
    });
  }, []);

  const reload = useCallback(async (refresh = false) => {
    if (!input.connectionId || !input.adAccountId || !input.recipeId) return;
    const requestId = ++requestRef.current;
    setLoading(true);
    setError("");
    try {
      const next = await fetchAccountSnapshot({
        connectionId: input.connectionId,
        businessId: input.businessId,
        adAccountId: input.adAccountId,
        recipeId: input.recipeId,
        pageId: input.pageId,
        refresh,
      });
      if (requestId !== requestRef.current) return;
      setSnapshot(next);
      applyAutoSelections(next);
    } catch (err) {
      if (requestId !== requestRef.current) return;
      setSnapshot(null);
      setError(err instanceof Error ? err.message : "Hesap verisi alınamadı");
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [input.connectionId, input.businessId, input.adAccountId, input.recipeId, input.pageId, applyAutoSelections]);

  const reloadPageBound = useCallback(
    async (pageId: string, pageName?: string) => {
      if (!input.connectionId || !input.recipeId) return;
      try {
        const bound = await fetchPageBoundAssets({
          connectionId: input.connectionId,
          recipeId: input.recipeId,
          pageId,
          pageName,
        });
        setSnapshot((current) =>
          current
            ? {
                ...current,
                instagramAccounts: bound.instagramAccounts,
                instantForms: bound.instantForms,
                whatsappAccounts: bound.whatsappAccounts,
              }
            : current,
        );

        if (bound.instagramAccounts.length === 1) {
          const ig = bound.instagramAccounts[0];
          setSelectedAssets((current) => ({
            ...current,
            instagram: { id: ig.id, username: ig.username, name: ig.name },
          }));
        }
        if (bound.instantForms.length === 1) {
          setSelectedAssets((current) => ({
            ...current,
            instantForm: { id: bound.instantForms[0].id, name: bound.instantForms[0].name },
          }));
        }
        if (bound.whatsappAccounts.length === 1) {
          setSelectedAssets((current) => ({
            ...current,
            whatsapp: { id: bound.whatsappAccounts[0].id, name: bound.whatsappAccounts[0].name },
          }));
        }
      } catch {
        // keep existing snapshot
      }
    },
    [input.connectionId, input.recipeId],
  );

  useEffect(() => {
    if (prevKeyRef.current && prevKeyRef.current !== loadKey) {
      setSelectedAssets({});
      setSnapshot(null);
    }
    prevKeyRef.current = loadKey;
  }, [loadKey]);

  useEffect(() => {
    if (!input.connectionId || !input.adAccountId || !input.recipeId) return;
    void reload(false);
  }, [loadKey, reload, input.connectionId, input.adAccountId, input.recipeId]);

  useEffect(() => {
    if (!input.pageId || !input.recipeId || !recipeNeedsPageBoundAssets(input.recipeId)) return;
    const pageName = snapshot?.pages.find((page) => page.id === input.pageId);
    void reloadPageBound(
      input.pageId,
      pageName ? formatPageOptionLabel(pageName) : undefined,
    );
  }, [input.pageId, input.recipeId, reloadPageBound, snapshot?.pages]);

  return {
    snapshot,
    loading,
    error,
    selectedAssets,
    setSelectedAssets,
    reload: () => reload(true),
    reloadPageBound,
  };
}
