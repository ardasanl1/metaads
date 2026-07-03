import "server-only";

import { addLinkedAdAccount, getMetaConnectionById, updateMetaBusinessProfile } from "@/lib/db";
import { getTokenCapabilityDiagnostics } from "@/lib/meta-connection-context";
import { debugMetaToken } from "@/lib/meta-oauth";
import { graphBaseUrl, metaRequest } from "@/lib/meta";
import {
  filterUsable,
  listSyncedAdAccounts,
  listSyncedBusinesses,
  listSyncedInstagramAccounts,
  listSyncedPages,
  listSyncedPixels,
  replaceConnectionAssetSnapshot,
} from "@/lib/meta-asset-sync-db";
import { normalizeAdAccountId, normalizeAdAccountRecord } from "@/utils/ad-account";
import type { AdAccountRaw } from "@/utils/ad-account";
import type {
  MetaAssetSyncReport,
  MetaAssetUsability,
  OnboardingOptions,
} from "@/types/meta-asset-sync";
import { getAdAccountProfile } from "@/lib/ad-account-profile-db";

type Paged<T> = { data?: T[]; paging?: { next?: string } };

async function fetchPaged<T>(
  initialPath: string,
  token: string,
  connectionId: string,
  max = 200,
): Promise<T[]> {
  const baseUrl = graphBaseUrl();
  let nextPath: string | null = initialPath;
  const results: T[] = [];
  while (nextPath && results.length < max) {
    const batch: Paged<T> = await metaRequest<Paged<T>>(nextPath, { token, connectionId });
    if (batch.data?.length) results.push(...batch.data);
    if (batch.paging?.next && results.length < max) {
      nextPath = batch.paging.next.replace(`${baseUrl}/`, "");
    } else {
      nextPath = null;
    }
  }
  return results.slice(0, max);
}

function pageTasksUsable(tasks?: string[]): boolean {
  if (!tasks?.length) return true;
  return tasks.some((t) => ["ADVERTISE", "MANAGE", "CREATE_CONTENT"].includes(t.toUpperCase()));
}

function granularHasTarget(
  granularScopes: Array<{ scope: string; target_ids?: string[] }> | undefined,
  scope: string,
  targetId: string,
): boolean | null {
  if (!granularScopes?.length) return null;
  const row = granularScopes.find((g) => g.scope === scope);
  if (!row) return null;
  if (!row.target_ids?.length) return true;
  return row.target_ids.includes(targetId);
}

