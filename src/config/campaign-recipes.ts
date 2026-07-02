import type { WebsiteSalesDraft, WizardCtaChoice } from "@/types/campaign-wizard";

export type WebsiteSalesRecipe = {
  id: "website_sales";
  label: string;
  objective: "OUTCOME_SALES";
  buyingType: "AUCTION";
  conversionEvent: "PURCHASE";
  billingEvent: "IMPRESSIONS";
  optimizationGoal: "OFFSITE_CONVERSIONS";
  bidStrategy: "LOWEST_COST_WITHOUT_CAP";
  budgetLevel: "ADSET";
  placements: "AUTOMATIC";
  supportedCtas: WizardCtaChoice[];
  defaults: {
    status: "PAUSED";
  };
  required: Array<keyof WebsiteSalesDraft>;
};

export const WEBSITE_SALES_RECIPE: WebsiteSalesRecipe = {
  id: "website_sales",
  label: "Website Satış (Purchase)",
  objective: "OUTCOME_SALES",
  buyingType: "AUCTION",
  conversionEvent: "PURCHASE",
  billingEvent: "IMPRESSIONS",
  optimizationGoal: "OFFSITE_CONVERSIONS",
  bidStrategy: "LOWEST_COST_WITHOUT_CAP",
  budgetLevel: "ADSET",
  placements: "AUTOMATIC",
  supportedCtas: ["SHOP_NOW", "LEARN_MORE", "SIGN_UP", "GET_OFFER"],
  defaults: { status: "PAUSED" },
  required: [
    "campaignName",
    "dailyBudget",
    "startDate",
    "countryCode",
    "ageMin",
    "ageMax",
    "gender",
    "websiteUrl",
    "pageId",
    "pixelId",
    "imageFile",
    "primaryText",
    "headline",
    "cta",
    "specialAdCategory",
  ],
};

