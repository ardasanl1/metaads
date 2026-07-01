import { NextRequest, NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { hasCredentialEnv } from "@/lib/credentials";
import { authenticatePanelUser } from "@/lib/user-db";
import { jsonError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.trim();
    const password = body.password ?? "";

    if (!email) {
      return jsonError("E-posta gerekli", 400);
    }
    if (!password) {
      return jsonError("Şifre gerekli", 400);
    }

    if (!hasCredentialEnv()) {
      console.error("Login blocked: APP_EMAIL veya APP_PASSWORD tanimli degil");
      return jsonError("Sunucu yapılandırması eksik (APP_EMAIL / APP_PASSWORD)", 500);
    }

    const user = await authenticatePanelUser(email, password);
    if (!user) {
      return jsonError("Geçersiz e-posta veya şifre", 401);
    }

    const response = NextResponse.json({ ok: true });
    setSessionCookie(response);
    return response;
  } catch (error) {
    console.error("Login error:", error);
    return jsonError("Giriş işlemi başarısız", 500);
  }
}
