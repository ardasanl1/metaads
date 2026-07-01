import { NextRequest, NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { authenticatePanelUser } from "@/lib/user-db";
import { jsonError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    if (!body.email || typeof body.email !== "string") {
      return jsonError("E-posta gerekli", 400);
    }
    if (!body.password || typeof body.password !== "string") {
      return jsonError("Şifre gerekli", 400);
    }

    const user = await authenticatePanelUser(body.email, body.password);
    if (!user) {
      return jsonError("Geçersiz e-posta veya şifre", 401);
    }

    const response = NextResponse.json({ ok: true });
    setSessionCookie(response);
    return response;
  } catch {
    return jsonError("Giriş işlemi başarısız", 500);
  }
}
