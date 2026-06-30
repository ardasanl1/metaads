import { NextRequest, NextResponse } from "next/server";
import { setSessionCookie, verifyPassword } from "@/lib/auth";
import { jsonError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { password?: string };
    if (!body.password || typeof body.password !== "string") {
      return jsonError("Parola gerekli", 400);
    }
    if (!process.env.APP_PASSWORD) {
      return jsonError("Sunucu yapılandırması eksik", 500);
    }
    if (!verifyPassword(body.password)) {
      return jsonError("Geçersiz parola", 401);
    }
    const response = NextResponse.json({ ok: true });
    setSessionCookie(response);
    return response;
  } catch {
    return jsonError("Giriş işlemi başarısız", 500);
  }
}
