import { NextRequest } from "next/server";
import { isAuthenticatedRequest, unauthorizedResponse } from "@/lib/auth";
import { jsonError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedResponse();
  }

  return jsonError("OAuth baglantisi bu asamada devre disi. Manuel Access Token kullanin.", 503);
}
