"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AccountProfileDiscoveryResult } from "@/types/ad-account-profile";
import { profileSourceLabel } from "@/utils/profile-source-label";
import { AssetPicker } from "./survey-ui";

type AccountProfilePanelProps = {
  discovery: AccountProfileDiscoveryResult | null;
  loading: boolean;
  needsManualForm: boolean;
  pageOptions: AccountProfileDiscoveryResult["candidates"]["pages"];
  pixelOptions: AccountProfileDiscoveryResult["candidates"]["pixels"];
  websiteOptions: AccountProfileDiscoveryResult["candidates"]["websites"];
  required: { page: boolean; pixel: boolean; website: boolean };
  selectedPageId?: string;
  selectedPixelId?: string;
  selectedWebsiteUrl?: string;
  onSelectPage: (id: string, name: string) => void;
  onSelectPixel: (id: string, name: string) => void;
  onSelectWebsite: (url: string) => void;
  onSaveManual: (input: {
    pageIdOrUrl?: string;
    pixelId?: string;
    websiteUrl?: string;
  }) => Promise<void>;
};

export function AccountProfilePanel({
  discovery,
  loading,
  needsManualForm,
  pageOptions,
  pixelOptions,
  websiteOptions,
  required,
  selectedPageId,
  selectedPixelId,
  selectedWebsiteUrl,
  onSelectPage,
  onSelectPixel,
  onSelectWebsite,
  onSaveManual,
}: AccountProfilePanelProps) {
  const [manualPage, setManualPage] = useState("");
  const [manualPixel, setManualPixel] = useState("");
  const [manualWebsite, setManualWebsite] = useState("");
  const [saving, setSaving] = useState(false);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Reklam hesabi profili yukleniyor...</p>;
  }

  const profile = discovery?.profile;
  const hasFound =
    profile?.page?.id || profile?.pixel?.id || profile?.website?.url;

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      {hasFound && (
        <div className="space-y-2 text-sm">
          <p className="font-medium">Reklam hesabinizdan su bilgiler bulundu:</p>
          {profile?.page?.id && (
            <div>
              Facebook Page: <b>{profile.page.name}</b>
              <span className="ml-2 text-muted-foreground">
                ({profileSourceLabel(profile.page.source)})
              </span>
            </div>
          )}
          {profile?.instagram?.id && (
            <div>
              Instagram: <b>{profile.instagram.username ?? profile.instagram.id}</b>
            </div>
          )}
          {profile?.pixel?.id && (
            <div>
              Pixel/Dataset: <b>{profile.pixel.name}</b>
              <span className="ml-2 text-muted-foreground">
                ({profileSourceLabel(profile.pixel.source)})
              </span>
            </div>
          )}
          {profile?.website?.url && (
            <div>
              Website: <b>{profile.website.domain ?? profile.website.url}</b>
              <span className="ml-2 text-muted-foreground">
                ({profileSourceLabel(profile.website.source)})
              </span>
            </div>
          )}
        </div>
      )}

      {required.page && pageOptions.length > 1 && (
        <AssetPicker
          label="Facebook Page"
          value={selectedPageId ?? ""}
          options={pageOptions.map((p) => ({ id: p.id, label: p.name }))}
          onChange={(id) => {
            const page = pageOptions.find((p) => p.id === id);
            if (page) onSelectPage(page.id, page.name);
          }}
        />
      )}

      {required.pixel && pixelOptions.length > 1 && (
        <AssetPicker
          label="Pixel/Dataset"
          value={selectedPixelId ?? ""}
          options={pixelOptions.map((p) => ({ id: p.id, label: p.name }))}
          onChange={(id) => {
            const pixel = pixelOptions.find((p) => p.id === id);
            if (pixel) onSelectPixel(pixel.id, pixel.name);
          }}
        />
      )}

      {required.website && websiteOptions.length > 1 && (
        <AssetPicker
          label="Website"
          value={selectedWebsiteUrl ?? ""}
          options={websiteOptions.map((w) => ({ id: w.url, label: w.domain }))}
          onChange={(url) => onSelectWebsite(url)}
        />
      )}

      {needsManualForm && (
        <div className="space-y-3 border-t pt-3">
          <p className="text-sm text-yellow-800">
            Meta&apos;dan otomatik bulunamadi, bir kez tanimlayin.
          </p>
          {required.page && !profile?.page?.id && pageOptions.length === 0 && (
            <div>
              <Label>Facebook Page URL veya ID</Label>
              <Input value={manualPage} onChange={(e) => setManualPage(e.target.value)} />
            </div>
          )}
          {required.pixel && !profile?.pixel?.id && pixelOptions.length === 0 && (
            <div>
              <Label>Pixel/Dataset ID</Label>
              <Input value={manualPixel} onChange={(e) => setManualPixel(e.target.value)} />
            </div>
          )}
          {required.website && !profile?.website?.url && websiteOptions.length === 0 && (
            <div>
              <Label>Varsayilan website URL</Label>
              <Input value={manualWebsite} onChange={(e) => setManualWebsite(e.target.value)} />
            </div>
          )}
          <Button
            size="sm"
            disabled={saving}
            onClick={() => {
              setSaving(true);
              void onSaveManual({
                pageIdOrUrl: manualPage || undefined,
                pixelId: manualPixel || undefined,
                websiteUrl: manualWebsite || undefined,
              }).finally(() => setSaving(false));
            }}
          >
            {saving ? "Kaydediliyor..." : "Kaydet ve dogrula"}
          </Button>
        </div>
      )}
    </div>
  );
}
