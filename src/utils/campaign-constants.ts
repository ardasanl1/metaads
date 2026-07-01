export type CampaignOption<T extends string> = {
  value: T;
  label: string;
  description: string;
};

export const CAMPAIGN_OBJECTIVES: CampaignOption<
  | "OUTCOME_AWARENESS"
  | "OUTCOME_TRAFFIC"
  | "OUTCOME_ENGAGEMENT"
  | "OUTCOME_LEADS"
  | "OUTCOME_APP_PROMOTION"
  | "OUTCOME_SALES"
>[] = [
  {
    value: "OUTCOME_AWARENESS",
    label: "Farkındalık",
    description: "Markanızı veya hizmetinizi mümkün olduğunca çok kişiye tanıtın.",
  },
  {
    value: "OUTCOME_TRAFFIC",
    label: "Trafik",
    description: "Web sitenize, uygulamanıza veya Meta Messenger'a ziyaretçi gönderin.",
  },
  {
    value: "OUTCOME_ENGAGEMENT",
    label: "Etkileşim",
    description: "Gönderilerinizde daha fazla mesaj, beğeni, yorum veya paylaşım alın.",
  },
  {
    value: "OUTCOME_LEADS",
    label: "Potansiyel Müşteri",
    description: "Form doldurma, arama veya mesaj gibi lead toplayın.",
  },
  {
    value: "OUTCOME_APP_PROMOTION",
    label: "Uygulama Tanıtımı",
    description: "Mobil uygulamanızın indirilmesini ve kullanımını artırın.",
  },
  {
    value: "OUTCOME_SALES",
    label: "Satış / Dönüşüm",
    description: "Web sitesi, uygulama veya mağazada satın alma ve dönüşüm hedefleyin.",
  },
];

export const BUYING_TYPES: CampaignOption<"AUCTION" | "RESERVED">[] = [
  {
    value: "AUCTION",
    label: "Açık Artırma",
    description: "Meta en düşük maliyetle en iyi sonucu hedefler. Çoğu kampanya için önerilir.",
  },
  {
    value: "RESERVED",
    label: "Rezervasyon",
    description: "Sabit fiyat ve garantili gösterim. Yalnızca desteklenen hesaplarda kullanılabilir.",
  },
];

/** Meta API'ye gönderilecek gerçek kategori değerleri (NONE form içindir, API'ye gitmez). */
export const SPECIAL_AD_CATEGORIES: CampaignOption<
  | "EMPLOYMENT"
  | "HOUSING"
  | "CREDIT"
  | "ISSUES_ELECTIONS_POLITICS"
  | "FINANCIAL_PRODUCTS_SERVICES"
>[] = [
  {
    value: "EMPLOYMENT",
    label: "İstihdam",
    description: "İş ilanları, işe alım ve kariyer fırsatlarına yönelik reklamlar.",
  },
  {
    value: "HOUSING",
    label: "Konut",
    description: "Ev satışı, kiralama ve konut ile ilgili reklamlar.",
  },
  {
    value: "CREDIT",
    label: "Kredi (eski)",
    description: "Kredi kartı, kredi ve finansman teklifleri. Yeni hesaplarda Finansal Ürünler tercih edilir.",
  },
  {
    value: "FINANCIAL_PRODUCTS_SERVICES",
    label: "Finansal Ürün ve Hizmetler",
    description: "Kredi, sigorta, yatırım ve bankacılık ürünlerine yönelik reklamlar.",
  },
  {
    value: "ISSUES_ELECTIONS_POLITICS",
    label: "Sosyal Konular, Seçimler veya Politika",
    description: "Siyasi kampanyalar, seçimler ve toplumsal konulara ilişkin reklamlar.",
  },
];

export const CAMPAIGN_STATUSES: CampaignOption<"PAUSED" | "ACTIVE">[] = [
  {
    value: "PAUSED",
    label: "Duraklatılmış",
    description: "Kampanya oluşturulur ancak reklam seti ekleyene kadar yayınlanmaz.",
  },
  {
    value: "ACTIVE",
    label: "Aktif",
    description: "Reklam setleri hazır olduğunda kampanya hemen yayına alınabilir.",
  },
];

export type CampaignObjective = (typeof CAMPAIGN_OBJECTIVES)[number]["value"];
export type BuyingType = (typeof BUYING_TYPES)[number]["value"];
export type SpecialAdCategoryApi = (typeof SPECIAL_AD_CATEGORIES)[number]["value"];
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number]["value"];

/** Formda "özel kategori yok" seçeneği — API'ye boş dizi olarak gider. */
export const NO_SPECIAL_CATEGORY = "NONE" as const;
export type SpecialAdCategoryForm = SpecialAdCategoryApi | typeof NO_SPECIAL_CATEGORY;

export function normalizeSpecialAdCategoriesForApi(
  categories: SpecialAdCategoryForm[],
): SpecialAdCategoryApi[] {
  return categories.filter(
    (category): category is SpecialAdCategoryApi => category !== NO_SPECIAL_CATEGORY,
  );
}

export function getObjectiveLabel(value: string): string {
  return CAMPAIGN_OBJECTIVES.find((item) => item.value === value)?.label ?? value;
}

export function getBuyingTypeLabel(value: string): string {
  return BUYING_TYPES.find((item) => item.value === value)?.label ?? value;
}
