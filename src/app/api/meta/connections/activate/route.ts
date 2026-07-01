import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { setActiveConnection } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = (await request.json()) as { connectionId?: string };
    const connectionId =
      typeof body.connectionId === "string" ? body.connectionId.trim() : "";

    if (!connectionId) {
      return jsonError("Firma baglantisi ID gerekli", 400);
    }

    const updated = await setActiveConnection(connectionId);
    if (!updated) {
      return jsonError("Firma baglantisi bulunamadi", 404);
    }

    return NextResponse.json({ ok: true, connection: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
