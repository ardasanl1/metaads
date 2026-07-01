import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { getBusinesses } from "@/lib/meta";
import { handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const businesses = await getBusinesses();
    return NextResponse.json({ businesses });
  } catch (error) {
    return handleApiError(error);
  }
}