export async function syncMetaConnectionAssets(connectionId: string): Promise<MetaAssetSyncReport> {
  const connection = await getMetaConnectionById(connectionId);
  if (!connection?.accessToken) {
    throw new Error("Meta baglantisi bulunamadi");
  }

  const token = connection.accessToken;
  const syncedAt = new Date().toISOString();
  const errors: string[] = [];
  const unassignedAssets: MetaAssetSyncReport["unassignedAssets"] = [];
  const granularIssues: string[] = [];

  const diagnostics = await getTokenCapabilityDiagnostics({
    connectionId,
    accessToken: token,
    metaUserId: connection.metaUserId ?? undefined,
    selectedAdAccountId: connection.selectedAdAccountId ?? undefined,
  });

  const debug = await debugMetaToken(token);
  if (!debug.isValid) {
    return {
      connectionId,
      syncedAt,
      grantedPermissions: diagnostics.grantedPermissions,
      missingPermissions: diagnostics.missingPermissions,
      granularIssues: [debug.error ?? "Token gecersiz"],
      counts: {
        businesses: 0,
        adAccounts: 0,
        pages: 0,
        instagramAccounts: 0,
        pixels: 0,
        usablePages: 0,
        usablePixels: 0,
      },
      unassignedAssets: [],
      errors: [debug.error ?? "Token gecersiz veya suresi dolmus"],
    };
  }

  const businesses: Array<{
    metaBusinessId: string;
    name: string;
    usability: MetaAssetUsability;
    discoverySource: string;
    lastSyncedAt: string;
  }> = [];

  const adAccounts: Array<{
    metaAdAccountId: string;
    accountId: string;
    name: string;
    businessId?: string;
    usability: MetaAssetUsability;
    discoverySource: string;
    lastSyncedAt: string;
  }> = [];

  const pages: Array<{
    metaPageId: string;
    name: string;
    businessId?: string;
    usability: MetaAssetUsability;
    discoverySource: string;
    instagramBusinessAccountId?: string;
    lastSyncedAt: string;
  }> = [];

  const instagramAccounts: Array<{
    metaInstagramId: string;
    username?: string;
    pageId?: string;
    adAccountId?: string;
    usability: MetaAssetUsability;
    discoverySource: string;
    lastSyncedAt: string;
  }> = [];

  const pixels: Array<{
    metaPixelId: string;
    name: string;
    adAccountId?: string;
    businessId?: string;
    usability: MetaAssetUsability;
    discoverySource: string;
    lastFiredTime?: string;
    lastSyncedAt: string;
  }> = [];

  const pageMap = new Map<string, (typeof pages)[number]>();

  try {
    const businessRows = await fetchPaged<{ id: string; name?: string }>(
      "me/businesses?fields=id,name&limit=100",
      token,
      connectionId,
    );
    for (const b of businessRows) {
      businesses.push({
        metaBusinessId: b.id,
        name: b.name?.trim() || b.id,
        usability: "DISCOVERED_AND_USABLE",
        discoverySource: "me/businesses",
        lastSyncedAt: syncedAt,
      });
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Business listesi alinamadi");
  }

  try {
    const userPages = await fetchPaged<{
      id: string;
      name?: string;
      tasks?: string[];
      instagram_business_account?: { id: string };
    }>("me/accounts?fields=id,name,tasks,instagram_business_account&limit=100", token, connectionId);

    if (userPages.length === 0 && !diagnostics.grantedPermissions.includes("pages_show_list")) {
      granularIssues.push("pages_show_list izni verilmemis");
    }

    for (const page of userPages) {
      const granularOk = granularHasTarget(debug.granularScopes, "pages_show_list", page.id);
      let usability: MetaAssetUsability = pageTasksUsable(page.tasks)
        ? "DISCOVERED_AND_USABLE"
        : "DISCOVERED_NOT_ASSIGNED";
      if (granularOk === false) usability = "GRANULAR_ACCESS_MISSING";
      const row = {
        metaPageId: page.id,
        name: page.name?.trim() || page.id,
        usability,
        discoverySource: "me/accounts",
        instagramBusinessAccountId: page.instagram_business_account?.id,
        lastSyncedAt: syncedAt,
      };
      pageMap.set(page.id, row);
      if (usability === "DISCOVERED_NOT_ASSIGNED" || usability === "GRANULAR_ACCESS_MISSING") {
        unassignedAssets.push({
          type: "page",
          name: row.name,
          message:
            usability === "GRANULAR_ACCESS_MISSING"
              ? "Page Business Portfolio icinde mevcut ancak baglanti sirasinda bu uygulamaya erisim verilmemis. Meta baglantisini yeniden yetkilendirin."
              : "Page bulundu ancak reklam yonetimi icin yeterli gorevler atanmamis.",
        });
      }
      if (page.instagram_business_account?.id) {
        instagramAccounts.push({
          metaInstagramId: page.instagram_business_account.id,
          pageId: page.id,
          usability: usability === "DISCOVERED_AND_USABLE" ? "DISCOVERED_AND_USABLE" : usability,
          discoverySource: "page.instagram_business_account",
          lastSyncedAt: syncedAt,
        });
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "me/accounts alinamadi");
  }

  for (const business of businesses) {
    for (const edge of ["owned_pages", "client_pages"] as const) {
      try {
        const bizPages = await fetchPaged<{ id: string; name?: string }>(
          `${business.metaBusinessId}/${edge}?fields=id,name&limit=100`,
          token,
          connectionId,
          100,
        );
        for (const page of bizPages) {
          if (!pageMap.has(page.id)) {
            const row = {
              metaPageId: page.id,
              name: page.name?.trim() || page.id,
              businessId: business.metaBusinessId,
              usability: "DISCOVERED_NOT_ASSIGNED" as const,
              discoverySource: `business.${edge}`,
              lastSyncedAt: syncedAt,
            };
            pageMap.set(page.id, row);
            unassignedAssets.push({
              type: "page",
              name: row.name,
              message:
                "Page Business Portfolio icinde mevcut ancak baglanti sirasinda bu uygulamaya erisim verilmemis. Meta baglantisini yeniden yetkilendirin.",
            });
          }
        }
      } catch {
        // business page edge may be unavailable
      }
    }

    for (const edge of ["owned_ad_accounts", "client_ad_accounts"] as const) {
      try {
        const accounts = await fetchPaged<AdAccountRaw>(
          `${business.metaBusinessId}/${edge}?fields=id,account_id,name,account_status,currency&limit=100`,
          token,
          connectionId,
          100,
        );
        for (const raw of accounts) {
          const normalized = normalizeAdAccountRecord(raw);
          if (!normalized.id) continue;
          if (!adAccounts.some((a) => a.metaAdAccountId === normalized.id)) {
            adAccounts.push({
              metaAdAccountId: normalized.id,
              accountId: normalized.accountId,
              name: normalized.name,
              businessId: business.metaBusinessId,
              usability: "DISCOVERED_AND_USABLE",
              discoverySource: `business.${edge}`,
              lastSyncedAt: syncedAt,
            });
          }
        }
      } catch {
        // continue
      }
    }
  }

  try {
    const userAdAccounts = await fetchPaged<AdAccountRaw>(
      "me/adaccounts?fields=id,account_id,name,account_status,currency&limit=100",
      token,
      connectionId,
    );
    for (const raw of userAdAccounts) {
      const normalized = normalizeAdAccountRecord(raw);
      if (!normalized.id || adAccounts.some((a) => a.metaAdAccountId === normalized.id)) continue;
      adAccounts.push({
        metaAdAccountId: normalized.id,
        accountId: normalized.accountId,
        name: normalized.name,
        usability: "DISCOVERED_AND_USABLE",
        discoverySource: "me/adaccounts",
        lastSyncedAt: syncedAt,
      });
    }
  } catch {
    // optional edge
  }

  pages.push(...pageMap.values());

  const pixelIdsByAdAccount = new Map<string, Set<string>>();
  const businessPixelIds = new Set<string>();

  for (const account of adAccounts) {
    const actId = normalizeAdAccountId(account.metaAdAccountId);
    try {
      const adPixels = await fetchPaged<{ id: string; name?: string; last_fired_time?: string }>(
        `${actId}/adspixels?fields=id,name,last_fired_time&limit=100`,
        token,
        connectionId,
        100,
      );
      const set = new Set<string>();
      for (const pixel of adPixels) {
        set.add(pixel.id);
        pixels.push({
          metaPixelId: pixel.id,
          name: pixel.name?.trim() || pixel.id,
          adAccountId: actId,
          businessId: account.businessId,
          usability: "DISCOVERED_AND_USABLE",
          discoverySource: "adspixels",
          lastFiredTime: pixel.last_fired_time,
          lastSyncedAt: syncedAt,
        });
      }
      pixelIdsByAdAccount.set(actId, set);

      if (adPixels.length === 0) {
        unassignedAssets.push({
          type: "pixel",
          name: account.name,
          message:
            "Meta istegi basarili ancak secili reklam hesabina bu token tarafindan erisilebilen Pixel/Dataset atanmis degil.",
        });
      }
    } catch (error) {
      errors.push(
        `${account.name}: Pixel listesi alinamadi - ${error instanceof Error ? error.message : "hata"}`,
      );
    }

    try {
      const igRows = await fetchPaged<{ id: string; username?: string }>(
        `${actId}/instagram_accounts?fields=id,username&limit=50`,
        token,
        connectionId,
        50,
      );
      for (const ig of igRows) {
        if (instagramAccounts.some((i) => i.metaInstagramId === ig.id)) continue;
        instagramAccounts.push({
          metaInstagramId: ig.id,
          username: ig.username,
          adAccountId: actId,
          usability: "DISCOVERED_AND_USABLE",
          discoverySource: "instagram_accounts",
          lastSyncedAt: syncedAt,
        });
      }
    } catch {
      // optional
    }

    try {
      const conversions = await fetchPaged<{
        id: string;
        name?: string;
        pixel?: { id: string; name?: string };
      }>(`${actId}/customconversions?fields=id,name,pixel&limit=50`, token, connectionId, 50);
      for (const cc of conversions) {
        const pid = cc.pixel?.id;
        if (!pid) continue;
        businessPixelIds.add(pid);
        const assigned = pixelIdsByAdAccount.get(actId)?.has(pid);
        if (!assigned && !pixels.some((p) => p.metaPixelId === pid && p.adAccountId === actId)) {
          pixels.push({
            metaPixelId: pid,
            name: cc.pixel?.name?.trim() || cc.name?.trim() || pid,
            adAccountId: actId,
            businessId: account.businessId,
            usability: "DISCOVERED_NOT_ASSIGNED",
            discoverySource: "customconversions",
            lastSyncedAt: syncedAt,
          });
          unassignedAssets.push({
            type: "pixel",
            name: cc.pixel?.name?.trim() || pid,
            message:
              "Pixel/Dataset mevcut olabilir ancak secili reklam hesabina veya baglanti kullanicisina atanmis gorunmuyor.",
          });
        }
      }
    } catch {
      // optional
    }

    try {
      await addLinkedAdAccount({
        connectionId,
        adAccountId: actId,
        adAccountName: account.name,
        select: false,
      });
    } catch {
      // already linked
    }
  }

  if (businesses.length > 0 && !connection.metaBusinessId) {
    await updateMetaBusinessProfile(connectionId, {
      metaBusinessId: businesses[0].metaBusinessId,
      metaBusinessName: businesses[0].name,
    });
  }

  await replaceConnectionAssetSnapshot(connectionId, {
    businesses,
    adAccounts,
    pages,
    instagramAccounts,
    pixels,
  });

  const usablePages = filterUsable(pages).length;
  const usablePixels = filterUsable(pixels).length;

  return {
    connectionId,
    syncedAt,
    tokenSubject: diagnostics.tokenSubjectId
      ? { id: diagnostics.tokenSubjectId, name: diagnostics.tokenSubjectName }
      : undefined,
    grantedPermissions: diagnostics.grantedPermissions,
    missingPermissions: diagnostics.missingPermissions,
    granularIssues,
    counts: {
      businesses: businesses.length,
      adAccounts: adAccounts.length,
      pages: pages.length,
      instagramAccounts: instagramAccounts.length,
      pixels: pixels.length,
      usablePages,
      usablePixels,
    },
    unassignedAssets,
    errors,
  };
}

export async function buildOnboardingOptions(connectionId: string): Promise<OnboardingOptions> {
  const [businesses, adAccounts, pages, instagramAccounts, pixels] = await Promise.all([
    listSyncedBusinesses(connectionId),
    listSyncedAdAccounts(connectionId),
    listSyncedPages(connectionId),
    listSyncedInstagramAccounts(connectionId),
    listSyncedPixels(connectionId),
  ]);

  const usablePages = filterUsable(pages);
  const usableAdAccounts = filterUsable(adAccounts);
  const usablePixels = (adAccountId?: string) =>
    filterUsable(pixels).filter((p) => !adAccountId || p.adAccountId === adAccountId);

  const autoBusiness = businesses[0];
  const autoAdAccount = usableAdAccounts[0];
  const autoPage = usablePages[0];
  const autoInstagram =
    instagramAccounts.find((i) => i.pageId === autoPage?.metaPageId) ??
    instagramAccounts.find((i) => i.usability === "DISCOVERED_AND_USABLE");
  const autoPixel = autoAdAccount ? usablePixels(autoAdAccount.metaAdAccountId)[0] : usablePixels()[0];

  const profile = autoAdAccount
    ? await getAdAccountProfile(connectionId, autoAdAccount.metaAdAccountId)
    : null;

  const needsOnboarding = !profile?.defaultPageId || !profile?.defaultPixelId;

  const assetIssues: MetaAssetSyncReport["unassignedAssets"] = [];
  for (const page of pages) {
    if (page.usability === "DISCOVERED_NOT_ASSIGNED") {
      assetIssues.push({
        type: "page",
        name: page.name,
        message:
          "Page Business Portfolio icinde mevcut ancak baglanti sirasinda bu uygulamaya erisim verilmemis. Meta baglantisini yeniden yetkilendirin.",
      });
    } else if (page.usability === "GRANULAR_ACCESS_MISSING") {
      assetIssues.push({
        type: "page",
        name: page.name,
        message:
          "Facebook Page icin granular erisim eksik. Meta baglantisini yeniden yetkilendirin ve Page erisimini secin.",
      });
    }
  }
  for (const pixel of pixels) {
    if (pixel.usability === "DISCOVERED_NOT_ASSIGNED") {
      assetIssues.push({
        type: "pixel",
        name: pixel.name,
        message:
          "Pixel/Dataset mevcut olabilir ancak secili reklam hesabina veya baglanti kullanicisina atanmis gorunmuyor.",
      });
    }
  }

  return {
    connectionId,
    businesses: businesses.map((b) => ({ id: b.metaBusinessId, name: b.name })),
    adAccounts: adAccounts.map((a) => ({
      id: a.metaAdAccountId,
      name: a.name,
      businessId: a.businessId,
    })),
    pages: pages.map((p) => ({
      id: p.metaPageId,
      name: p.name,
      usability: p.usability,
    })),
    instagramAccounts: instagramAccounts.map((i) => ({
      id: i.metaInstagramId,
      username: i.username,
      pageId: i.pageId,
    })),
    pixels: pixels.map((p) => ({
      id: p.metaPixelId,
      name: p.name,
      adAccountId: p.adAccountId,
      usability: p.usability,
    })),
    websiteSuggestions: profile?.defaultWebsiteUrl ? [profile.defaultWebsiteUrl] : [],
    autoSelections: {
      businessId: autoBusiness?.metaBusinessId,
      adAccountId: autoAdAccount?.metaAdAccountId,
      pageId: autoPage?.metaPageId,
      instagramId: autoInstagram?.metaInstagramId,
      pixelId: autoPixel?.metaPixelId,
      websiteUrl: profile?.defaultWebsiteUrl,
    },
    needsOnboarding,
    assetIssues,
  };
}
