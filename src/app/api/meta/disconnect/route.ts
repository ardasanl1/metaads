import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { deleteMetaConnection } from "@/lib/db";
import { handleApiError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }
  try {
    await deleteMetaConnection();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
