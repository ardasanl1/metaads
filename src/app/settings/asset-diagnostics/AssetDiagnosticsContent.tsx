"use client";

import { useCallback, useState } from "react";
import { useMetaAccount } from "@/hooks/use-meta-account";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type DiagnosticsPanel = {
  connectionId: string;
  tokenSubject: { id: string; name: string };
  grantedPermissions: string[];
  pagesRequest: {
    succeeded: boolean;
    resultCount: number;
    responseDataParsed: boolean;
    errorMessage?: string;
  };
  pages: Array<{
    id: string;
    name: string;
    tasks: string[];
    usableForAds: boolean;
    hasInstagramBusinessAccount: boolean;
  }>;
  instagram: {
    instagramBasicGranted: boolean;
    resultCount: number;
    reason?: string;
  };
  instagramAccounts: Array<{ id: string; username?: string; pageId?: string; pageName?: string }>;
  reason?: string;
  errors: Array<{ source: string; code?: number; message: string }>;
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
        forceRefresh: "1",
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
            Page ve Instagram kesfi (token gosterilmez).
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
              <div><b>tokenSubject:</b> {data.tokenSubject.name || "-"} ({data.tokenSubject.id || "-"})</div>
              <div><b>grantedPermissions:</b> {data.grantedPermissions.join(", ") || "-"}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Page Discovery (/me/accounts)</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div><b>succeeded:</b> {data.pagesRequest.succeeded ? "evet" : "hayir"}</div>
              <div><b>resultCount:</b> {data.pagesRequest.resultCount}</div>
              <div><b>responseDataParsed:</b> {data.pagesRequest.responseDataParsed ? "evet" : "hayir"}</div>
              {data.pagesRequest.errorMessage && <div><b>hata:</b> {data.pagesRequest.errorMessage}</div>}
              <div><b>reason:</b> {data.reason ?? "-"}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Pages</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.pages.length === 0 ? (
                <p>Page bulunamadi</p>
              ) : (
                data.pages.map((page) => (
                  <div key={page.id} className="rounded border border-border/60 p-2">
                    <div><b>{page.name}</b> ({page.id})</div>
                    <div>tasks: {page.tasks.join(", ") || "-"}</div>
                    <div>usableForAds: {page.usableForAds ? "true" : "false"}</div>
                    <div>hasInstagramBusinessAccount: {page.hasInstagramBusinessAccount ? "true" : "false"}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Instagram</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div><b>instagram_basic:</b> {data.instagram.instagramBasicGranted ? "granted" : "missing"}</div>
              <div><b>resultCount:</b> {data.instagram.resultCount}</div>
              {data.instagram.reason && <div><b>reason:</b> {data.instagram.reason}</div>}
              {data.instagramAccounts.map((ig) => (
                <div key={ig.id} className="rounded border border-border/60 p-2">
                  @{ig.username ?? ig.id} · page: {ig.pageName ?? ig.pageId}
                </div>
              ))}
            </CardContent>
          </Card>

          {data.errors.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Hatalar</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm text-destructive">
                {data.errors.map((err, i) => (
                  <div key={`${err.source}-${i}`}>{err.source}: {err.message}</div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
