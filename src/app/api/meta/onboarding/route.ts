import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { getMetaConnectionById } from "@/lib/db";
import { buildOnboardingOptions } from "@/lib/meta-asset-sync";
import { handleApiError, jsonError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const connectionId = request.nextUrl.searchParams.get("connectionId")?.trim();
    if (!connectionId) return jsonError("connectionId gerekli", 400);

    const connection = await getMetaConnectionById(connectionId);
    if (!connection) return jsonError("Baglanti bulunamadi", 404);

    const options = await buildOnboardingOptions(connectionId);
    return NextResponse.json({
      ...options,
      authMethod: connection.authMethod,
      onboardingCompleted: connection.onboardingCompleted,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
