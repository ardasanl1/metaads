import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { createAdSet, getAdSets } from "@/lib/meta";
import { getInsightsQueryFromRequest } from "@/lib/api-insights";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { parseMetaInsights } from "@/utils/insights";
import type { AdSetWithInsights } from "@/types/meta";
import { getMetaConnection } from "@/lib/db";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }
  try {
    const campaignId = request.nextUrl.searchParams.get("campaignId");
    if (!campaignId) {
      return jsonError("campaignId gerekli", 400);
    }
    const rawAdsets = await getAdSets(campaignId, getInsightsQueryFromRequest(request));
    const adsets: AdSetWithInsights[] = rawAdsets.map((adset) => ({
      id: adset.id,
      campaign_id: adset.campaign_id,
      name: adset.name,
      status: adset.status,
      effective_status: adset.effective_status,
      daily_budget: adset.daily_budget,
      lifetime_budget: adset.lifetime_budget,
      start_time: adset.start_time,
      end_time: adset.end_time,
      insights: adset.insights?.data?.[0]
        ? parseMetaInsights(adset.insights.data[0])
        : null,
    }));
    return NextResponse.json({ adsets });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }
  try {
    const connection = await getMetaConnection();
    if (!connection?.selectedAdAccountId) {
      return jsonError("Reklam hesabı seçilmedi", 400);
    }

    const body = (await request.json()) as {
      name?: string;
      campaignId?: string;
      dailyBudget?: number;
      status?: string;
      billingEvent?: string;
      optimizationGoal?: string;
      targeting?: unknown;
      promotedObject?: unknown;
      startTime?: string;
      endTime?: string;
    };

    if (!body.name?.trim()) return jsonError("Reklam seti adı gerekli", 400);
    if (!body.campaignId?.trim()) return jsonError("campaignId gerekli", 400);
    if (typeof body.dailyBudget !== "number" || body.dailyBudget <= 0) {
      return jsonError("Günlük bütçe pozitif bir sayı olmalı", 400);
    }
    const status = body.status ?? "PAUSED";
    if (status !== "ACTIVE" && status !== "PAUSED") {
      return jsonError("Başlangıç durumu ACTIVE veya PAUSED olmalı", 400);
    }
    if (!body.billingEvent?.trim()) return jsonError("billingEvent gerekli", 400);
    if (!body.optimizationGoal?.trim()) return jsonError("optimizationGoal gerekli", 400);
    if (!body.targeting) return jsonError("targeting gerekli", 400);

    const result = await createAdSet(connection.selectedAdAccountId, {
      name: body.name.trim(),
      campaignId: body.campaignId.trim(),
      dailyBudget: body.dailyBudget,
      status,
      billingEvent: body.billingEvent,
      optimizationGoal: body.optimizationGoal,
      targeting: body.targeting,
      promotedObject: body.promotedObject,
      startTime: body.startTime,
      endTime: body.endTime,
    });

    return NextResponse.json({ id: result.id });
  } catch (error) {
    return handleApiError(error);
  }
}
