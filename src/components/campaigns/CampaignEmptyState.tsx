"use client";

import { Megaphone } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

export function CampaignEmptyState() {
  return (
    <EmptyState
      icon={
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent">
          <Megaphone className="h-7 w-7 text-accent-foreground" />
        </div>
      }
      title="Henüz kampanya oluşturulmadı"
      description="İlk kampanyanızı oluşturarak reklam performansını takip etmeye başlayın."
      actionLabel="Kampanya Oluştur"
      actionHref="/campaigns/new"
    />
  );
}
