import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { getMetaConnection } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { createAdCreative } from "@/lib/meta";

type SupportedCtaType = "SHOP_NOW" | "LEARN_MORE" | "SIGN_UP" | "GET_OFFER";

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
      pageId?: string;
      instagramActorId?: string;
      websiteUrl?: string;
      imageHash?: string;
      primaryText?: string;
      headline?: string;
      description?: string;
      ctaType?: string;
    };

    if (!body.name?.trim()) return jsonError("Creative adı gerekli", 400);
    if (!body.pageId?.trim()) return jsonError("pageId gerekli", 400);
    if (!body.websiteUrl?.trim()) return jsonError("websiteUrl gerekli", 400);
    if (!body.imageHash?.trim()) return jsonError("imageHash gerekli", 400);
    if (!body.primaryText?.trim()) return jsonError("primaryText gerekli", 400);
    if (!body.headline?.trim()) return jsonError("headline gerekli", 400);
    if (!body.ctaType?.trim()) return jsonError("ctaType gerekli", 400);

    const supported: SupportedCtaType[] = ["SHOP_NOW", "LEARN_MORE", "SIGN_UP", "GET_OFFER"];
    if (!supported.includes(body.ctaType as SupportedCtaType)) {
      return jsonError("Geçersiz CTA", 400);
    }

    const result = await createAdCreative(connection.selectedAdAccountId, {
      name: body.name.trim(),
      pageId: body.pageId.trim(),
      instagramActorId: body.instagramActorId?.trim() || undefined,
      websiteUrl: body.websiteUrl.trim(),
      imageHash: body.imageHash.trim(),
      primaryText: body.primaryText.trim(),
      headline: body.headline.trim(),
      description: body.description?.trim() || undefined,
      ctaType: body.ctaType as SupportedCtaType,
    });

    return NextResponse.json({ id: result.id });
  } catch (error) {
    return handleApiError(error);
  }
}

