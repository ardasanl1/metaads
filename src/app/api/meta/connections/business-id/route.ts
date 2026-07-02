import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { getMetaConnectionById, updateMetaBusinessProfile } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = (await request.json()) as {
      connectionId?: string;
      metaBusinessId?: string;
    };

    const connectionId =
      typeof body.connectionId === "string" ? body.connectionId.trim() : "";
    const metaBusinessId =
      typeof body.metaBusinessId === "string" ? body.metaBusinessId.trim() : "";

    if (!connectionId) return jsonError("connectionId gerekli", 400);
    if (!metaBusinessId) return jsonError("Business Manager ID gerekli", 400);
    if (!/^\d+$/.test(metaBusinessId)) {
      return jsonError("Business Manager ID yalnızca rakamlardan oluşmalı", 400);
    }

    const connection = await getMetaConnectionById(connectionId);
    if (!connection) return jsonError("Bağlantı bulunamadı", 404);

    await updateMetaBusinessProfile(connectionId, {
      metaBusinessId,
      metaBusinessName: null,
    });

    return NextResponse.json({ ok: true, metaBusinessId });
  } catch (error) {
    return handleApiError(error);
  }
}
