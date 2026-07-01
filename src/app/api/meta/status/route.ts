import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { getMetaConnection } from "@/lib/db";
import { handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }
  try {
    const connection = await getMetaConnection();
    if (!connection) {
      return NextResponse.json({
        connected: false,
        metaUserId: null,
        selectedAdAccountId: null,
        selectedAdAccountName: null,
      });
    }
    return NextResponse.json({
      connected: true,
      metaUserId: connection.metaUserId,
      selectedAdAccountId: connection.selectedAdAccountId || null,
      selectedAdAccountName: connection.selectedAdAccountName || null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
