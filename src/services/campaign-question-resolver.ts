import type { CampaignRecipeId } from "@/config/campaign-recipes";

export type GoalOptionId =
  | "calls"
  | "whatsapp"
  | "instagram_messages"
  | "meta_form"
  | "website_lead"
  | "website_traffic"
  | "website_sales"
  | "post_engagement"
  | "video_views"
  | "brand_reach"
  | "app_install"
  | "catalog_sales"
  | "collect_leads_clarify";

export type GoalOption = {
  id: GoalOptionId;
  label: string;
  recipeId?: CampaignRecipeId;
  clarificationQuestion?: string;
  clarificationOptions?: Array<{ id: string; label: string; recipeId: CampaignRecipeId }>;
};

export const PRIMARY_GOAL_OPTIONS: GoalOption[] = [
  { id: "calls", label: "İnsanlar beni telefonla arasın", recipeId: "LEAD_CALLS" },
  { id: "whatsapp", label: "WhatsApp'tan mesaj atsınlar", recipeId: "LEAD_WHATSAPP" },
  { id: "instagram_messages", label: "Instagram'dan mesaj atsınlar", recipeId: "LEAD_INSTAGRAM_MESSAGES" },
  { id: "meta_form", label: "Meta formu doldursunlar", recipeId: "LEAD_INSTANT_FORM" },
  { id: "website_lead", label: "İnternet sitemde form doldursunlar", recipeId: "LEAD_WEBSITE" },
  { id: "website_traffic", label: "Web sitemi ziyaret etsinler", recipeId: "TRAFFIC_WEBSITE" },
  { id: "website_sales", label: "Ürün satın alsınlar", recipeId: "SALES_WEBSITE" },
  { id: "post_engagement", label: "Gönderim etkileşim alsın", recipeId: "ENGAGEMENT_POST" },
  { id: "video_views", label: "Videom izlensin", recipeId: "ENGAGEMENT_VIDEO" },
  { id: "brand_reach", label: "Markam daha fazla kişiye ulaşsın", recipeId: "AWARENESS_REACH" },
  { id: "app_install", label: "Uygulamam indirilsin", recipeId: "APP_INSTALL" },
  { id: "catalog_sales", label: "Katalog ürünlerim satılsın", recipeId: "SALES_CATALOG" },
  {
    id: "collect_leads_clarify",
    label: "Müşteri bilgisi toplamak istiyorum",
    clarificationQuestion:
      "Bilgiler Meta hızlı formunda mı, web sitenizde mi, mesajlaşma üzerinden mi alınacak?",
    clarificationOptions: [
      { id: "clarify_meta_form", label: "Meta hızlı formunda", recipeId: "LEAD_INSTANT_FORM" },
      { id: "clarify_website", label: "Web sitemde", recipeId: "LEAD_WEBSITE" },
      { id: "clarify_whatsapp", label: "WhatsApp mesajıyla", recipeId: "LEAD_WHATSAPP" },
      { id: "clarify_calls", label: "Telefon aramasıyla", recipeId: "LEAD_CALLS" },
      { id: "clarify_messenger", label: "Messenger mesajıyla", recipeId: "LEAD_MESSENGER" },
    ],
  },
];

export type GoalResolution =
  | { status: "resolved"; recipeId: CampaignRecipeId; goalAnswerId: string }
  | { status: "clarify"; question: string; options: Array<{ id: string; label: string; recipeId: CampaignRecipeId }> }
  | { status: "unresolved" };

export function resolveGoalSelection(goalAnswerId: string, clarificationId?: string): GoalResolution {
  const primary = PRIMARY_GOAL_OPTIONS.find((option) => option.id === goalAnswerId);
  if (!primary) return { status: "unresolved" };

  if (primary.recipeId) {
    return { status: "resolved", recipeId: primary.recipeId, goalAnswerId };
  }

  if (primary.clarificationOptions && clarificationId) {
    const picked = primary.clarificationOptions.find((option) => option.id === clarificationId);
    if (picked) {
      return { status: "resolved", recipeId: picked.recipeId, goalAnswerId: clarificationId };
    }
  }

  if (primary.clarificationQuestion && primary.clarificationOptions) {
    return {
      status: "clarify",
      question: primary.clarificationQuestion,
      options: primary.clarificationOptions,
    };
  }

  return { status: "unresolved" };
}

export function matchGoalFromText(text: string): GoalResolution {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return { status: "unresolved" };

  for (const option of PRIMARY_GOAL_OPTIONS) {
    if (option.label.toLowerCase().includes(normalized) || normalized.includes(option.label.toLowerCase())) {
      if (option.recipeId) {
        return { status: "resolved", recipeId: option.recipeId, goalAnswerId: option.id };
      }
      return resolveGoalSelection(option.id);
    }
  }

  if (normalized.includes("telefon") || normalized.includes("aray") || normalized.includes("arama")) {
    return { status: "resolved", recipeId: "LEAD_CALLS", goalAnswerId: "calls" };
  }
  if (normalized.includes("whatsapp")) {
    return { status: "resolved", recipeId: "LEAD_WHATSAPP", goalAnswerId: "whatsapp" };
  }
  if (normalized.includes("instagram") && normalized.includes("mesaj")) {
    return { status: "resolved", recipeId: "LEAD_INSTAGRAM_MESSAGES", goalAnswerId: "instagram_messages" };
  }
  if (normalized.includes("meta form") || normalized.includes("anık form")) {
    return { status: "resolved", recipeId: "LEAD_INSTANT_FORM", goalAnswerId: "meta_form" };
  }
  if (normalized.includes("satın") || normalized.includes("satış") || normalized.includes("ürün")) {
    if (normalized.includes("katalog")) {
      return { status: "resolved", recipeId: "SALES_CATALOG", goalAnswerId: "catalog_sales" };
    }
    return { status: "resolved", recipeId: "SALES_WEBSITE", goalAnswerId: "website_sales" };
  }
  if (normalized.includes("ziyaret") || normalized.includes("trafik")) {
    return { status: "resolved", recipeId: "TRAFFIC_WEBSITE", goalAnswerId: "website_traffic" };
  }
  if (normalized.includes("lead") || normalized.includes("müşteri bilgi")) {
    return resolveGoalSelection("collect_leads_clarify");
  }

  return { status: "unresolved" };
}
