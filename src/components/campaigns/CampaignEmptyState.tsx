"use client";

import Link from "next/link";
import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function CampaignEmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Megaphone className="h-7 w-7 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Henüz kampanya oluşturulmadı.</h3>
          <p className="text-sm text-muted-foreground">
            İlk kampanyanızı oluşturarak reklam performansını takip etmeye başlayın.
          </p>
        </div>
        <Button asChild>
          <Link href="/campaigns/new">Create Campaign</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
