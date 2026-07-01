import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { getActiveMetaConnection, getMetaConnectionById } from "@/lib/db";
import { getBusinesses } from "@/lib/meta";
import { handleApiError, jsonError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const connectionId = request.nextUrl.searchParams.get("connectionId");
    const connection = connectionId
      ? await getMetaConnectionById(connectionId)
      : await getActiveMetaConnection();

    if (!connection) {
      return jsonError("Meta hesabi bagli degil", 400);
    }

    const businesses = await getBusinesses({ token: connection.accessToken });
    return NextResponse.json({ businesses });
  } catch (error) {
    return handleApiError(error);
  }
}
