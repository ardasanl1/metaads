import type { CampaignObjective, BuyingType } from "@/utils/campaign-constants";
import type { MetaAssetKind } from "@/types/meta-assets";
import type { WizardCtaChoice } from "@/types/campaign-wizard";

export type CampaignRecipeId =
  | "LEAD_CALLS"
  | "LEAD_INSTANT_FORM"
  | "LEAD_WEBSITE"
  | "LEAD_WHATSAPP"
  | "LEAD_MESSENGER"
  | "LEAD_INSTAGRAM_MESSAGES"
  | "SALES_WEBSITE"
  | "SALES_CATALOG"
  | "TRAFFIC_WEBSITE"
  | "ENGAGEMENT_POST"
  | "ENGAGEMENT_VIDEO"
  | "AWARENESS_REACH"
  | "AWARENESS_VIDEO"
  | "APP_INSTALL";

/** Kullanıcıya gösterilen alias ID'ler (canonical'a çözülür) */
export type CampaignRecipeAliasId =
  | "LEADS_CALLS"
  | "LEADS_INSTANT_FORM"
  | "LEADS_WEBSITE"
  | "MESSAGES_WHATSAPP"
  | "MESSAGES_INSTAGRAM"
  | "MESSAGES_MESSENGER";

export type ConversionLocation =
  | "PHONE_CALL"
  | "ON_AD"
  | "WEBSITE"
  | "MESSENGER"
  | "INSTAGRAM_DIRECT"
  | "WHATSAPP"
  | "APP"
  | "CATALOG"
  | "UNDEFINED";

export type DestinationType =
  | "PHONE_CALL"
  | "ON_AD"
  | "WEBSITE"
  | "MESSENGER"
  | "INSTAGRAM_DIRECT"
  | "WHATSAPP"
  | "APP"
  | "UNDEFINED";

export type BudgetLevel = "CAMPAIGN" | "ADSET";
export type PlacementMode = "AUTOMATIC";

export type CampaignUserField =
  | "dailyBudget"
  | "startDate"
  | "endDate"
  | "location"
  | "ageMin"
  | "ageMax"
  | "gender"
  | "imageFile"
  | "primaryText"
  | "headline"
  | "description"
  | "websiteUrl"
  | "page"
  | "instagram"
  | "pixel"
  | "instantForm"
  | "whatsapp"
  | "catalog"
  | "productSet"
  | "app"
  | "cta"
  | "specialAdCategory";

export type CampaignRecipe = {
  id: CampaignRecipeId;
  label: string;
  outcomeLabel: string;
  objective: CampaignObjective;
  buyingType: BuyingType;
  conversionLocation: ConversionLocation;
  destinationType: DestinationType;
  optimizationGoal: string;
  billingEvent: string;
  bidStrategy: string;
  budgetLevel: BudgetLevel;
  placements: PlacementMode;
  conversionEvent?: string;
  promotedObjectKeys: Array<"page_id" | "pixel_id" | "custom_event_type" | "lead_gen_form_id" | "product_catalog_id" | "application_id">;
  requiredAssets: MetaAssetKind[];
  requiredUserFields: CampaignUserField[];
  autoFields: string[];
  supportedCtas: WizardCtaChoice[];
  defaultCta: WizardCtaChoice;
  attributionWindow?: string;
  performanceGoal: string;
  enabled: boolean;
  comingSoon?: boolean;
  defaults: {
    status: "PAUSED";
    buyingType: BuyingType;
  };
};

const PAUSED_DEFAULTS = { status: "PAUSED" as const, buyingType: "AUCTION" as const };

