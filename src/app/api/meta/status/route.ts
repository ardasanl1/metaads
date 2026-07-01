import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { getActiveMetaConnection, listMetaConnections } from "@/lib/db";
import { handleApiError } from "@/lib/api-utils";
import { getFirmDisplayName } from "@/utils/ad-account";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const connections = await listMetaConnections();
    const active = await getActiveMetaConnection();

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
      activeConnectionId: active?.id ?? connections.find((item) => item.isActive)?.id ?? null,
      connections: connections.map((connection) => ({
        ...connection,
        displayName: getFirmDisplayName(connection),
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
