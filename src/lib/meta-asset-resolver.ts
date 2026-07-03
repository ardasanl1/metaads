import "server-only";

import { getCampaignRecipe, getRecipeRequiredAssets } from "@/config/campaign-recipes";
import { getMetaConnectionById } from "@/lib/db";
import {
  ensureMetaBusinessId,
  getFacebookPageOptions,
  getInstagramAccountsForPage,
  getMetaAssetDiagnostics,
  getPixelsForAdAccount,
  searchMetaLocationOptions,
} from "@/lib/meta";
import type {
  MetaAssetKind,
  MetaInstagramOption,
  MetaLocationOption,
  MetaPageOption,
  MetaPixelOption,
  ResolveMetaAssetsInput,
  ResolvedMetaAssets,
  SelectedMetaAssets,
} from "@/types/meta-assets";

const RECIPE_REQUIRED_ASSETS: Record<string, MetaAssetKind[]> = {
  SALES_WEBSITE: ["location", "page", "pixel"],
  website_sales: ["location", "page", "pixel"],
};

function getRequiredAssets(recipeId: string): MetaAssetKind[] {
  return getRecipeRequiredAssets(recipeId).length > 0
    ? getRecipeRequiredAssets(recipeId)
    : RECIPE_REQUIRED_ASSETS[recipeId] ?? [];
}

function autoSelectAssets(input: {
  recipeId: string;
  pages: MetaPageOption[];
  pixels: MetaPixelOption[];
  instagramAccounts: MetaInstagramOption[];
  location?: MetaLocationOption;
}): SelectedMetaAssets | undefined {
  const selected: SelectedMetaAssets = {};
  let hasAny = false;

  if (input.location) {
    selected.location = {
      key: input.location.key,
      type: input.location.type,
      displayName: input.location.displayName,
      countryCode: input.location.countryCode,
    };
    hasAny = true;
  }

  const availablePixels = input.pixels.filter((p) => p.available);
  if (availablePixels.length === 1) {
    selected.pixel = { id: availablePixels[0].id, name: availablePixels[0].name };
    hasAny = true;
  }

  if (input.pages.length === 1) {
    selected.page = { id: input.pages[0].id, name: input.pages[0].name };
    hasAny = true;
  }

  if (input.instagramAccounts.length === 1) {
    const ig = input.instagramAccounts[0];
    selected.instagram = { id: ig.id, username: ig.username, name: ig.name };
    hasAny = true;
  }

  return hasAny ? selected : undefined;
}

export async function resolveMetaAssets(
  input: ResolveMetaAssetsInput,
): Promise<ResolvedMetaAssets> {
  const required = getRequiredAssets(input.recipeId);
  const connection = await getMetaConnectionById(input.connectionId);
  if (!connection) {
    const diagnostics = await getMetaAssetDiagnostics({
      connectionId: input.connectionId,
      adAccountId: input.adAccountId,
    });
    diagnostics.adAccount.reason = "Meta bağlantısı bulunamadı";
    return {
      locations: [],
      pages: [],
      instagramAccounts: [],
      pixels: [],
      instantForms: [],
      whatsappAccounts: [],
      catalogs: [],
      productSets: [],
      apps: [],
      diagnostics,
    };
  }

  const businessId =
    input.businessId?.trim() ||
    connection.metaBusinessId?.trim() ||
    (await ensureMetaBusinessId(connection.id)) ||
    undefined;

  const locations: MetaLocationOption[] = [];
  const pages: MetaPageOption[] = [];
  const instagramAccounts: MetaInstagramOption[] = [];
  const pixels: MetaPixelOption[] = [];

  if (required.includes("location") && input.locationQuery?.trim()) {
    locations.push(
      ...(await searchMetaLocationOptions({
        query: input.locationQuery,
        countryCode: input.countryCode,
        connectionId: input.connectionId,
      })),
    );
  }

  if (required.includes("page") || required.includes("instagram")) {
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

  const pageIdForIg =
    input.pageId?.trim() ||
    (pages.length === 1 ? pages[0].id : undefined);

  if (pageIdForIg) {
    const pageName = pages.find((p) => p.id === pageIdForIg)?.name;
    const ig = await getInstagramAccountsForPage(pageIdForIg, {
      connectionId: input.connectionId,
      pageName,
    });
    instagramAccounts.push(...ig);
  }

  const diagnostics = await getMetaAssetDiagnostics({
    connectionId: input.connectionId,
    businessId,
    adAccountId: input.adAccountId,
    pageId: pageIdForIg,
    locationQuery: input.locationQuery,
    countryCode: input.countryCode,
  });

  const autoSelected = autoSelectAssets({
    recipeId: input.recipeId,
    pages,
    pixels,
    instagramAccounts,
    location: locations.length === 1 ? locations[0] : undefined,
  });

  return {
    locations,
    pages,
    instagramAccounts,
    pixels,
    instantForms: [],
    whatsappAccounts: [],
    catalogs: [],
    productSets: [],
    apps: [],
    diagnostics,
    autoSelected,
  };
}

export function getRecipeConversionEvent(recipeId: string): string | null {
  const recipe = getCampaignRecipe(recipeId);
  return recipe?.conversionEvent ?? null;
}
