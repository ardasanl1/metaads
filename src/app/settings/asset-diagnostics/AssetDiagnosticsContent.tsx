"use client";

import { useCallback, useState } from "react";
import { useMetaAccount } from "@/hooks/use-meta-account";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type DiagnosticsPanel = {
  token: {
    subjectName?: string;
    subjectId?: string;
    tokenType?: string;
    grantedPermissions: string[];
    missingPermissions: string[];
    requestErrors: string[];
  };
  pages: {
    userAccountsSucceeded: boolean;
    userAccountsCount: number;
    businessFallbackRan: boolean;
    availableForAdsCount: number;
    reason?: string;
    pages: Array<{ id: string; name: string; tasks: string[]; source: string; available?: boolean }>;
  };
  pixels: {
    normalizedAdAccountId: string;
    adAccountAccessible: boolean;
    pixelRequestSucceeded: boolean;
    resultCount: number;
    reason?: string;
    metaErrorCode?: number;
  };
};

export default function AssetDiagnosticsContent() {
  const { activeConnectionId, activeConnection, selectedAdAccountId } = useMetaAccount();
  const [data, setData] = useState<DiagnosticsPanel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const runDiagnostics = useCallback(async () => {
    if (!activeConnectionId || !selectedAdAccountId) {
      setError("Baglanti ve reklam hesabi secin");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        connectionId: activeConnectionId,
        adAccountId: selectedAdAccountId,
      });
      if (activeConnection?.metaBusinessId) {
        params.set("businessId", activeConnection.metaBusinessId);
      }
      const res = await fetch(`/api/meta/assets/diagnostics-panel?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Tani basarisiz");
      setData(json as DiagnosticsPanel);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tani basarisiz");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [activeConnectionId, activeConnection?.metaBusinessId, selectedAdAccountId]);

  if (process.env.NODE_ENV === "production") {
    return <p className="text-sm text-muted-foreground">Bu sayfa yalnizca development ortaminda kullanilabilir.</p>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Meta Asset Diagnostics</CardTitle>
          <CardDescription>
            Page ve Pixel kesfi icin token yetenekleri ve API sonuclari (token gosterilmez).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={() => void runDiagnostics()} disabled={loading}>
            {loading ? "Calisiyor..." : "Tani calistir"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {data && (
        <>
          <Card>
            <CardHeader><CardTitle>Token</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div><b>Subject:</b> {data.token.subjectName ?? "-"} ({data.token.subjectId ?? "-"})</div>
              <div><b>Type:</b> {data.token.tokenType ?? "unknown"}</div>
              <div><b>Granted:</b> {data.token.grantedPermissions.join(", ") || "-"}</div>
              <div><b>Missing:</b> {data.token.missingPermissions.join(", ") || "-"}</div>
              {data.token.requestErrors.length > 0 && (
                <div className="text-destructive"><b>Errors:</b> {data.token.requestErrors.join("; ")}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Pages</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div><b>/me/accounts basarili:</b> {data.pages.userAccountsSucceeded ? "evet" : "hayir"}</div>
              <div><b>Page sayisi:</b> {data.pages.userAccountsCount}</div>
              <div><b>Business fallback:</b> {data.pages.businessFallbackRan ? "evet" : "hayir"}</div>
              <div><b>Reklam icin kullanilabilir:</b> {data.pages.availableForAdsCount}</div>
              {data.pages.reason && <div className="text-destructive"><b>Neden:</b> {data.pages.reason}</div>}
              {data.pages.pages.map((p) => (
                <div key={p.id} className="rounded border p-2">
                  {p.name} · {p.id} · tasks: [{p.tasks.join(", ")}] · {p.source}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Pixels</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div><b>Normalize Ad Account:</b> {data.pixels.normalizedAdAccountId}</div>
              <div><b>Ad Account erisimi:</b> {data.pixels.adAccountAccessible ? "evet" : "hayir"}</div>
              <div><b>/adspixels basarili:</b> {data.pixels.pixelRequestSucceeded ? "evet" : "hayir"}</div>
              <div><b>Pixel sayisi:</b> {data.pixels.resultCount}</div>
              {data.pixels.metaErrorCode && <div><b>Meta error code:</b> {data.pixels.metaErrorCode}</div>}
              {data.pixels.reason && <div className="text-destructive"><b>Neden:</b> {data.pixels.reason}</div>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
