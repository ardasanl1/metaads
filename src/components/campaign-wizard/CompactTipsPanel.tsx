"use client";

import { ImageIcon, MousePointerClick, Type } from "lucide-react";

const TIPS = [
  {
    icon: Type,
    title: "Net ve kısa metin kullanın",
    description: "Faydayı ilk cümlede anlatın.",
  },
  {
    icon: ImageIcon,
    title: "Yüksek kaliteli görsel seçin",
    description: "Net ve dikkat çekici görseller daha iyi sonuç verir.",
  },
  {
    icon: MousePointerClick,
    title: "Satış hedefi için güçlü CTA kullanın",
    description: "Harekete geçirici mesajı hedefinize göre seçin.",
  },
];

export function CompactTipsPanel() {
  return (
    <aside className="rounded-xl border border-border/60 bg-card p-4 shadow-sm lg:p-5">
      <h3 className="text-sm font-semibold text-foreground">İpuçları</h3>
      <ul className="mt-3 space-y-3">
        {TIPS.map((tip) => {
          const Icon = tip.icon;
          return (
            <li key={tip.title} className="flex gap-2.5">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-sm font-medium leading-snug">{tip.title}</p>
                <p className="text-xs text-muted-foreground">{tip.description}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
