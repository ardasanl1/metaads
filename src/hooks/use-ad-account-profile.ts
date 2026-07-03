"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CampaignRecipeId } from "@/config/campaign-recipes";
import { getRecipeRequiredAssets } from "@/config/campaign-recipes";
import type { AccountProfileDiscoveryResult } from "@/types/ad-account-profile";
import type { SelectedMetaAssets } from "@/types/meta-assets";
import {
  discoverAdAccountProfile,
  fetchAdAccountProfile,
  saveManualAdAccountProfile,
} from "@/services/meta/client";
import { profileSourceLabel as sourceLabel } from "@/utils/profile-source-label";

type UseAdAccountProfileInput = {
  connectionId?: string;
  businessId?: string;
  adAccountId?: string;
  recipeId?: CampaignRecipeId | null;
};

export function useAdAccountProfile(input: UseAdAccountProfileInput) {
  const [discovery, setDiscovery] = useState<AccountProfileDiscoveryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef(0);
  const prevKeyRef = useRef("");

  const loadKey = useMemo(
    () => [input.connectionId ?? "", input.businessId ?? "", input.adAccountId ?? "", input.recipeId ?? ""].join(":"),
    [input.connectionId, input.businessId, input.adAccountId, input.recipeId],
  );

  const required = useMemo(() => {
    if (!input.recipeId) return { page: true, pixel: false, website: false };
    const assets = getRecipeRequiredAssets(input.recipeId);
    return {
      page: assets.some((a) => ["page", "instagram", "instantForm", "whatsapp"].includes(a)),
      pixel: assets.includes("pixel"),
      website: assets.includes("page") || input.recipeId === "SALES_WEBSITE" || input.recipeId === "TRAFFIC_WEBSITE",
    };
  }, [input.recipeId]);

  const load = useCallback(
    async (forceRefresh = false) => {
      if (!input.connectionId || !input.adAccountId) return;
      const requestId = ++requestRef.current;
      setLoading(true);
      setError("");
      try {
        if (!forceRefresh) {
          const cached = await fetchAdAccountProfile({
            connectionId: input.connectionId,
            adAccountId: input.adAccountId,
          });
          if (cached.profile?.page?.id || cached.profile?.pixel?.id || cached.profile?.website?.url) {
            if (requestId !== requestRef.current) return;
            setDiscovery({
              success: true,
              profile: {
                page: cached.profile.page
                  ? {
                      id: cached.profile.page.id,
                      name: cached.profile.page.name,
                      source: cached.profile.page.source ?? "manual",
                      confidence: (cached.profile.page.confidence ?? 40) as never,
                    }
                  : null,
                instagram: cached.profile.instagram
                  ? {
                      id: cached.profile.instagram.id,
                      username: cached.profile.instagram.username,
                      source: cached.profile.instagram.source ?? "manual",
                      confidence: (cached.profile.instagram.confidence ?? 40) as never,
                    }
                  : null,
                pixel: cached.profile.pixel
                  ? {
                      id: cached.profile.pixel.id,
                      name: cached.profile.pixel.name,
                      eventType: cached.profile.pixel.eventType,
                      source: cached.profile.pixel.source ?? "manual",
                      confidence: (cached.profile.pixel.confidence ?? 40) as never,
                    }
                  : null,
                website: cached.profile.website
                  ? {
                      url: cached.profile.website.url,
                      domain: cached.profile.website.domain ?? "",
                      source: cached.profile.website.source ?? "manual",
                      confidence: (cached.profile.website.confidence ?? 40) as never,
                    }
                  : null,
              },
              candidates: { pages: [], instagramAccounts: [], pixels: [], websites: [] },
              diagnostics: {
                directPageCount: 0,
                historicalPageCount: 0,
                directPixelCount: 0,
                historicalPixelCount: 0,
                customConversionPixelCount: 0,
                websiteCount: 0,
                adsScanned: 0,
                adSetsScanned: 0,
                creativesScanned: 0,
                fromCache: true,
                needsManualSetup: [],
              },
            });
            setLoading(false);
            return;
          }
        }

        const result = await discoverAdAccountProfile({
          connectionId: input.connectionId,
          businessId: input.businessId,
          adAccountId: input.adAccountId,
          recipeId: input.recipeId ?? undefined,
          forceRefresh,
        });
        if (requestId !== requestRef.current) return;
        setDiscovery(result);
      } catch (err) {
        if (requestId !== requestRef.current) return;
        setError(err instanceof Error ? err.message : "Profil yüklenemedi");
        setDiscovery(null);
      } finally {
        if (requestId === requestRef.current) setLoading(false);
      }
    },
    [input.connectionId, input.businessId, input.adAccountId, input.recipeId],
  );

  const applyToSelectedAssets = useCallback(
    (current: SelectedMetaAssets): SelectedMetaAssets => {
      if (!discovery?.profile) return current;
      const next = { ...current };
      const p = discovery.profile;
      if (required.page && !next.page && p.page?.id) {
        next.page = { id: p.page.id, name: p.page.name ?? p.page.id };
      }
      if (required.pixel && !next.pixel && p.pixel?.id) {
        next.pixel = { id: p.pixel.id, name: p.pixel.name ?? p.pixel.id };
      }
      if (required.website && !next.page && p.page?.id) {
        // website handled separately in creative.destinationUrl
      }
      if (!next.instagram && p.instagram?.id) {
        next.instagram = {
          id: p.instagram.id,
          username: p.instagram.username,
          name: p.instagram.username,
        };
      }
      return next;
    },
    [discovery, required],
  );

  const saveManual = useCallback(
    async (manual: {
      pageIdOrUrl?: string;
      pixelId?: string;
      websiteUrl?: string;
      instagramId?: string;
    }) => {
      if (!input.connectionId || !input.adAccountId) return;
      const result = await saveManualAdAccountProfile({
        connectionId: input.connectionId,
        businessId: input.businessId,
        adAccountId: input.adAccountId,
        ...manual,
      });
      setDiscovery(result);
      return result;
    },
    [input.connectionId, input.businessId, input.adAccountId],
  );

  useEffect(() => {
    if (prevKeyRef.current && prevKeyRef.current !== loadKey) {
      setDiscovery(null);
    }
    prevKeyRef.current = loadKey;
  }, [loadKey]);

  useEffect(() => {
    if (!input.connectionId || !input.adAccountId || !input.recipeId) return;
    void load(false);
  }, [loadKey, load, input.connectionId, input.adAccountId, input.recipeId]);

  const needsManualSetup = discovery?.diagnostics.needsManualSetup ?? [];
  const needsManualForm =
    needsManualSetup.includes("page") ||
    needsManualSetup.includes("pixel") ||
    needsManualSetup.includes("website");

  const pageOptions = discovery?.candidates.pages ?? [];
  const pixelOptions = discovery?.candidates.pixels ?? [];
  const websiteOptions = discovery?.candidates.websites ?? [];

  return {
    discovery,
    loading,
    error,
    required,
    needsManualSetup,
    needsManualForm,
    pageOptions,
    pixelOptions,
    websiteOptions,
    sourceLabel,
    reload: () => load(true),
    saveManual,
    applyToSelectedAssets,
    defaultWebsiteUrl: discovery?.profile.website?.url,
    defaultPixelEvent: discovery?.profile.pixel?.eventType,
  };
}
