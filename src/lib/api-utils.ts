import { NextResponse } from "next/server";
import { MetaApiError } from "./meta";

export function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof MetaApiError) {
    return jsonError(error.message, error.status);
  }

  if (error instanceof Error) {
    if (error.message.includes("SESSION_SECRET tanimli degil")) {
      return jsonError("SESSION_SECRET tanimli degil", 500);
    }
    if (error.message.includes("Sifreli veri gecersiz")) {
      return jsonError("Kayitli gizli veri okunamadi", 500);
    }
  }

  console.error("API hatasi:", error instanceof Error ? error.message : error);
  return jsonError("Beklenmeyen bir hata olustu", 500);
}
