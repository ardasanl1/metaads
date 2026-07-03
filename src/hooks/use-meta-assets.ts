"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  MetaAssetDiagnostics,
  MetaInstagramOption,
  MetaPageOption,
  MetaPixelOption,
  SelectedMetaAssets,
} from "@/types/meta-assets";
import { formatPageOptionLabel } from "@/utils/meta-page";
import {
  fetchInstagramAccounts,
  fetchMetaAssetDiagnostics,
  fetchPages,
  fetchPixelsDetailed,
} from "@/services/meta/client";

type UseMetaAssetsInput = {
  connectionId?: string;
  businessId?: string;
  adAccountId?: string;
  recipeId: string;
  pageId?: string;
};

type UseMetaAssetsResult = {
  pages: MetaPageOption[];
  pixels: MetaPixelOption[];
  instagramAccounts: MetaInstagramOption[];
  diagnostics: MetaAssetDiagnostics | null;
  pagesLoading: boolean;
  pixelsLoading: boolean;
  instagramLoading: boolean;
  pagesHint: string;
  pixelsHint: string;
  instagramHint: string;
  selectedAssets: SelectedMetaAssets;
  setSelectedAssets: React.Dispatch<React.SetStateAction<SelectedMetaAssets>>;
  applyAutoSelections: () => void;
  reloadPages: () => Promise<void>;
  reloadPixels: () => Promise<void>;
  reloadInstagram: () => Promise<void>;
};

function assetsLoadKey(input: UseMetaAssetsInput): string {
  return [input.connectionId ?? "", input.adAccountId ?? "", input.recipeId].join(":");
}

