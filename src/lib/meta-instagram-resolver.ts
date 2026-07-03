import "server-only";

import { graphBaseUrl, metaRequest } from "@/lib/meta";
import {
  classifyMetaError,
  requireMetaConnectionContext,
} from "@/lib/meta-connection-context";
import { normalizeAdAccountId } from "@/utils/ad-account";
import type { MetaInstagramOption } from "@/types/meta-assets";

const FETCH_LIMIT = 200;

type PagedResult<T> = { data?: T[]; paging?: { next?: string } };

type RawInstagram = {
  id: string;
  username?: string;
  profile_pic?: string;
};

export type InstagramResolverDiagnostic = {
  fromPages: number;
  fromAdAccount: number;
  mergedCount: number;
  adAccountRequestSucceeded: boolean;
  errors: Array<{ source: string; code?: number; message: string }>;
};

async function fetchPaged<T>(
  initialPath: string,
  token: string,
  connectionId: string,
): Promise<{ items: T[]; error?: { source: string; code?: number; message: string }; succeeded: boolean }> {
  const baseUrl = graphBaseUrl();
  let nextPath: string | null = initialPath;
  const results: T[] = [];

  while (nextPath && results.length < FETCH_LIMIT) {
    try {
      const response: PagedResult<T> = await metaRequest<PagedResult<T>>(nextPath, {
        token,
        connectionId,
      });
      if (response.data) results.push(...response.data);
      if (response.paging?.next && results.length < FETCH_LIMIT) {
        nextPath = response.paging.next.replace(`${baseUrl}/`, "");
      } else {
        nextPath = null;
      }
    } catch (error) {
      const classified = classifyMetaError(error);
      return {
        items: results,
        succeeded: false,
        error: {
          source: initialPath.split("?")[0],
          code: classified.code,
          message: classified.message,
        },
      };
    }
  }

  return { items: results, succeeded: true };
}

export async function resolveInstagramAccounts(input: {
  connectionId: string;
  adAccountId: string;
  pages?: Array<{ id: string; name?: string; instagramBusinessAccountId?: string }>;
}): Promise<{ accounts: MetaInstagramOption[]; diagnostic: InstagramResolverDiagnostic }> {
  const ctx = await requireMetaConnectionContext({
    connectionId: input.connectionId,
    adAccountId: input.adAccountId,
  });
  const accountPath = normalizeAdAccountId(input.adAccountId);
  const byId = new Map<string, MetaInstagramOption>();
  const errors: InstagramResolverDiagnostic["errors"] = [];
  let fromPages = 0;
  let fromAdAccount = 0;

  for (const page of input.pages ?? []) {
    if (!page.instagramBusinessAccountId) continue;
    fromPages += 1;
    byId.set(page.instagramBusinessAccountId, {
      id: page.instagramBusinessAccountId,
      username: undefined,
      name: page.instagramBusinessAccountId,
      pageId: page.id,
      pageName: page.name,
    });
  }

  let adAccountRequestSucceeded = false;
  if (accountPath) {
    const igFetch = await fetchPaged<RawInstagram>(
      `${accountPath}/instagram_accounts?fields=id,username,profile_pic&limit=100`,
      ctx.accessToken,
      ctx.connectionId,
    );
    if (igFetch.error) {
      errors.push(igFetch.error);
    } else {
      adAccountRequestSucceeded = true;
      fromAdAccount = igFetch.items.length;
      for (const ig of igFetch.items) {
        if (!ig.id) continue;
        const existing = byId.get(ig.id);
        byId.set(ig.id, {
          id: ig.id,
          username: ig.username,
          name: ig.username ?? ig.id,
          profilePictureUrl: ig.profile_pic,
          pageId: existing?.pageId,
          pageName: existing?.pageName,
        });
      }
    }
  }

  return {
    accounts: Array.from(byId.values()).sort((a, b) =>
      (a.username ?? a.id).localeCompare(b.username ?? b.id, "tr"),
    ),
    diagnostic: {
      fromPages,
      fromAdAccount,
      mergedCount: byId.size,
      adAccountRequestSucceeded,
      errors,
    },
  };
}
