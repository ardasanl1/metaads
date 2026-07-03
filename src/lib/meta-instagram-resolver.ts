import "server-only";

import { metaRequest } from "@/lib/meta";
import {
  classifyMetaError,
  getTokenCapabilityDiagnostics,
  requireMetaConnectionContext,
} from "@/lib/meta-connection-context";
import type { MetaInstagramOption } from "@/types/meta-assets";

export type InstagramResolverDiagnostic = {
  instagramBasicGranted: boolean;
  resultCount: number;
  reason?: string;
  errors: Array<{ source: string; code?: number; message: string }>;
};

type RawInstagram = {
  id: string;
  username?: string;
  name?: string;
  profile_picture_url?: string;
};

export async function resolveInstagramAccounts(input: {
  connectionId: string;
  adAccountId?: string;
  pages?: Array<{ id: string; name?: string; instagramBusinessAccountId?: string }>;
  selectedPageId?: string;
}): Promise<{ accounts: MetaInstagramOption[]; diagnostic: InstagramResolverDiagnostic }> {
  const ctx = await requireMetaConnectionContext({
    connectionId: input.connectionId,
    adAccountId: input.adAccountId,
  });
  const tokenDiagnostics = await getTokenCapabilityDiagnostics(ctx);
  const instagramBasicGranted = tokenDiagnostics.grantedPermissions.includes("instagram_basic");
  const errors: InstagramResolverDiagnostic["errors"] = [];

  const sourcePages = (input.pages ?? []).filter((page) =>
    input.selectedPageId ? page.id === input.selectedPageId : true,
  );

  const pagesWithIg = sourcePages.filter((page) => page.instagramBusinessAccountId);
  const pagesWithoutIg = sourcePages.filter((page) => !page.instagramBusinessAccountId);

  if (!instagramBasicGranted) {
    return {
      accounts: [],
      diagnostic: {
        instagramBasicGranted: false,
        resultCount: 0,
        reason: "Token'da instagram_basic izni bulunmuyor.",
        errors,
      },
    };
  }

  if (pagesWithIg.length === 0) {
    const pageName = pagesWithoutIg[0]?.name ?? sourcePages[0]?.name;
    return {
      accounts: [],
      diagnostic: {
        instagramBasicGranted: true,
        resultCount: 0,
        reason: pageName
          ? `${pageName} Page'ine bagli profesyonel Instagram hesabi bulunamadi.`
          : "Bagli profesyonel Instagram hesabi bulunamadi.",
        errors,
      },
    };
  }

  const byId = new Map<string, MetaInstagramOption>();
  let apiFailed = false;

  for (const page of pagesWithIg) {
    const igId = page.instagramBusinessAccountId;
    if (!igId) continue;
    try {
      const ig = await metaRequest<RawInstagram>(
        `${igId}?fields=id,username,name,profile_picture_url`,
        { token: ctx.accessToken, connectionId: ctx.connectionId },
      );
      byId.set(ig.id, {
        id: ig.id,
        username: ig.username,
        name: ig.name ?? ig.username,
        profilePictureUrl: ig.profile_picture_url,
        pageId: page.id,
        pageName: page.name ?? page.id,
      });
    } catch (error) {
      apiFailed = true;
      const classified = classifyMetaError(error);
      errors.push({
        source: `instagram:${igId}`,
        code: classified.code,
        message: classified.message,
      });
    }
  }

  if (byId.size === 0 && apiFailed) {
    return {
      accounts: [],
      diagnostic: {
        instagramBasicGranted: true,
        resultCount: 0,
        reason: "Instagram bilgisi alinirken Meta API hatasi olustu.",
        errors,
      },
    };
  }

  return {
    accounts: Array.from(byId.values()).sort((a, b) =>
      (a.username ?? a.id).localeCompare(b.username ?? b.id, "tr"),
    ),
    diagnostic: {
      instagramBasicGranted: true,
      resultCount: byId.size,
      errors,
    },
  };
}
