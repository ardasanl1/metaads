"use client";

import { useCallback, useState } from "react";
import { useMetaAccount } from "@/hooks/use-meta-account";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type DiagnosticsPanel = {
  connectionId: string;
  token: {
    subjectName?: string;
    subjectId?: string;
    tokenType?: string;
    grantedPermissions: string[];
    missingPermissions: string[];
    requestErrors: string[];
  };
  adAccount: { normalizedId: string; accessible: boolean };
  meAccounts: { requestSucceeded: boolean; resultCount: number; empty: boolean; errorMessage?: string };
  pageDiscovery: {
    businessesCount: number;
    userAccountsRequestSucceeded: boolean;
    userAccountsCount: number;
    businessOwnedRequestSucceeded: boolean;
    businessOwnedCount: number;
    businessClientRequestSucceeded: boolean;
    businessClientCount: number;
    mergedPageCount: number;
  };
  pages: Array<{ id: string; name: string; sources: string[]; tasks?: string[] }>;
  usablePages: Array<{ id: string; name: string; sources: string[] }>;
  errors: Array<{ source: string; code?: number; message: string }>;
  status?: string[];
  reason?: string;
  pixels: {
    normalizedAdAccountId: string;
    adAccountAccessible: boolean;
    adspixels: { requestSucceeded: boolean; resultCount: number; empty: boolean; errorMessage?: string };
    customConversions: { requestSucceeded: boolean; pixelCount: number };
    historicalAdSets: { requestSucceeded: boolean; pixelCount: number };
    resultCount: number;
    directlyVerifiedCount: number;
    status?: string[];
    reason?: string;
    metaErrorCode?: number;
  };
  instagram: { fromPages: number; fromAdAccount: number; mergedCount: number };
  instagramAccounts: Array<{ id: string; username?: string; pageId?: string }>;
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
            Manuel token ile Page, Pixel ve Instagram kesfi (token gosterilmez).
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
            <CardHeader><CardTitle>Baglanti</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div><b>connectionId:</b> {data.connectionId}</div>
              <div><b>Subject:</b> {data.token.subjectName ?? "-"} ({data.token.subjectId ?? "-"})</div>
              <div><b>Token turu:</b> {data.token.tokenType ?? "unknown"}</div>
              <div><b>Granted:</b> {data.token.grantedPermissions.join(", ") || "-"}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Page Discovery</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div><b>/me/accounts basarili:</b> {data.meAccounts.requestSucceeded ? "evet" : "hayir"} · <b>sayi:</b> {data.meAccounts.resultCount}</div>
              <div><b>Business sayisi:</b> {data.pageDiscovery.businessesCount}</div>
              <div><b>owned_pages:</b> {data.pageDiscovery.businessOwnedCount} · <b>client_pages:</b> {data.pageDiscovery.businessClientCount}</div>
              <div><b>Birlesme:</b> {data.pageDiscovery.mergedPageCount} · <b>Kullanilabilir:</b> {data.usablePages.length}</div>
              {data.reason && <div><b>Sonuc:</b> {data.reason}</div>}
              {data.errors.map((e, i) => (
                <div key={i} className="text-destructive text-xs">{e.source}{e.code ? ` [${e.code}]` : ""}: {e.message}</div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Pages</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.pages.map((p) => (
                <div key={p.id} className="rounded border p-2">
                  <div>{p.name} · {p.id}</div>
                  <div>sources: [{p.sources.join(", ")}]</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Pixels</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div><b>Ad Account:</b> {data.pixels.normalizedAdAccountId}</div>
              <div><b>/adspixels basarili:</b> {data.pixels.adspixels.requestSucceeded ? "evet" : "hayir"} · <b>sayi:</b> {data.pixels.adspixels.resultCount} · <b>bos:</b> {data.pixels.adspixels.empty ? "evet" : "hayir"}</div>
              <div><b>custom conversion pixel:</b> {data.pixels.customConversions.pixelCount}</div>
              <div><b>historical adset pixel:</b> {data.pixels.historicalAdSets.pixelCount}</div>
              <div><b>Dogrudan dogrulanan:</b> {data.pixels.directlyVerifiedCount}</div>
              {data.pixels.reason && <div className="text-muted-foreground">{data.pixels.reason}</div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Instagram</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div><b>Page kaynagi:</b> {data.instagram.fromPages} · <b>Ad account:</b> {data.instagram.fromAdAccount} · <b>Toplam:</b> {data.instagram.mergedCount}</div>
              {data.instagramAccounts.map((ig) => (
                <div key={ig.id}>{ig.username ? `@${ig.username}` : ig.id} · page: {ig.pageId ?? "-"}</div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
