import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { getActiveMetaConnection, getMetaConnectionById } from "@/lib/db";
import { getAdAccountsForBusiness, getUserAdAccounts } from "@/lib/meta";
import { handleApiError, jsonError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const connectionId = request.nextUrl.searchParams.get("connectionId");
    const businessId = request.nextUrl.searchParams.get("businessId");

    const connection = connectionId
      ? await getMetaConnectionById(connectionId)
      : await getActiveMetaConnection();

    if (!connection) {
      return jsonError("Meta hesabi bagli degil", 400);
    }

    const adAccounts = businessId
      ? await getAdAccountsForBusiness(businessId, { token: connection.accessToken })
      : await getUserAdAccounts({ token: connection.accessToken });

    return NextResponse.json({
      adAccounts: adAccounts.map((account) => ({
        ...account,
        connectionId: connection.id,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
