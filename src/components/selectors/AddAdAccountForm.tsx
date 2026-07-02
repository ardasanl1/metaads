"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AddAdAccountFormProps = {
  onAdd: (adAccountId: string) => Promise<void>;
  disabled?: boolean;
};

export function AddAdAccountForm({ onAdd, disabled = false }: AddAdAccountFormProps) {
  const [open, setOpen] = useState(false);
  const [adAccountId, setAdAccountId] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const trimmed = adAccountId.trim();
    if (!trimmed) {
      toast.error("Reklam hesabı ID girin");
      return;
    }

    setLoading(true);
    try {
      await onAdd(trimmed);
      setAdAccountId("");
      setOpen(false);
      toast.success("Reklam hesabı firmaya eklendi");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Hesap eklenemedi";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="shrink-0"
      >
        <Plus className="h-4 w-4" />
        Reklam Hesabı Ekle
      </Button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
      <div className="flex min-w-0 flex-col gap-1.5 sm:w-56">
        <label className="text-xs font-medium text-muted-foreground">Meta Reklam Hesabı ID</label>
        <Input
          value={adAccountId}
          onChange={(event) => setAdAccountId(event.target.value)}
          placeholder="act_123456789 veya 123456789"
          disabled={loading}
          className="bg-background text-foreground"
        />
        <p className="text-[11px] text-muted-foreground">
          Nereden:{" "}
          <a
            href="https://business.facebook.com/settings/ad-accounts"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-2 hover:underline"
          >
            Business Manager → Reklam Hesapları
          </a>
          {" → hesap adının altındaki "}
          <code className="rounded bg-muted px-1 py-0.5 text-[10px]">act_...</code> ID. Sadece rakam
          girerseniz <code className="rounded bg-muted px-1 py-0.5 text-[10px]">act_</code> öneki
          otomatik eklenir.
        </p>
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={loading} onClick={() => void handleSubmit()}>
          {loading ? "Doğrulanıyor..." : "Ekle"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={loading}
          onClick={() => {
            setOpen(false);
            setAdAccountId("");
          }}
        >
          İptal
        </Button>
      </div>
    </div>
  );
}
