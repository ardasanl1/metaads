import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { updateSelectedAdAccount } from "@/lib/db";
import { getAdAccounts } from "@/lib/meta";
import { handleApiError, jsonError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }
  try {
    const body = (await request.json()) as { accountId?: string; accountName?: string };
    if (!body.accountId || typeof body.accountId !== "string") {
      return jsonError("Reklam hesabı ID gerekli", 400);
    }
    if (!body.accountName || typeof body.accountName !== "string") {
      return jsonError("Reklam hesabı adı gerekli", 400);
    }

    const accounts = await getAdAccounts();
    const match = accounts.find((a) => a.id === body.accountId);
    if (!match) {
      return jsonError("Seçilen reklam hesabına erişim yok", 403);
    }

    await updateSelectedAdAccount(match.id, match.name);
    return NextResponse.json({
      ok: true,
      selectedAdAccountId: match.id,
      selectedAdAccountName: match.name,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
