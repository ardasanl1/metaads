import { NextRequest, NextResponse } from "next/server";
import { setSessionCookie, verifyCredentials } from "@/lib/auth";
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
    if (!process.env.APP_EMAIL || !process.env.APP_PASSWORD) {
      return jsonError("Sunucu yapılandırması eksik", 500);
    }
    if (!verifyCredentials(body.email, body.password)) {
      return jsonError("Geçersiz e-posta veya şifre", 401);
    }
    const response = NextResponse.json({ ok: true });
    setSessionCookie(response);
    return response;
  } catch {
    return jsonError("Giriş işlemi başarısız", 500);
  }
}
