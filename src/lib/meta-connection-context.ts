import "server-only";

import { getMetaConnectionById } from "@/lib/db";
import { MetaApiError, metaRequest } from "@/lib/meta";

const TRACKED_PERMISSIONS = [
  "ads_read",
  "ads_management",
  "business_management",
  "pages_show_list",
  "pages_read_engagement",
  "instagram_basic",
] as const;

export type TokenCapabilityDiagnostics = {
  tokenSubjectId?: string;
  tokenSubjectName?: string;
  grantedPermissions: string[];
  declinedPermissions: string[];
  tokenType?: "user" | "system_user" | "unknown";
  requestErrors: string[];
  missingPermissions: string[];
};

export type MetaConnectionContext = {
  connectionId: string;
  accessToken: string;
  metaBusinessId?: string;
  metaUserId?: string;
  selectedAdAccountId?: string;
};

export async function requireMetaConnectionContext(input: {
  connectionId: string;
  adAccountId?: string;
  businessId?: string;
}): Promise<MetaConnectionContext> {
  const connectionId = input.connectionId?.trim();
  if (!connectionId) {
    throw new MetaApiError("connectionId gerekli", 400);
  }

  const connection = await getMetaConnectionById(connectionId);
  if (!connection?.accessToken?.trim()) {
    throw new MetaApiError("Meta bağlantısı bulunamadı veya token eksik", 400);
  }

  return {
    connectionId: connection.id,
    accessToken: connection.accessToken,
    metaBusinessId: input.businessId?.trim() || connection.metaBusinessId?.trim() || undefined,
    metaUserId: connection.metaUserId?.trim() || undefined,
    selectedAdAccountId: input.adAccountId?.trim() || connection.selectedAdAccountId?.trim() || undefined,
  };
}

export async function getTokenCapabilityDiagnostics(
  ctx: MetaConnectionContext,
): Promise<TokenCapabilityDiagnostics> {
  const requestErrors: string[] = [];
  let tokenSubjectId: string | undefined;
  let tokenSubjectName: string | undefined;
  let tokenType: TokenCapabilityDiagnostics["tokenType"] = "unknown";
  const grantedPermissions: string[] = [];
  const declinedPermissions: string[] = [];

  try {
    const me = await metaRequest<{ id: string; name?: string }>("me?fields=id,name", {
      token: ctx.accessToken,
      connectionId: ctx.connectionId,
    });
    tokenSubjectId = me.id;
    tokenSubjectName = me.name;
  } catch (error) {
    requestErrors.push(error instanceof Error ? error.message : "me isteği başarısız");
  }

  try {
    const permissions = await metaRequest<{
      data?: Array<{ permission: string; status: string }>;
    }>("me/permissions", { token: ctx.accessToken, connectionId: ctx.connectionId });

    for (const row of permissions.data ?? []) {
      if (row.status === "granted") grantedPermissions.push(row.permission);
      else declinedPermissions.push(row.permission);
    }
  } catch (error) {
    requestErrors.push(error instanceof Error ? error.message : "me/permissions isteği başarısız");
  }

  if (tokenSubjectId) {
    try {
      const debug = await metaRequest<{
        data?: { type?: string };
      }>(`debug_token?input_token=${encodeURIComponent(ctx.accessToken)}`, {
        token: ctx.accessToken,
        connectionId: ctx.connectionId,
      });
      const type = debug.data?.type?.toLowerCase() ?? "";
      if (type.includes("system")) tokenType = "system_user";
      else if (type.includes("user")) tokenType = "user";
    } catch {
      tokenType = grantedPermissions.includes("pages_show_list") ? "user" : "system_user";
    }
  }

  const missingPermissions = TRACKED_PERMISSIONS.filter((p) => !grantedPermissions.includes(p));

  return {
    tokenSubjectId,
    tokenSubjectName,
    grantedPermissions,
    declinedPermissions,
    tokenType,
    requestErrors,
    missingPermissions: [...missingPermissions],
  };
}

export function classifyMetaError(error: unknown): {
  message: string;
  code?: number;
  type?: string;
} {
  if (error instanceof MetaApiError) {
    const match = error.message.match(/\(kod: (\d+)\)/);
    return {
      message: error.message,
      code: match ? Number(match[1]) : undefined,
    };
  }
  return { message: error instanceof Error ? error.message : "Bilinmeyen hata" };
}
