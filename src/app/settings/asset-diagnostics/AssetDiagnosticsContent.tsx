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
  adAccount: { normalizedId: string; accessible: boolean };
  pageDiscovery: {
    promotePagesRequestSucceeded: boolean;
    promotePagesCount: number;
    userAccountsRequestSucceeded: boolean;
    userAccountsCount: number;
    businessOwnedRequestSucceeded: boolean;
    businessOwnedCount: number;
    businessClientRequestSucceeded: boolean;
    businessClientCount: number;
    mergedPageCount: number;
  };
  pages: Array<{
    id: string;
    name: string;
    sources: string[];
    tasks?: string[];
    usableForAds: boolean;
    excludeReason?: string;
  }>;
  usablePages: Array<{
    id: string;
    name: string;
    sources: string[];
    tasks?: string[];
    usableForAds: boolean;
  }>;
  errors: Array<{ source: string; code?: number; type?: string; message: string }>;
  reason?: string;
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
            Page kesfi: promote_pages oncelikli, kaynak bazli sonuclar (token gosterilmez).
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Ad Account</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div><b>Normalize ID:</b> {data.adAccount.normalizedId || "-"}</div>
              <div><b>Erisim:</b> {data.adAccount.accessible ? "evet" : "hayir"}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Page Discovery</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div><b>promote_pages basarili:</b> {data.pageDiscovery.promotePagesRequestSucceeded ? "evet" : "hayir"} · <b>sayi:</b> {data.pageDiscovery.promotePagesCount}</div>
              <div><b>/me/accounts basarili:</b> {data.pageDiscovery.userAccountsRequestSucceeded ? "evet" : "hayir"} · <b>sayi:</b> {data.pageDiscovery.userAccountsCount}</div>
              <div><b>business owned:</b> {data.pageDiscovery.businessOwnedRequestSucceeded ? "evet" : "hayir"} · <b>sayi:</b> {data.pageDiscovery.businessOwnedCount}</div>
              <div><b>business client:</b> {data.pageDiscovery.businessClientRequestSucceeded ? "evet" : "hayir"} · <b>sayi:</b> {data.pageDiscovery.businessClientCount}</div>
              <div><b>Birlesme sonrasi:</b> {data.pageDiscovery.mergedPageCount} · <b>Kullanilabilir:</b> {data.usablePages.length}</div>
              {data.reason && <div className="text-muted-foreground"><b>Sonuc:</b> {data.reason}</div>}
              {data.errors.map((e, i) => (
                <div key={i} className="text-destructive text-xs">{e.source}: {e.message}</div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Pages (tum adaylar)</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.pages.map((p) => (
                <div key={p.id} className="rounded border p-2">
                  <div>{p.name} · {p.id}</div>
                  <div>sources: [{p.sources.join(", ")}] · usable: {p.usableForAds ? "evet" : "hayir"}</div>
                  {p.tasks && p.tasks.length > 0 && <div>tasks: [{p.tasks.join(", ")}]</div>}
                  {p.excludeReason && <div className="text-destructive">elendi: {p.excludeReason}</div>}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Pixels</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div><b>Normalize Ad Account:</b> {data.pixels.normalizedAdAccountId}</div>
              <div><b>/adspixels basarili:</b> {data.pixels.pixelRequestSucceeded ? "evet" : "hayir"} · <b>sayi:</b> {data.pixels.resultCount}</div>
              {data.pixels.reason && <div className="text-destructive">{data.pixels.reason}</div>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
