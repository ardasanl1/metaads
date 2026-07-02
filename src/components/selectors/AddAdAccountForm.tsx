"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BusinessDiscoveryMatch } from "@/types/meta/business-discovery";

type AddAdAccountFormProps = {
  onAdd: (adAccountId: string, businessId?: string) => Promise<void>;
  disabled?: boolean;
};

export function AddAdAccountForm({ onAdd, disabled = false }: AddAdAccountFormProps) {
  const [open, setOpen] = useState(false);
  const [adAccountId, setAdAccountId] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingBusinessId, setPendingBusinessId] = useState("");
  const [businessMatches, setBusinessMatches] = useState<BusinessDiscoveryMatch[]>([]);
  const [pendingAdAccountId, setPendingAdAccountId] = useState("");

  async function submit(adAccountValue: string, businessId?: string) {
    const trimmed = adAccountValue.trim();
    if (!trimmed) {
      toast.error("Reklam hesabı ID girin");
      return;
    }

    setLoading(true);
    try {
      await onAdd(trimmed, businessId);
      setAdAccountId("");
      setOpen(false);
      setBusinessMatches([]);
      setPendingAdAccountId("");
      setPendingBusinessId("");
      toast.success("Reklam hesabı firmaya eklendi");
    } catch (err) {
      const payload = err as Error & {
        needsBusinessSelection?: boolean;
        matches?: BusinessDiscoveryMatch[];
        adAccountId?: string;
      };
      if (payload.needsBusinessSelection && payload.matches?.length) {
        setPendingAdAccountId(trimmed);
        setBusinessMatches(payload.matches);
        setPendingBusinessId(payload.matches[0]?.businessId ?? "");
        return;
      }
      const message = err instanceof Error ? err.message : "Hesap eklenemedi";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  if (businessMatches.length > 0) {
    return (
      <div className="w-full space-y-3 rounded-lg border border-border bg-muted/30 p-3">
        <p className="text-sm font-medium">Business seçin</p>
        <p className="text-xs text-muted-foreground">
          Bu reklam hesabı birden fazla Business altında bulundu. Gerçek işletme adını seçin.
        </p>
        <Select value={pendingBusinessId} onValueChange={setPendingBusinessId}>
          <SelectTrigger>
            <SelectValue placeholder="Business seçin" />
          </SelectTrigger>
          <SelectContent>
            {businessMatches.map((match) => (
              <SelectItem key={`${match.businessId}-${match.relationship}`} value={match.businessId}>
                {match.businessName} ({match.relationship === "owned" ? "Sahip" : match.relationship === "client" ? "Müşteri" : "Hesap alanı"})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            disabled={loading || !pendingBusinessId}
            onClick={() => void submit(pendingAdAccountId, pendingBusinessId)}
          >
            {loading ? "Kaydediliyor..." : "Business ile ekle"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={loading}
            onClick={() => {
              setBusinessMatches([]);
              setPendingAdAccountId("");
              setPendingBusinessId("");
            }}
          >
            İptal
          </Button>
        </div>
      </div>
    );
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
          Bu alan reklam hesabı ID&apos;sidir (
          <code className="rounded bg-muted px-1 py-0.5 text-[10px]">act_...</code>), Business Manager
          ID değildir.
        </p>
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={loading} onClick={() => void submit(adAccountId)}>
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
