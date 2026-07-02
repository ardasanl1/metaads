import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { getMetaConnection } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { uploadAdImage } from "@/lib/meta";

export async function POST(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }
  try {
    const connection = await getMetaConnection();
    if (!connection?.selectedAdAccountId) {
      return jsonError("Reklam hesabı seçilmedi", 400);
    }

    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File)) {
      return jsonError("Görsel dosyası gerekli", 400);
    }

    const uploaded = await uploadAdImage(connection.selectedAdAccountId, file);
    return NextResponse.json({ imageHash: uploaded.hash });
  } catch (error) {
    return handleApiError(error);
  }
}

