import "server-only";

import { getCampaignRecipe, getRecipeRequiredAssets } from "@/config/campaign-recipes";
import { getMetaConnectionById } from "@/lib/db";
import {
  ensureMetaBusinessId,
  getInstagramAccountsForPage,
  searchMetaLocationOptions,
} from "@/lib/meta";
import { resolveFacebookPages } from "@/lib/meta-page-resolver";
import { resolveAdAccountPixels } from "@/lib/meta-pixel-resolver";
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
      diagnostics: {
        adAccount: { accessible: false, reason: "Meta bağlantısı bulunamadı" },
        locations: { available: false },
        pages: { requestSucceeded: false, count: 0, reason: "Meta bağlantısı bulunamadı" },
        instagram: { requestSucceeded: false, count: 0 },
        pixels: { requestSucceeded: false, count: 0, reason: "Meta bağlantısı bulunamadı" },
        missingPermissions: [],
      },
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

  let pageDiagnosticReason: string | undefined;
  let pixelDiagnosticReason: string | undefined;
  let pageRequestSucceeded = false;
  let pixelRequestSucceeded = false;

  if (required.includes("page") || required.includes("instagram")) {
    const pageResult = await resolveFacebookPages({
      connectionId: input.connectionId,
      adAccountId: input.adAccountId,
      businessId,
    });
    pages.push(...pageResult.pages);
    pageRequestSucceeded = pageResult.success;
    pageDiagnosticReason = pageResult.diagnostic.reason;
  }

  if (required.includes("pixel")) {
    const pixelResult = await resolveAdAccountPixels({
      connectionId: input.connectionId,
      adAccountId: input.adAccountId,
    });
    pixels.push(...pixelResult.pixels);
    pixelRequestSucceeded = pixelResult.success;
    pixelDiagnosticReason = pixelResult.diagnostic.reason;
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

  const diagnostics: ResolvedMetaAssets["diagnostics"] = {
    adAccount: { accessible: true, normalizedId: input.adAccountId },
    locations: {
      available: locations.length > 0 || !input.locationQuery?.trim(),
      reason: locations.length === 0 && input.locationQuery?.trim() ? "Konum bulunamadı" : undefined,
    },
    pages: {
      requestSucceeded: pageRequestSucceeded,
      count: pages.length,
      reason: pages.length === 0 ? pageDiagnosticReason : undefined,
    },
    instagram: {
      requestSucceeded: true,
      count: instagramAccounts.length,
    },
    pixels: {
      requestSucceeded: pixelRequestSucceeded,
      count: pixels.length,
      reason: pixels.length === 0 ? pixelDiagnosticReason : undefined,
    },
    missingPermissions: [],
  };

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