function recipe(
  partial: Omit<CampaignRecipe, "defaults" | "autoFields" | "performanceGoal" | "enabled"> & {
    autoFields?: string[];
    performanceGoal?: string;
    enabled?: boolean;
    comingSoon?: boolean;
  },
): CampaignRecipe {
  return {
    ...partial,
    performanceGoal: partial.performanceGoal ?? partial.optimizationGoal,
    enabled: partial.enabled ?? true,
    comingSoon: partial.comingSoon,
    autoFields: partial.autoFields ?? [
      "objective",
      "conversionLocation",
      "destinationType",
      "optimizationGoal",
      "billingEvent",
      "bidStrategy",
      "budgetLevel",
      "placements",
      "status",
      "campaignName",
      "cta",
    ],
    defaults: PAUSED_DEFAULTS,
  };
}

export const CAMPAIGN_RECIPES: Record<CampaignRecipeId, CampaignRecipe> = {
  LEAD_CALLS: recipe({
    id: "LEAD_CALLS",
    label: "Telefon Araması",
    outcomeLabel: "İnsanlar beni telefonla arasın",
    objective: "OUTCOME_LEADS",
    buyingType: "AUCTION",
    conversionLocation: "PHONE_CALL",
    destinationType: "PHONE_CALL",
    optimizationGoal: "QUALITY_CALL",
    billingEvent: "IMPRESSIONS",
    bidStrategy: "LOWEST_COST_WITHOUT_CAP",
    budgetLevel: "ADSET",
    placements: "AUTOMATIC",
    promotedObjectKeys: ["page_id"],
    requiredAssets: ["page"],
    requiredUserFields: [
      "dailyBudget",
      "startDate",
      "endDate",
      "location",
      "ageMin",
      "ageMax",
      "gender",
      "imageFile",
      "primaryText",
      "headline",
      "page",
      "specialAdCategory",
    ],
    supportedCtas: ["CALL_NOW", "LEARN_MORE", "SIGN_UP"],
    defaultCta: "CALL_NOW",
  }),

  LEAD_INSTANT_FORM: recipe({
    id: "LEAD_INSTANT_FORM",
    label: "Meta Anlık Form",
    outcomeLabel: "Meta formu doldursunlar",
    objective: "OUTCOME_LEADS",
    buyingType: "AUCTION",
    conversionLocation: "ON_AD",
    destinationType: "ON_AD",
    optimizationGoal: "LEAD_GENERATION",
    billingEvent: "IMPRESSIONS",
    bidStrategy: "LOWEST_COST_WITHOUT_CAP",
    budgetLevel: "ADSET",
    placements: "AUTOMATIC",
    promotedObjectKeys: ["page_id"],
    requiredAssets: ["page", "instantForm"],
    requiredUserFields: [
      "dailyBudget",
      "startDate",
      "endDate",
      "location",
      "ageMin",
      "ageMax",
      "gender",
      "imageFile",
      "primaryText",
      "headline",
      "page",
      "instantForm",
      "specialAdCategory",
    ],
    supportedCtas: ["SIGN_UP", "APPLY_NOW", "GET_QUOTE", "LEARN_MORE"],
    defaultCta: "SIGN_UP",
  }),

  LEAD_WEBSITE: recipe({
    id: "LEAD_WEBSITE",
    label: "Web Sitesi Lead",
    outcomeLabel: "İnternet sitemde form doldursunlar",
    objective: "OUTCOME_LEADS",
    buyingType: "AUCTION",
    conversionLocation: "WEBSITE",
    destinationType: "WEBSITE",
    optimizationGoal: "OFFSITE_CONVERSIONS",
    billingEvent: "IMPRESSIONS",
    bidStrategy: "LOWEST_COST_WITHOUT_CAP",
    budgetLevel: "ADSET",
    placements: "AUTOMATIC",
    conversionEvent: "LEAD",
    promotedObjectKeys: ["pixel_id", "custom_event_type"],
    requiredAssets: ["page", "pixel"],
    requiredUserFields: [
      "dailyBudget",
      "startDate",
      "endDate",
      "location",
      "ageMin",
      "ageMax",
      "gender",
      "websiteUrl",
      "imageFile",
      "primaryText",
      "headline",
      "page",
      "pixel",
      "specialAdCategory",
    ],
    supportedCtas: ["SIGN_UP", "LEARN_MORE", "GET_QUOTE", "APPLY_NOW"],
    defaultCta: "SIGN_UP",
  }),

  LEAD_WHATSAPP: recipe({
    id: "LEAD_WHATSAPP",
    label: "WhatsApp Mesajı",
    outcomeLabel: "WhatsApp'tan mesaj atsınlar",
    objective: "OUTCOME_LEADS",
    buyingType: "AUCTION",
    conversionLocation: "WHATSAPP",
    destinationType: "WHATSAPP",
    optimizationGoal: "CONVERSATIONS",
    billingEvent: "IMPRESSIONS",
    bidStrategy: "LOWEST_COST_WITHOUT_CAP",
    budgetLevel: "ADSET",
    placements: "AUTOMATIC",
    promotedObjectKeys: ["page_id"],
    requiredAssets: ["page", "whatsapp"],
    requiredUserFields: [
      "dailyBudget",
      "startDate",
      "endDate",
      "location",
      "ageMin",
      "ageMax",
      "gender",
      "imageFile",
      "primaryText",
      "headline",
      "page",
      "whatsapp",
      "specialAdCategory",
    ],
    supportedCtas: ["WHATSAPP_MESSAGE", "SEND_MESSAGE", "LEARN_MORE"],
    defaultCta: "WHATSAPP_MESSAGE",
  }),

  LEAD_MESSENGER: recipe({
    id: "LEAD_MESSENGER",
    label: "Messenger Mesajı",
    outcomeLabel: "Messenger'dan mesaj atsınlar",
    objective: "OUTCOME_LEADS",
    buyingType: "AUCTION",
    conversionLocation: "MESSENGER",
    destinationType: "MESSENGER",
    optimizationGoal: "CONVERSATIONS",
    billingEvent: "IMPRESSIONS",
    bidStrategy: "LOWEST_COST_WITHOUT_CAP",
    budgetLevel: "ADSET",
    placements: "AUTOMATIC",
    promotedObjectKeys: ["page_id"],
    requiredAssets: ["page"],
    requiredUserFields: [
      "dailyBudget",
      "startDate",
      "endDate",
      "location",
      "ageMin",
      "ageMax",
      "gender",
      "imageFile",
      "primaryText",
      "headline",
      "page",
      "specialAdCategory",
    ],
    supportedCtas: ["SEND_MESSAGE", "MESSAGE_PAGE", "LEARN_MORE"],
    defaultCta: "SEND_MESSAGE",
  }),

  LEAD_INSTAGRAM_MESSAGES: recipe({
    id: "LEAD_INSTAGRAM_MESSAGES",
    label: "Instagram Mesajı",
    outcomeLabel: "Instagram'dan mesaj atsınlar",
    objective: "OUTCOME_LEADS",
    buyingType: "AUCTION",
    conversionLocation: "INSTAGRAM_DIRECT",
    destinationType: "INSTAGRAM_DIRECT",
    optimizationGoal: "CONVERSATIONS",
    billingEvent: "IMPRESSIONS",
    bidStrategy: "LOWEST_COST_WITHOUT_CAP",
    budgetLevel: "ADSET",
    placements: "AUTOMATIC",
    promotedObjectKeys: ["page_id"],
    requiredAssets: ["page", "instagram"],
    requiredUserFields: [
      "dailyBudget",
      "startDate",
      "endDate",
      "location",
      "ageMin",
      "ageMax",
      "gender",
      "imageFile",
      "primaryText",
      "headline",
      "page",
      "instagram",
      "specialAdCategory",
    ],
    supportedCtas: ["SEND_MESSAGE", "MESSAGE_PAGE", "LEARN_MORE"],
    defaultCta: "SEND_MESSAGE",
  }),

  SALES_WEBSITE: recipe({
    id: "SALES_WEBSITE",
    label: "Web Sitesi Satış",
    outcomeLabel: "Web sitemden ürün satın alsınlar",
    objective: "OUTCOME_SALES",
    buyingType: "AUCTION",
    conversionLocation: "WEBSITE",
    destinationType: "WEBSITE",
    optimizationGoal: "OFFSITE_CONVERSIONS",
    billingEvent: "IMPRESSIONS",
    bidStrategy: "LOWEST_COST_WITHOUT_CAP",
    budgetLevel: "ADSET",
    placements: "AUTOMATIC",
    conversionEvent: "PURCHASE",
    promotedObjectKeys: ["pixel_id", "custom_event_type"],
    requiredAssets: ["page", "pixel"],
    requiredUserFields: [
      "dailyBudget",
      "startDate",
      "endDate",
      "location",
      "ageMin",
      "ageMax",
      "gender",
      "websiteUrl",
      "imageFile",
      "primaryText",
      "headline",
      "page",
      "pixel",
      "specialAdCategory",
    ],
    supportedCtas: ["SHOP_NOW", "LEARN_MORE", "SIGN_UP", "GET_OFFER"],
    defaultCta: "SHOP_NOW",
  }),

  SALES_CATALOG: recipe({
    id: "SALES_CATALOG",
    label: "Katalog Satış",
    outcomeLabel: "Katalog ürünlerim satılsın",
    objective: "OUTCOME_SALES",
    buyingType: "AUCTION",
    conversionLocation: "CATALOG",
    destinationType: "UNDEFINED",
    optimizationGoal: "OFFSITE_CONVERSIONS",
    billingEvent: "IMPRESSIONS",
    bidStrategy: "LOWEST_COST_WITHOUT_CAP",
    budgetLevel: "ADSET",
    placements: "AUTOMATIC",
    conversionEvent: "PURCHASE",
    promotedObjectKeys: ["product_catalog_id", "pixel_id", "custom_event_type"],
    requiredAssets: ["page", "pixel", "catalog", "productSet"],
    requiredUserFields: [
      "dailyBudget",
      "startDate",
      "endDate",
      "location",
      "ageMin",
      "ageMax",
      "gender",
      "imageFile",
      "primaryText",
      "headline",
      "page",
      "pixel",
      "catalog",
      "productSet",
      "specialAdCategory",
    ],
    supportedCtas: ["SHOP_NOW", "LEARN_MORE"],
    defaultCta: "SHOP_NOW",
  }),

  TRAFFIC_WEBSITE: recipe({
    id: "TRAFFIC_WEBSITE",
    label: "Web Sitesi Trafiği",
    outcomeLabel: "Web sitemi ziyaret etsinler",
    objective: "OUTCOME_TRAFFIC",
    buyingType: "AUCTION",
    conversionLocation: "WEBSITE",
    destinationType: "WEBSITE",
    optimizationGoal: "LANDING_PAGE_VIEWS",
    billingEvent: "IMPRESSIONS",
    bidStrategy: "LOWEST_COST_WITHOUT_CAP",
    budgetLevel: "ADSET",
    placements: "AUTOMATIC",
    promotedObjectKeys: ["page_id"],
    requiredAssets: ["page"],
    requiredUserFields: [
      "dailyBudget",
      "startDate",
      "endDate",
      "location",
      "ageMin",
      "ageMax",
      "gender",
      "websiteUrl",
      "imageFile",
      "primaryText",
      "headline",
      "page",
      "specialAdCategory",
    ],
    supportedCtas: ["LEARN_MORE", "SHOP_NOW", "SIGN_UP"],
    defaultCta: "LEARN_MORE",
  }),

  ENGAGEMENT_POST: recipe({
    id: "ENGAGEMENT_POST",
    label: "Gönderi Etkileşimi",
    outcomeLabel: "Gönderim etkileşim alsın",
    objective: "OUTCOME_ENGAGEMENT",
    buyingType: "AUCTION",
    conversionLocation: "UNDEFINED",
    destinationType: "UNDEFINED",
    optimizationGoal: "POST_ENGAGEMENT",
    billingEvent: "IMPRESSIONS",
    bidStrategy: "LOWEST_COST_WITHOUT_CAP",
    budgetLevel: "ADSET",
    placements: "AUTOMATIC",
    promotedObjectKeys: ["page_id"],
    requiredAssets: ["page"],
    requiredUserFields: [
      "dailyBudget",
      "startDate",
      "endDate",
      "location",
      "ageMin",
      "ageMax",
      "gender",
      "imageFile",
      "primaryText",
      "headline",
      "page",
      "specialAdCategory",
    ],
    supportedCtas: ["LEARN_MORE", "SIGN_UP", "NO_BUTTON"],
    defaultCta: "LEARN_MORE",
  }),

  ENGAGEMENT_VIDEO: recipe({
    id: "ENGAGEMENT_VIDEO",
    label: "Video İzlenme",
    outcomeLabel: "Videom izlensin",
    objective: "OUTCOME_ENGAGEMENT",
    buyingType: "AUCTION",
    conversionLocation: "UNDEFINED",
    destinationType: "UNDEFINED",
    optimizationGoal: "THRUPLAY",
    billingEvent: "THRUPLAY",
    bidStrategy: "LOWEST_COST_WITHOUT_CAP",
    budgetLevel: "ADSET",
    placements: "AUTOMATIC",
    promotedObjectKeys: ["page_id"],
    requiredAssets: ["page"],
    requiredUserFields: [
      "dailyBudget",
      "startDate",
      "endDate",
      "location",
      "ageMin",
      "ageMax",
      "gender",
      "imageFile",
      "primaryText",
      "headline",
      "page",
      "specialAdCategory",
    ],
    supportedCtas: ["LEARN_MORE", "WATCH_MORE", "NO_BUTTON"],
    defaultCta: "WATCH_MORE",
  }),

  AWARENESS_REACH: recipe({
    id: "AWARENESS_REACH",
    label: "Erişim",
    outcomeLabel: "Markam daha fazla kişiye ulaşsın",
    objective: "OUTCOME_AWARENESS",
    buyingType: "AUCTION",
    conversionLocation: "UNDEFINED",
    destinationType: "UNDEFINED",
    optimizationGoal: "REACH",
    billingEvent: "IMPRESSIONS",
    bidStrategy: "LOWEST_COST_WITHOUT_CAP",
    budgetLevel: "ADSET",
    placements: "AUTOMATIC",
    promotedObjectKeys: ["page_id"],
    requiredAssets: ["page"],
    requiredUserFields: [
      "dailyBudget",
      "startDate",
      "endDate",
      "location",
      "ageMin",
      "ageMax",
      "gender",
      "imageFile",
      "primaryText",
      "headline",
      "page",
      "specialAdCategory",
    ],
    supportedCtas: ["LEARN_MORE", "NO_BUTTON"],
    defaultCta: "LEARN_MORE",
  }),

  AWARENESS_VIDEO: recipe({
    id: "AWARENESS_VIDEO",
    label: "Video Farkındalık",
    outcomeLabel: "Videom izlensin (farkındalık)",
    objective: "OUTCOME_AWARENESS",
    buyingType: "AUCTION",
    conversionLocation: "UNDEFINED",
    destinationType: "UNDEFINED",
    optimizationGoal: "THRUPLAY",
    billingEvent: "THRUPLAY",
    bidStrategy: "LOWEST_COST_WITHOUT_CAP",
    budgetLevel: "ADSET",
    placements: "AUTOMATIC",
    promotedObjectKeys: ["page_id"],
    requiredAssets: ["page"],
    requiredUserFields: [
      "dailyBudget",
      "startDate",
      "endDate",
      "location",
      "ageMin",
      "ageMax",
      "gender",
      "imageFile",
      "primaryText",
      "headline",
      "page",
      "specialAdCategory",
    ],
    supportedCtas: ["LEARN_MORE", "WATCH_MORE", "NO_BUTTON"],
    defaultCta: "WATCH_MORE",
  }),

  APP_INSTALL: recipe({
    id: "APP_INSTALL",
    label: "Uygulama İndirme",
    outcomeLabel: "Uygulamam indirilsin",
    objective: "OUTCOME_APP_PROMOTION",
    buyingType: "AUCTION",
    conversionLocation: "APP",
    destinationType: "APP",
    optimizationGoal: "APP_INSTALLS",
    billingEvent: "IMPRESSIONS",
    bidStrategy: "LOWEST_COST_WITHOUT_CAP",
    budgetLevel: "ADSET",
    placements: "AUTOMATIC",
    promotedObjectKeys: ["application_id"],
    requiredAssets: ["page", "app"],
    requiredUserFields: [
      "dailyBudget",
      "startDate",
      "endDate",
      "location",
      "ageMin",
      "ageMax",
      "gender",
      "imageFile",
      "primaryText",
      "headline",
      "page",
      "app",
      "specialAdCategory",
    ],
    supportedCtas: ["INSTALL_MOBILE_APP", "USE_APP", "LEARN_MORE"],
    defaultCta: "INSTALL_MOBILE_APP",
    enabled: true,
  }),
};

