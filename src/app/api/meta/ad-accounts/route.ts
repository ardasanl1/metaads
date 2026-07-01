import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { getAdAccountsForBusiness, getUserAdAccounts } from "@/lib/meta";
import { handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    const businessId = request.nextUrl.searchParams.get("businessId");
    const adAccounts = businessId
      ? await getAdAccountsForBusiness(businessId)
      : await getUserAdAccounts();

    return NextResponse.json({ adAccounts });
  } catch (error) {
    return handleApiError(error);
  }
}
