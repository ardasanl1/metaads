"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Giriş başarısız");
        return;
      }
      const next = searchParams.get("next") || "/dashboard";
      router.push(next);
      router.refresh();
    } catch {
      setError("Giriş sırasında bir hata oluştu");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-md shadow-md">
        <CardHeader className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Meta Ads Panel</h1>
          <p className="text-sm text-muted-foreground">Hesabınıza giriş yapın</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                E-posta
              </label>
              <Input
                id="email"
                type="email"
                placeholder="ornek@firma.com"
                className="bg-background text-foreground"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Parola
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="bg-background text-foreground"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
