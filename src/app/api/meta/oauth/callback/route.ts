import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";

function appOrigin(request: NextRequest): string {
  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  return NextResponse.redirect(`${appOrigin(request)}/settings?oauth=disabled`);
}
