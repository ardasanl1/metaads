"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import PanelLayout from "@/components/PanelLayout";
import { CampaignInsightsGrid } from "@/components/campaigns/CampaignInsightsGrid";
import { QuickDateFilterBar } from "@/components/filters/QuickDateFilterBar";
import { DataDateRangeCaption } from "@/components/cards/DataDateRangeCaption";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCampaignDetail, type PendingAction } from "@/hooks/use-campaign-detail";
import { useDateFilter } from "@/hooks/use-date-filter";
import { useMetaAccount } from "@/hooks/use-meta-account";
import { formatMetaDate } from "@/lib/status-utils";
import { centsToCurrency, formatCurrency } from "@/utils/format";
import { getObjectiveLabel } from "@/utils/campaign-constants";
import { formatInsightValue, INSIGHT_COLUMNS } from "@/utils/insight-display";
import { formatMetaStatusLabel } from "@/utils/status-labels";

function statusVariant(status: string): "success" | "warning" | "muted" | "secondary" {
  const normalized = status.toUpperCase();
  if (normalized === "ACTIVE") return "success";
  if (normalized.includes("PAUSED")) return "warning";
  return "muted";
}

function dailyBudgetLabel(value?: string): string {
  const amount = centsToCurrency(value);
  return amount !== null ? formatCurrency(amount) : "—";
}

