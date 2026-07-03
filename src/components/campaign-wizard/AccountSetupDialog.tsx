"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AccountSetupDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  required: { page: boolean; pixel: boolean; website: boolean };
  initialPage?: string;
  initialPixel?: string;
  initialWebsite?: string;
  saving?: boolean;
  onSave: (input: {
    pageIdOrUrl?: string;
    pixelId?: string;
    websiteUrl?: string;
  }) => Promise<void>;
};

export function AccountSetupDialog({
  open,
  onOpenChange,
  required,
  initialPage = "",
  initialPixel = "",
  initialWebsite = "",
  saving = false,
  onSave,
}: AccountSetupDialogProps) {
  const [page, setPage] = useState(initialPage);
  const [pixel, setPixel] = useState(initialPixel);
  const [website, setWebsite] = useState(initialWebsite);

  useEffect(() => {
    if (open) {
      setPage(initialPage);
      setPixel(initialPixel);
      setWebsite(initialWebsite);
    }
  }, [open, initialPage, initialPixel, initialWebsite]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Hesap bilgilerini tanımla</DialogTitle>
          <DialogDescription>
            Facebook Sayfası ve Pixel bilgilerini bir kez girin. Kaydettikten sonra otomatik kullanılır.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {required.page && (
            <div className="space-y-1.5">
              <Label htmlFor="setup-page">Facebook Page URL veya ID</Label>
              <Input
                id="setup-page"
                value={page}
                onChange={(e) => setPage(e.target.value)}
                placeholder="https://facebook.com/sayfa veya 123456789"
              />
            </div>
          )}
          {required.pixel && (
            <div className="space-y-1.5">
              <Label htmlFor="setup-pixel">Pixel / Dataset ID</Label>
              <Input
                id="setup-pixel"
                value={pixel}
                onChange={(e) => setPixel(e.target.value)}
                placeholder="123456789012345"
              />
            </div>
          )}
          {required.website && (
            <div className="space-y-1.5">
              <Label htmlFor="setup-website">Varsayılan website URL</Label>
              <Input
                id="setup-website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://ornek.com/urun"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            İptal
          </Button>
          <Button
            disabled={saving}
            onClick={() =>
              void onSave({
                pageIdOrUrl: page || undefined,
                pixelId: pixel || undefined,
                websiteUrl: website || undefined,
              }).then(() => onOpenChange(false))
            }
          >
            {saving ? "Kaydediliyor..." : "Kaydet ve doğrula"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
