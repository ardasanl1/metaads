import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { getCampaign, updateCampaign } from "@/lib/meta";
import { getInsightsQueryFromRequest } from "@/lib/api-insights";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { parseMetaInsights } from "@/utils/insights";
import type { CampaignWithInsights } from "@/types/meta";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const { id } = await context.params;
    const raw = await getCampaign(id, getInsightsQueryFromRequest(request));

    if (!raw) {
      return jsonError("Kampanya bulunamadı", 404);
    }

    const campaign: CampaignWithInsights = {
      id: raw.id,
      name: raw.name,
      objective: raw.objective,
      status: raw.status,
      effective_status: raw.effective_status,
      created_time: raw.created_time,
      updated_time: raw.updated_time,
      daily_budget: raw.daily_budget,
      lifetime_budget: raw.lifetime_budget,
      insights: parseMetaInsights(raw.insights?.data?.[0]),
    };

    return NextResponse.json({ campaign });
  } catch (error) {
    return handleApiError(error);
  }
}

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
        return jsonError("Geçerli bir kampanya adı gerekli", 400);
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

    const campaign = await updateCampaign(id, input);
    return NextResponse.json({ campaign });
  } catch (error) {
    return handleApiError(error);
  }
}
