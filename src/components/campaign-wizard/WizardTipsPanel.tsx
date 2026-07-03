"use client";

import { ImageIcon, MousePointerClick, Target, Type } from "lucide-react";
import { TipCard } from "./TipCard";

const DEFAULT_TIPS = [
  {
    icon: Target,
    title: "Hedefinizi netleştirin",
    description: "Satış, trafik veya lead hedefine göre doğru recipe seçilir.",
    iconClassName: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
  },
  {
    icon: ImageIcon,
    title: "Görsel kalitesi",
    description: "Net, yüksek çözünürlüklü görseller daha iyi performans verir.",
    iconClassName: "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300",
  },
  {
    icon: MousePointerClick,
    title: "CTA seçimi",
    description: "Hedefinize uygun harekete geçirici mesaj kullanın.",
    iconClassName: "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300",
  },
  {
    icon: Type,
    title: "Reklam metni",
    description: "Kısa, net ve fayda odaklı metinler dönüşümü artırır.",
    iconClassName: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  },
];

export function WizardTipsPanel({ recipeLabel }: { recipeLabel?: string }) {
  return (
    <aside className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">İpuçları</h3>
        {recipeLabel && (
          <p className="mt-1 text-xs text-muted-foreground">Recipe: {recipeLabel}</p>
        )}
      </div>
      {DEFAULT_TIPS.map((tip) => (
        <TipCard key={tip.title} {...tip} />
      ))}
    </aside>
  );
}
