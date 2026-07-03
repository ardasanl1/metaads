"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Globe,
  LayoutGrid,
  MoreHorizontal,
  ScanSearch,
  Share2,
  Target,
} from "lucide-react";
import { AccountSetupDialog } from "@/components/campaign-wizard/AccountSetupDialog";
import { MetaAssetRow, type MetaAssetStatus } from "@/components/campaign-wizard/MetaAssetRow";
import { AssetPicker } from "@/components/campaigns/wizard/survey-ui";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AccountProfileDiscoveryResult } from "@/types/ad-account-profile";
import { isFacebookHostname } from "@/utils/url-normalize";

function assetStatus(
  loading: boolean,
  hasValue: boolean,
  source?: string,
): MetaAssetStatus {
  if (loading) return "loading";
  if (!hasValue) return "missing";
  if (source === "manual") return "manual";
  return "found";
}

type MetaAssetsSectionProps = {
  discovery: AccountProfileDiscoveryResult | null;
  loading: boolean;
  needsManualForm: boolean;
  pageOptions: AccountProfileDiscoveryResult["candidates"]["pages"];
  pixelOptions: AccountProfileDiscoveryResult["candidates"]["pixels"];
  websiteOptions: AccountProfileDiscoveryResult["candidates"]["websites"];
  required: { page: boolean; pixel: boolean; website: boolean };
  selectedPageId?: string;
  selectedPageName?: string;
  selectedPixelId?: string;
  selectedPixelName?: string;
  websiteUrl: string;
  onSelectPage: (id: string, name: string) => void;
  onSelectPixel: (id: string, name: string) => void;
  onWebsiteChange: (url: string) => void;
  onSaveManual: (input: {
    pageIdOrUrl?: string;
    pixelId?: string;
    websiteUrl?: string;
  }) => Promise<void>;
  onRescan: () => void;
};

export function MetaAssetsSection({
  discovery,
  loading,
  needsManualForm,
  pageOptions,
  pixelOptions,
  websiteOptions,
  required,
  selectedPageId,
  selectedPageName,
  selectedPixelId,
  selectedPixelName,
  websiteUrl,
  onSelectPage,
  onSelectPixel,
  onWebsiteChange,
  onSaveManual,
  onRescan,
}: MetaAssetsSectionProps) {
  const [setupOpen, setSetupOpen] = useState(false);
  const [pagePickerOpen, setPagePickerOpen] = useState(false);
  const [pixelPickerOpen, setPixelPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const profile = discovery?.profile;

  const pageName =
    selectedPageName ||
    profile?.page?.name ||
    pageOptions.find((p) => p.id === selectedPageId)?.name;

  const pixelName =
    selectedPixelName ||
    profile?.pixel?.name ||
    pixelOptions.find((p) => p.id === selectedPixelId)?.name;

  const instagramLabel = profile?.instagram?.username
    ? `@${profile.instagram.username}`
    : profile?.instagram?.id
      ? profile.instagram.id
      : undefined;

  const filteredWebsiteSuggestions = useMemo(
    () => websiteOptions.filter((w) => !isFacebookHostname(w.url) && !isFacebookHostname(w.domain)),
    [websiteOptions],
  );

  const showManualWarning =
    needsManualForm &&
    ((required.page && !profile?.page?.id && pageOptions.length === 0) ||
      (required.pixel && !profile?.pixel?.id && pixelOptions.length === 0));

  async function handleSaveManual(input: {
    pageIdOrUrl?: string;
    pixelId?: string;
    websiteUrl?: string;
  }) {
    setSaving(true);
    try {
      await onSaveManual(input);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Reklam hesabınızdan bulunan Meta varlıkları
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Meta hesapları işlemleri</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onRescan} disabled={loading}>
              <ScanSearch className="mr-2 h-4 w-4" />
              Yeniden tara
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSetupOpen(true)}>
              Hesap bilgilerini düzenle
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings/asset-diagnostics">Tanılamayı aç</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {required.page && (
        <MetaAssetRow
          icon={LayoutGrid}
          label="Facebook Sayfası"
          value={pageName}
          status={assetStatus(loading, Boolean(selectedPageId || profile?.page?.id), profile?.page?.source)}
          onChange={
            pageOptions.length > 1
              ? () => setPagePickerOpen((v) => !v)
              : undefined
          }
        />
      )}

      {pagePickerOpen && pageOptions.length > 1 && (
        <AssetPicker
          label="Facebook Sayfası"
          value={selectedPageId ?? ""}
          options={pageOptions.map((p) => ({ id: p.id, label: p.name }))}
          onChange={(id) => {
            const page = pageOptions.find((p) => p.id === id);
            if (page) onSelectPage(page.id, page.name);
            setPagePickerOpen(false);
          }}
        />
      )}

      <MetaAssetRow
        icon={Share2}
        label="Instagram"
        value={instagramLabel}
        status={instagramLabel ? assetStatus(loading, true, profile?.instagram?.source) : "optional"}
      />

      {required.pixel && (
        <MetaAssetRow
          icon={Target}
          label="Pixel / Dataset"
          value={pixelName}
          status={assetStatus(loading, Boolean(selectedPixelId || profile?.pixel?.id), profile?.pixel?.source)}
          onChange={
            pixelOptions.length > 1
              ? () => setPixelPickerOpen((v) => !v)
              : undefined
          }
        />
      )}

      {pixelPickerOpen && pixelOptions.length > 1 && (
        <AssetPicker
          label="Pixel / Dataset"
          value={selectedPixelId ?? ""}
          options={pixelOptions.map((p) => ({ id: p.id, label: p.name }))}
          onChange={(id) => {
            const pixel = pixelOptions.find((p) => p.id === id);
            if (pixel) onSelectPixel(pixel.id, pixel.name);
            setPixelPickerOpen(false);
          }}
        />
      )}

      {required.website && (
        <div className="border-b border-border/50 py-3 last:border-0">
          <div className="flex items-start gap-3">
            <Globe className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="website-url" className="text-xs font-medium text-muted-foreground">
                Website
              </Label>
              <Input
                id="website-url"
                type="url"
                value={websiteUrl}
                onChange={(e) => onWebsiteChange(e.target.value)}
                placeholder="https://ornek.com/urun"
              />
              {filteredWebsiteSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {filteredWebsiteSuggestions.slice(0, 4).map((w) => (
                    <Button
                      key={w.url}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => onWebsiteChange(w.url)}
                    >
                      {w.domain || w.url}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showManualWarning && (
        <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Meta hesabınızdan Facebook Sayfası ve Pixel otomatik bulunamadı.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setSetupOpen(true)}
          >
            Hesap bilgilerini tanımla
          </Button>
        </div>
      )}

      <AccountSetupDialog
        open={setupOpen}
        onOpenChange={setSetupOpen}
        required={required}
        initialPage={profile?.page?.id ?? ""}
        initialPixel={profile?.pixel?.id ?? ""}
        initialWebsite={websiteUrl}
        saving={saving}
        onSave={handleSaveManual}
      />
    </div>
  );
}
