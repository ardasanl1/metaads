import "server-only";

import { getRecipeRequiredAssets } from "@/config/campaign-recipes";
import {
  buildSnapshotCacheKey,
  CACHE_TTL_MS,
  getCachedSnapshot,
  setCachedSnapshot,
} from "@/lib/account-snapshot-cache";
import { getMetaConnectionById } from "@/lib/db";
import {
  ensureMetaBusinessId,
  getAdAccountInfo,
  getAppsForAdAccount,
  getCatalogsForAdAccount,
  getFacebookPageOptions,
  getInstagramAccountsForPage,
  getLeadGenFormsForPage,
  getPixelsForAdAccount,
  getProductSetsForCatalog,
  getWhatsAppAccountsForPage,
  getMetaAssetDiagnostics,
} from "@/lib/meta";
import type { AccountSnapshot } from "@/types/meta-assets";
import type {
  MetaAppOption,
  MetaCatalogOption,
  MetaInstagramOption,
  MetaInstantFormOption,
  MetaPageOption,
  MetaPixelOption,
  MetaProductSetOption,
  MetaWhatsAppOption,
  SelectedMetaAssets,
} from "@/types/meta-assets";

export type FetchAccountSnapshotInput = {
  connectionId: string;
  businessId?: string;
  adAccountId: string;
  recipeId: string;
  pageId?: string;
  refresh?: boolean;
};

function autoSelectFromSnapshot(input: {
  pages: MetaPageOption[];
  pixels: MetaPixelOption[];
  instagramAccounts: MetaInstagramOption[];
  instantForms: MetaInstantFormOption[];
  whatsappAccounts: MetaWhatsAppOption[];
  catalogs: MetaCatalogOption[];
  productSets: MetaProductSetOption[];
  apps: MetaAppOption[];
}): SelectedMetaAssets | undefined {
  const selected: SelectedMetaAssets = {};
  let hasAny = false;

  if (input.pages.length === 1) {
    selected.page = { id: input.pages[0].id, name: input.pages[0].name };
    hasAny = true;
  }
  const availablePixels = input.pixels.filter((pixel) => pixel.available);
  if (availablePixels.length === 1) {
    selected.pixel = { id: availablePixels[0].id, name: availablePixels[0].name };
    hasAny = true;
  }
  if (input.instagramAccounts.length === 1) {
    const ig = input.instagramAccounts[0];
    selected.instagram = { id: ig.id, username: ig.username, name: ig.name };
    hasAny = true;
  }
  if (input.instantForms.length === 1) {
    selected.instantForm = { id: input.instantForms[0].id, name: input.instantForms[0].name };
    hasAny = true;
  }
  if (input.whatsappAccounts.length === 1) {
    selected.whatsapp = { id: input.whatsappAccounts[0].id, name: input.whatsappAccounts[0].name };
    hasAny = true;
  }
  if (input.catalogs.length === 1) {
    selected.catalog = { id: input.catalogs[0].id, name: input.catalogs[0].name };
    hasAny = true;
  }
  if (input.productSets.length === 1) {
    selected.productSet = {
      id: input.productSets[0].id,
      name: input.productSets[0].name,
    };
    hasAny = true;
  }
  if (input.apps.length === 1) {
    selected.app = { id: input.apps[0].id, name: input.apps[0].name };
    hasAny = true;
  }

  return hasAny ? selected : undefined;
}