export function useMetaAssets(input: UseMetaAssetsInput): UseMetaAssetsResult {
  const [pages, setPages] = useState<MetaPageOption[]>([]);
  const [pixels, setPixels] = useState<MetaPixelOption[]>([]);
  const [instagramAccounts, setInstagramAccounts] = useState<MetaInstagramOption[]>([]);
  const [diagnostics, setDiagnostics] = useState<MetaAssetDiagnostics | null>(null);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [pixelsLoading, setPixelsLoading] = useState(false);
  const [instagramLoading, setInstagramLoading] = useState(false);
  const [pagesHint, setPagesHint] = useState("");
  const [pixelsHint, setPixelsHint] = useState("");
  const [instagramHint, setInstagramHint] = useState("");
  const [selectedAssets, setSelectedAssets] = useState<SelectedMetaAssets>({});

  const pagesRequestRef = useRef(0);
  const pixelsRequestRef = useRef(0);
  const instagramRequestRef = useRef(0);
  const prevConnectionRef = useRef<string | undefined>(undefined);
  const prevBusinessRef = useRef<string | undefined>(undefined);
  const prevAdAccountRef = useRef<string | undefined>(undefined);
  const prevPageRef = useRef<string | undefined>(undefined);

  const loadKey = useMemo(() => assetsLoadKey(input), [input.connectionId, input.adAccountId, input.recipeId]);

  const applyAutoSelections = useCallback(() => {
    setSelectedAssets((current) => {
      const next = { ...current };
      const availablePixels = pixels.filter((pixel) => pixel.available);

      if (!next.page && pages.length === 1) {
        next.page = { id: pages[0].id, name: formatPageOptionLabel(pages[0]) };
      }
      if (!next.pixel && availablePixels.length === 1) {
        next.pixel = { id: availablePixels[0].id, name: availablePixels[0].name };
      }
      if (!next.instagram && instagramAccounts.length === 1) {
        const ig = instagramAccounts[0];
        next.instagram = { id: ig.id, username: ig.username, name: ig.name };
      }
      return next;
    });
  }, [pages, pixels, instagramAccounts]);

  const reloadPages = useCallback(async () => {
    if (!input.connectionId || !input.adAccountId) return;
    const requestId = ++pagesRequestRef.current;
    setPagesLoading(true);
    setPagesHint("");
    try {
      const { pages: nextPages, diagnostics: pageDiagnostics } = await fetchPages({
        connectionId: input.connectionId,
        adAccountId: input.adAccountId,
      });
      if (requestId !== pagesRequestRef.current) return;
      setPages(nextPages);
      if (nextPages.length === 0) {
        setPagesHint(pageDiagnostics?.reason ?? "");
      }
      if (nextPages.length === 1) {
        setSelectedAssets((current) =>
          current.page
            ? current
            : { ...current, page: { id: nextPages[0].id, name: formatPageOptionLabel(nextPages[0]) } },
        );
      }
    } catch (error) {
      if (requestId !== pagesRequestRef.current) return;
      setPages([]);
      setPagesHint(error instanceof Error ? error.message : "Page listesi alınamadı");
    } finally {
      if (requestId === pagesRequestRef.current) setPagesLoading(false);
    }
  }, [input.connectionId, input.adAccountId]);

  const reloadPixels = useCallback(async () => {
    if (!input.connectionId || !input.adAccountId) return;
    const requestId = ++pixelsRequestRef.current;
    setPixelsLoading(true);
    setPixelsHint("");
    try {
      const { pixels: nextPixels, diagnostics: pixelDiagnostics } = await fetchPixelsDetailed({
        connectionId: input.connectionId,
        adAccountId: input.adAccountId,
      });
      if (requestId !== pixelsRequestRef.current) return;
      setPixels(nextPixels);
      if (nextPixels.length === 0) {
        setPixelsHint(pixelDiagnostics.reason ?? pixelDiagnostics.detail ?? "");
        setSelectedAssets((current) => {
          const next = { ...current };
          delete next.pixel;
          return next;
        });
      } else if (nextPixels.length === 1) {
        setSelectedAssets((current) =>
          current.pixel
            ? current
            : { ...current, pixel: { id: nextPixels[0].id, name: nextPixels[0].name } },
        );
      } else {
        setSelectedAssets((current) => {
          if (!current.pixel) return current;
          const stillValid = nextPixels.some((pixel) => pixel.id === current.pixel?.id);
          if (stillValid) return current;
          const next = { ...current };
          delete next.pixel;
          return next;
        });
      }
    } catch (error) {
      if (requestId !== pixelsRequestRef.current) return;
      setPixels([]);
      setPixelsHint(error instanceof Error ? error.message : "Pixel listesi alınamadı");
    } finally {
      if (requestId === pixelsRequestRef.current) setPixelsLoading(false);
    }
  }, [input.connectionId, input.adAccountId]);

  const reloadInstagram = useCallback(async () => {
    if (!input.pageId) {
      setInstagramAccounts([]);
      setInstagramHint("");
      setSelectedAssets((current) => {
        const next = { ...current };
        delete next.instagram;
        return next;
      });
      return;
    }

    const requestId = ++instagramRequestRef.current;
    setInstagramLoading(true);
    setInstagramHint("");
    try {
      const pageName = pages.find((page) => page.id === input.pageId);
      const accounts = await fetchInstagramAccounts(input.pageId, {
        connectionId: input.connectionId,
        pageName: pageName ? formatPageOptionLabel(pageName) : undefined,
      });
      if (requestId !== instagramRequestRef.current) return;
      setInstagramAccounts(accounts);
      if (accounts.length === 0) {
        setInstagramHint("Seçilen Page'e bağlı Instagram hesabı bulunamadı");
        setSelectedAssets((current) => {
          const next = { ...current };
          delete next.instagram;
          return next;
        });
      } else if (accounts.length === 1) {
        const ig = accounts[0];
        setSelectedAssets((current) => ({
          ...current,
          instagram: { id: ig.id, username: ig.username, name: ig.name },
        }));
      } else {
        setSelectedAssets((current) => {
          if (!current.instagram) return current;
          const stillValid = accounts.some((account) => account.id === current.instagram?.id);
          if (stillValid) return current;
          const next = { ...current };
          delete next.instagram;
          return next;
        });
      }
    } catch (error) {
      if (requestId !== instagramRequestRef.current) return;
      setInstagramAccounts([]);
      setInstagramHint(error instanceof Error ? error.message : "Instagram hesapları alınamadı");
    } finally {
      if (requestId === instagramRequestRef.current) setInstagramLoading(false);
    }
  }, [input.pageId, input.connectionId, pages]);

  useEffect(() => {
    if (prevConnectionRef.current && prevConnectionRef.current !== input.connectionId) {
      setSelectedAssets({});
      setPages([]);
      setPixels([]);
      setInstagramAccounts([]);
    }
    prevConnectionRef.current = input.connectionId;
  }, [input.connectionId]);

  useEffect(() => {
    const previous = prevBusinessRef.current;
    if (previous && input.businessId && previous !== input.businessId) {
      setSelectedAssets((current) => {
        const next = { ...current };
        delete next.page;
        delete next.instagram;
        delete next.pixel;
        delete next.catalog;
        delete next.instantForm;
        return next;
      });
    }
    prevBusinessRef.current = input.businessId;
  }, [input.businessId]);

  useEffect(() => {
    if (prevAdAccountRef.current && prevAdAccountRef.current !== input.adAccountId) {
      setSelectedAssets((current) => {
        const next = { ...current };
        delete next.pixel;
        delete next.instagram;
        delete next.catalog;
        return next;
      });
    }
    prevAdAccountRef.current = input.adAccountId;
  }, [input.adAccountId]);

  useEffect(() => {
    if (prevPageRef.current && prevPageRef.current !== input.pageId) {
      setSelectedAssets((current) => {
        const next = { ...current };
        delete next.instagram;
        delete next.instantForm;
        return next;
      });
    }
    prevPageRef.current = input.pageId;
  }, [input.pageId]);

  useEffect(() => {
    if (!input.connectionId || !input.adAccountId) return;
    void reloadPages();
    void reloadPixels();
  }, [loadKey, input.connectionId, input.adAccountId, reloadPages, reloadPixels]);

  useEffect(() => {
    void reloadInstagram();
  }, [reloadInstagram]);

  useEffect(() => {
    if (!input.connectionId || !input.adAccountId) return;
    void fetchMetaAssetDiagnostics({
      connectionId: input.connectionId,
      businessId: input.businessId,
      adAccountId: input.adAccountId,
      pageId: input.pageId,
    })
      .then(setDiagnostics)
      .catch(() => setDiagnostics(null));
  }, [input.connectionId, input.businessId, input.adAccountId, input.pageId]);

  return {
    pages,
    pixels,
    instagramAccounts,
    diagnostics,
    pagesLoading,
    pixelsLoading,
    instagramLoading,
    pagesHint,
    pixelsHint,
    instagramHint,
    selectedAssets,
    setSelectedAssets,
    applyAutoSelections,
    reloadPages,
    reloadPixels,
    reloadInstagram,
  };
}