const RECIPE_ALIASES: Partial<Record<string, CampaignRecipeId>> = {
  LEADS_CALLS: "LEAD_CALLS",
  LEADS_INSTANT_FORM: "LEAD_INSTANT_FORM",
  LEADS_WEBSITE: "LEAD_WEBSITE",
  MESSAGES_WHATSAPP: "LEAD_WHATSAPP",
  MESSAGES_INSTAGRAM: "LEAD_INSTAGRAM_MESSAGES",
  MESSAGES_MESSENGER: "LEAD_MESSENGER",
};

// SALES_CATALOG: uçtan uca test bekliyor
CAMPAIGN_RECIPES.SALES_CATALOG.enabled = false;
CAMPAIGN_RECIPES.SALES_CATALOG.comingSoon = true;

/** @deprecated Use SALES_WEBSITE */
export const WEBSITE_SALES_RECIPE = CAMPAIGN_RECIPES.SALES_WEBSITE;

export function normalizeRecipeId(recipeId: string): CampaignRecipeId | null {
  const canonical = (RECIPE_ALIASES[recipeId] ?? recipeId) as CampaignRecipeId;
  return CAMPAIGN_RECIPES[canonical] ? canonical : null;
}

export function getCampaignRecipe(recipeId: CampaignRecipeId | string): CampaignRecipe | null {
  const canonical = normalizeRecipeId(recipeId);
  return canonical ? CAMPAIGN_RECIPES[canonical] : null;
}

export function isRecipeEnabled(recipeId: CampaignRecipeId | string): boolean {
  const recipe = getCampaignRecipe(recipeId);
  return Boolean(recipe?.enabled);
}

export function getEnabledRecipeIds(): CampaignRecipeId[] {
  return ALL_RECIPE_IDS.filter((id) => CAMPAIGN_RECIPES[id]?.enabled);
}

export function getDisabledRecipeIds(): CampaignRecipeId[] {
  return ALL_RECIPE_IDS.filter((id) => !CAMPAIGN_RECIPES[id]?.enabled);
}

export function getRecipeRequiredAssets(recipeId: CampaignRecipeId | string): MetaAssetKind[] {
  return getCampaignRecipe(recipeId)?.requiredAssets ?? [];
}

export const ALL_RECIPE_IDS = Object.keys(CAMPAIGN_RECIPES) as CampaignRecipeId[];
