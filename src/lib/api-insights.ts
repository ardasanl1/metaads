import type { NextRequest } from "next/server";
import type { InsightsQuery } from "@/lib/meta";

export function getInsightsQueryFromRequest(request: NextRequest): InsightsQuery {
  const datePreset = request.nextUrl.searchParams.get("datePreset") ?? undefined;
  const since = request.nextUrl.searchParams.get("since") ?? undefined;
  const until = request.nextUrl.searchParams.get("until") ?? undefined;
  return { datePreset, since, until };
}
