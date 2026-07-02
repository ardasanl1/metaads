import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import {
  getMetaConnectionById,
  listMetaConnections,
  updateMetaBusinessId,
  updateMetaUserName,
} from "@/lib/db";
import { ensureMetaBusinessId, resolveTokenIdentity } from "@/lib/meta";
import { handleApiError } from "@/lib/api-utils";
import { getFirmDisplayName } from "@/utils/ad-account";
import type { MetaConnectionSummary } from "@/types/meta";

async function enrichConnections(
  connections: MetaConnectionSummary[],
): Promise<MetaConnectionSummary[]> {
  return Promise.all(
    connections.map(async (connection) => {
      let next = connection;
      const full = await getMetaConnectionById(connection.id);
      if (!full) return connection;

      if (!connection.metaUserName?.trim()) {
        const identity = await resolveTokenIdentity(full.accessToken);
        if (identity.metaUserName?.trim()) {
          await updateMetaUserName(connection.id, identity.metaUserName);
          next = { ...next, metaUserName: identity.metaUserName };
        }
      }

      if (!connection.metaBusinessId?.trim()) {
        const businessId = await ensureMetaBusinessId(connection.id);
        if (businessId) {
          next = { ...next, metaBusinessId: businessId };
        } else {
          const identity = await resolveTokenIdentity(full.accessToken);
          if (identity.metaBusinessId?.trim()) {
            await updateMetaBusinessId(connection.id, identity.metaBusinessId);
            next = { ...next, metaBusinessId: identity.metaBusinessId };
          }
        }
      }

      return next;
    }),
  );
}

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const connections = await enrichConnections(await listMetaConnections());
    const active = connections.find((item) => item.isActive) ?? connections[0] ?? null;

    if (connections.length === 0) {
      return NextResponse.json({
        connected: false,
        activeConnectionId: null,
        connections: [],
        metaUserId: null,
        metaUserName: null,
        selectedAdAccountId: null,
        selectedAdAccountName: null,
      });
    }

    return NextResponse.json({
      connected: true,
      activeConnectionId: active?.id ?? null,
      connections: connections.map((connection) => ({
        ...connection,
        displayName: getFirmDisplayName(connection),
        linkedAdAccounts: connection.linkedAdAccounts,
      })),
      metaUserId: active?.metaUserId ?? null,
      metaUserName: active?.metaUserName ?? null,
      selectedAdAccountId: active?.selectedAdAccountId || null,
      selectedAdAccountName: active?.selectedAdAccountName || null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