export async function fetchAccountSnapshot(
  input: FetchAccountSnapshotInput,
): Promise<AccountSnapshot> {
  const cacheKey = buildSnapshotCacheKey(input);
  if (!input.refresh) {
    const cached = getCachedSnapshot<AccountSnapshot>(cacheKey);
    if (cached) return cached;
  }

  const required = getRecipeRequiredAssets(input.recipeId);
  const connection = await getMetaConnectionById(input.connectionId);
  if (!connection) {
    throw new Error("Meta bağlantısı bulunamadı");
  }

  const businessId =
    input.businessId?.trim() ||
    connection.metaBusinessId?.trim() ||
    (await ensureMetaBusinessId(connection.id)) ||
    undefined;

  const pages: MetaPageOption[] = [];
  const pixels: MetaPixelOption[] = [];
  const instagramAccounts: MetaInstagramOption[] = [];
  const instantForms: MetaInstantFormOption[] = [];
  const whatsappAccounts: MetaWhatsAppOption[] = [];
  const catalogs: MetaCatalogOption[] = [];
  const productSets: MetaProductSetOption[] = [];
  const apps: MetaAppOption[] = [];

  let adAccount: AccountSnapshot["adAccount"];
  if (required.length > 0) {
    adAccount = await getAdAccountInfo(input.adAccountId, { connectionId: input.connectionId });
  }

  const needsPage = required.some((asset) =>
    ["page", "instagram", "instantForm", "whatsapp"].includes(asset),
  );
  if (needsPage) {
    const pageResult = await getFacebookPageOptions({
      connectionId: input.connectionId,
      adAccountId: input.adAccountId,
      businessId,
    });
    pages.push(...pageResult.pages);
  }

  if (required.includes("pixel")) {
    const pixelResult = await getPixelsForAdAccount({
      connectionId: input.connectionId,
      adAccountId: input.adAccountId,
      businessId,
    });
    pixels.push(...pixelResult.pixels);
  }

  const pageIdForBound =
    input.pageId?.trim() || (pages.length === 1 ? pages[0].id : undefined);

  if (pageIdForBound && required.includes("instagram")) {
    const pageName = pages.find((page) => page.id === pageIdForBound)?.name;
    instagramAccounts.push(
      ...(await getInstagramAccountsForPage(pageIdForBound, {
        connectionId: input.connectionId,
        pageName,
      })),
    );
  }

  if (pageIdForBound && required.includes("instantForm")) {
    instantForms.push(
      ...(await getLeadGenFormsForPage(pageIdForBound, { connectionId: input.connectionId })),
    );
  }

  if (pageIdForBound && required.includes("whatsapp")) {
    whatsappAccounts.push(
      ...(await getWhatsAppAccountsForPage(pageIdForBound, { connectionId: input.connectionId })),
    );
  }

  if (required.includes("catalog")) {
    catalogs.push(
      ...(await getCatalogsForAdAccount({
        connectionId: input.connectionId,
        adAccountId: input.adAccountId,
        businessId,
      })),
    );
  }

  const catalogIdForSets =
    catalogs.length === 1 ? catalogs[0].id : undefined;
  if (required.includes("productSet") && catalogIdForSets) {
    productSets.push(
      ...(await getProductSetsForCatalog(catalogIdForSets, { connectionId: input.connectionId })),
    );
  }

  if (required.includes("app")) {
    apps.push(
      ...(await getAppsForAdAccount({
        connectionId: input.connectionId,
        adAccountId: input.adAccountId,
      })),
    );
  }

  const diagnostics = await getMetaAssetDiagnostics({
    connectionId: input.connectionId,
    businessId,
    adAccountId: input.adAccountId,
    pageId: pageIdForBound,
  });

  const snapshot: AccountSnapshot = {
    adAccount,
    pages,
    instagramAccounts,
    pixels,
    instantForms,
    whatsappAccounts,
    catalogs,
    productSets,
    apps,
    diagnostics,
    autoSelected: autoSelectFromSnapshot({
      pages,
      pixels,
      instagramAccounts,
      instantForms,
      whatsappAccounts,
      catalogs,
      productSets,
      apps,
    }),
    cachedAt: new Date().toISOString(),
    recipeId: input.recipeId,
  };

  setCachedSnapshot(cacheKey, snapshot, CACHE_TTL_MS.pages);
  return snapshot;
}

export async function fetchPageBoundSnapshotAssets(input: {
  connectionId: string;
  recipeId: string;
  pageId: string;
  pageName?: string;
}): Promise<Pick<AccountSnapshot, "instagramAccounts" | "instantForms" | "whatsappAccounts">> {
  const required = getRecipeRequiredAssets(input.recipeId);
  const instagramAccounts: MetaInstagramOption[] = [];
  const instantForms: MetaInstantFormOption[] = [];
  const whatsappAccounts: MetaWhatsAppOption[] = [];

  if (required.includes("instagram")) {
    instagramAccounts.push(
      ...(await getInstagramAccountsForPage(input.pageId, {
        connectionId: input.connectionId,
        pageName: input.pageName,
      })),
    );
  }
  if (required.includes("instantForm")) {
    instantForms.push(
      ...(await getLeadGenFormsForPage(input.pageId, { connectionId: input.connectionId })),
    );
  }
  if (required.includes("whatsapp")) {
    whatsappAccounts.push(
      ...(await getWhatsAppAccountsForPage(input.pageId, { connectionId: input.connectionId })),
    );
  }

  return { instagramAccounts, instantForms, whatsappAccounts };
}
