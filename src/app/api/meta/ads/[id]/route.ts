import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { updateAd } from "@/lib/meta";
import { handleApiError, jsonError } from "@/lib/api-utils";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { name?: string; status?: string };

    const input: { name?: string; status?: "ACTIVE" | "PAUSED" } = {};
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return jsonError("Geçerli bir reklam adı gerekli", 400);
      }
      input.name = body.name.trim();
    }
    if (body.status !== undefined) {
      if (body.status !== "ACTIVE" && body.status !== "PAUSED") {
        return jsonError("Durum yalnızca ACTIVE veya PAUSED olabilir", 400);
      }
      input.status = body.status;
    }
    if (Object.keys(input).length === 0) {
      return jsonError("Güncellenecek alan belirtilmedi", 400);
    }

    const ad = await updateAd(id, input);
    return NextResponse.json({ ad });
  } catch (error) {
    return handleApiError(error);
  }
}
