import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { getAdAccounts } from "@/lib/meta";
import { handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }
  try {
    const accounts = await getAdAccounts();
    return NextResponse.json({ accounts });
  } catch (error) {
    return handleApiError(error);
  }
}