function CampaignDetailBody() {
  const params = useParams();
  const campaignId = params.id as string;
  const dateFilter = useDateFilter();
  const { isReady, accountKey, selectedAdAccountName } = useMetaAccount();
  const {
    campaign,
    adsets,
    ads,
    selectedAdSetId,
    setSelectedAdSetId,
    loading,
    adsLoading,
    error,
    submitting,
    executePending,
    reload,
  } = useCampaignDetail(campaignId, isReady, dateFilter, accountKey);

  const [pending, setPending] = useState<PendingAction | null>(null);
  const [campaignName, setCampaignName] = useState("");
  const [editAdSetId, setEditAdSetId] = useState<string | null>(null);
  const [adSetName, setAdSetName] = useState("");
  const [adSetBudget, setAdSetBudget] = useState("");
  const [editAdId, setEditAdId] = useState<string | null>(null);
  const [adName, setAdName] = useState("");

  useEffect(() => {
    if (campaign) {
      setCampaignName(campaign.name);
    }
  }, [campaign]);

  function openAdSetEdit(adset: (typeof adsets)[number]) {
    setEditAdSetId(adset.id);
    setAdSetName(adset.name);
    setAdSetBudget(adset.daily_budget ? String(Number(adset.daily_budget) / 100) : "");
  }

  function openAdEdit(ad: (typeof ads)[number]) {
    setEditAdId(ad.id);
    setAdName(ad.name);
  }

  async function handleConfirm() {
    if (!pending) return;
    try {
      await executePending(pending);
      setEditAdSetId(null);
      setEditAdId(null);
    } catch {
      // toast handled in hook
    } finally {
      setPending(null);
    }
  }

  const selectedAdSet = adsets.find((item) => item.id === selectedAdSetId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" size="sm" asChild className="w-fit px-0 hover:bg-transparent">
          <Link href="/campaigns">← Kampanyalara dön</Link>
        </Button>
        <Button variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
          Yenile
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {isReady && (
        <QuickDateFilterBar
          value={dateFilter}
          onChange={(value) => dateFilter.setState(value)}
        />
      )}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-24 w-full" />
            ))}
          </div>
        </div>
      ) : campaign ? (
        <>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">{campaign.name}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant(campaign.status)}>
                {formatMetaStatusLabel(campaign.status)}
              </Badge>
              <Badge variant={statusVariant(campaign.effective_status)}>
                {formatMetaStatusLabel(campaign.effective_status)}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {getObjectiveLabel(campaign.objective)} · Güncellenme:{" "}
                {formatMetaDate(campaign.updated_time)}
              </span>
            </div>
          </div>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList>
              <TabsTrigger value="overview">Genel Bakış</TabsTrigger>
              <TabsTrigger value="adsets">Reklam Setleri</TabsTrigger>
              <TabsTrigger value="ads">Reklamlar</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <CampaignInsightsGrid insights={campaign.insights} loading={loading} />
              <DataDateRangeCaption
                filter={dateFilter.quickDateFilter}
                since={dateFilter.since}
                until={dateFilter.until}
                accountName={selectedAdAccountName}
              />

              <Card>
                <CardHeader>
                  <CardTitle>Kampanya Ayarları</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="campaignName">Kampanya adı</Label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        id="campaignName"
                        value={campaignName || campaign.name}
                        onChange={(event) => setCampaignName(event.target.value)}
                      />
                      <Button
                        type="button"
                        disabled={submitting || campaignName === campaign.name}
                        onClick={() => setPending({ type: "campaign-name", name: campaignName })}
                      >
                        Adı Kaydet
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={submitting || campaign.status === "ACTIVE"}
                      onClick={() => setPending({ type: "campaign-status", status: "ACTIVE" })}
                    >
                      Aktif Et
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={submitting || campaign.status === "PAUSED"}
                      onClick={() => setPending({ type: "campaign-status", status: "PAUSED" })}
                    >
                      Duraklat
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="adsets" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Reklam Setleri</CardTitle>
                </CardHeader>
                <CardContent className="p-0 sm:p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ad</TableHead>
                          <TableHead>Durum</TableHead>
                          <TableHead>Günlük Bütçe</TableHead>
                          {INSIGHT_COLUMNS.map((column) => (
                            <TableHead key={column.key}>{column.label}</TableHead>
                          ))}
                          <TableHead className="text-right">İşlem</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adsets.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={INSIGHT_COLUMNS.length + 4} className="text-center text-muted-foreground">
                              Reklam seti bulunamadı
                            </TableCell>
                          </TableRow>
                        ) : (
                          adsets.map((adset) => (
                            <TableRow
                              key={adset.id}
                              data-state={selectedAdSetId === adset.id ? "selected" : undefined}
                            >
                              <TableCell className="font-medium">{adset.name}</TableCell>
                              <TableCell>
                                <Badge variant={statusVariant(adset.status)}>
                                  {formatMetaStatusLabel(adset.status)}
                                </Badge>
                              </TableCell>
                              <TableCell>{dailyBudgetLabel(adset.daily_budget)}</TableCell>
                              {INSIGHT_COLUMNS.map((column) => (
                                <TableCell key={column.key}>
                                  {formatInsightValue(adset.insights, column.key, column.format)}
                                </TableCell>
                              ))}
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setSelectedAdSetId(adset.id)}>
                                      Reklamları Göster
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openAdSetEdit(adset)}>
                                      Düzenle
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        setPending({ type: "adset-status", id: adset.id, status: "ACTIVE" })
                                      }
                                    >
                                      Aktif Et
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        setPending({ type: "adset-status", id: adset.id, status: "PAUSED" })
                                      }
                                    >
                                      Duraklat
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {editAdSetId && (
                <Card>
                  <CardHeader>
                    <CardTitle>Reklam Seti Düzenle</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Input
                      value={adSetName}
                      onChange={(event) => setAdSetName(event.target.value)}
                      placeholder="Reklam seti adı"
                    />
                    <Input
                      type="number"
                      value={adSetBudget}
                      onChange={(event) => setAdSetBudget(event.target.value)}
                      placeholder="Günlük bütçe (TL)"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        disabled={submitting}
                        onClick={() =>
                          setPending({ type: "adset-name", id: editAdSetId, name: adSetName })
                        }
                      >
                        Adı Kaydet
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={submitting || !adSetBudget}
                        onClick={() =>
                          setPending({
                            type: "adset-budget",
                            id: editAdSetId,
                            dailyBudget: Number(adSetBudget),
                          })
                        }
                      >
                        Bütçeyi Kaydet
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setEditAdSetId(null)}>
                        İptal
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="ads" className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Label className="shrink-0">Reklam seti</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm sm:max-w-xs"
                  value={selectedAdSetId}
                  onChange={(event) => setSelectedAdSetId(event.target.value)}
                >
                  {adsets.map((adset) => (
                    <option key={adset.id} value={adset.id}>
                      {adset.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedAdSet && (
                <p className="text-sm text-muted-foreground">
                  Seçili set: {selectedAdSet.name}
                </p>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Reklamlar</CardTitle>
                </CardHeader>
                <CardContent className="p-0 sm:p-0">
                  {adsLoading ? (
                    <div className="space-y-3 p-4">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton key={index} className="h-10 w-full" />
                      ))}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ad</TableHead>
                            <TableHead>Durum</TableHead>
                            <TableHead>Güncellenme</TableHead>
                            {INSIGHT_COLUMNS.map((column) => (
                              <TableHead key={column.key}>{column.label}</TableHead>
                            ))}
                            <TableHead className="text-right">İşlem</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ads.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={INSIGHT_COLUMNS.length + 4}
                                className="text-center text-muted-foreground"
                              >
                                Reklam bulunamadı
                              </TableCell>
                            </TableRow>
                          ) : (
                            ads.map((ad) => (
                              <TableRow key={ad.id}>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {ad.creative?.thumbnail_url && (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={ad.creative.thumbnail_url}
                                        alt=""
                                        className="h-8 w-8 rounded object-cover"
                                      />
                                    )}
                                    <span className="font-medium">{ad.name}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={statusVariant(ad.status)}>
                                    {formatMetaStatusLabel(ad.status)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {formatMetaDate(ad.updated_time)}
                                </TableCell>
                                {INSIGHT_COLUMNS.map((column) => (
                                  <TableCell key={column.key}>
                                    {formatInsightValue(ad.insights, column.key, column.format)}
                                  </TableCell>
                                ))}
                                <TableCell className="text-right">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => openAdEdit(ad)}>
                                        Düzenle
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() =>
                                          setPending({ type: "ad-status", id: ad.id, status: "ACTIVE" })
                                        }
                                      >
                                        Aktif Et
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() =>
                                          setPending({ type: "ad-status", id: ad.id, status: "PAUSED" })
                                        }
                                      >
                                        Duraklat
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {editAdId && (
                <Card>
                  <CardHeader>
                    <CardTitle>Reklam Düzenle</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Input
                      value={adName}
                      onChange={(event) => setAdName(event.target.value)}
                      placeholder="Reklam adı"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        disabled={submitting}
                        onClick={() => setPending({ type: "ad-name", id: editAdId, name: adName })}
                      >
                        Adı Kaydet
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setEditAdId(null)}>
                        İptal
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </>
      ) : (
        !error && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Kampanya bulunamadı
            </CardContent>
          </Card>
        )
      )}

      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Değişikliği Onayla</DialogTitle>
            <DialogDescription>
              Bu değişiklik doğrudan Meta reklam hesabına uygulanacak. Devam edilsin mi?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={submitting} onClick={() => setPending(null)}>
              İptal
            </Button>
            <Button disabled={submitting} onClick={() => void handleConfirm()}>
              {submitting ? "Uygulanıyor..." : "Devam Et"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CampaignDetailContent() {
  return (
    <PanelLayout title="Kampanya Detayı">
      <CampaignDetailBody />
    </PanelLayout>
  );
}
