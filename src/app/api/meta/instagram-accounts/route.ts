import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { getInstagramAccountsForPage } from "@/lib/meta";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }
  try {
    const pageId = request.nextUrl.searchParams.get("pageId");
    const connectionId = request.nextUrl.searchParams.get("connectionId")?.trim() || undefined;
    const pageName = request.nextUrl.searchParams.get("pageName")?.trim() || undefined;
    if (!pageId) {
      return jsonError("pageId gerekli", 400);
    }
    const accounts = await getInstagramAccountsForPage(pageId, { connectionId, pageName });
    return NextResponse.json({ accounts });
  } catch (error) {
    return handleApiError(error);
  }
}
