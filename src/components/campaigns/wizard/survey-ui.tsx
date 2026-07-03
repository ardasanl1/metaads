"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ChoiceCard({
  title,
  options,
  onSelect,
}: {
  title?: string;
  options: Array<{ id: string; label: string }>;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {title && <h3 className="text-sm font-medium text-foreground">{title}</h3>}
      <div className="grid gap-2">
        {options.map((opt) => (
          <Button
            key={opt.id}
            type="button"
            variant="outline"
            className="h-auto justify-start whitespace-normal border-border/60 py-3 text-left font-normal shadow-none hover:bg-muted/50"
            onClick={() => onSelect(opt.id)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function AssetPicker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
}) {
  if (options.length === 0) {
    return null;
  }
  if (options.length === 1) {
    return null;
  }
  return (
    <div className="space-y-1.5 rounded-lg border border-border/50 bg-muted/20 p-3">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="bg-background">
          <SelectValue placeholder={`${label} seçin`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ImagePreview({ url }: { url: string | null }) {
  if (!url) return null;
  return (
    <div className="relative mt-2 h-20 w-20 overflow-hidden rounded-lg border border-border/60">
      <Image src={url} alt="" fill className="object-cover" />
    </div>
  );
}
