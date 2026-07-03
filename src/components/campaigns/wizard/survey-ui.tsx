"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  title: string;
  options: Array<{ id: string; label: string }>;
  onSelect: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="grid gap-2">
        {options.map((opt) => (
          <Button
            key={opt.id}
            type="button"
            variant="outline"
            className="h-auto justify-start whitespace-normal py-3 text-left"
            onClick={() => onSelect(opt.id)}
          >
            {opt.label}
          </Button>
        ))}
      </CardContent>
    </Card>
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
    return <p className="text-sm text-destructive">{label} bulunamadi.</p>;
  }
  if (options.length === 1) {
    return (
      <div className="space-y-1">
        <Label>{label}</Label>
        <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
          {options[0].label}
          <span className="ml-2 text-muted-foreground">(otomatik)</span>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder={`${label} secin`} /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ImagePreview({ url }: { url: string | null }) {
  if (!url) return null;
  return (
    <div className="relative mt-2 h-20 w-20 overflow-hidden rounded-md border">
      <Image src={url} alt="" fill className="object-cover" />
    </div>
  );
}
