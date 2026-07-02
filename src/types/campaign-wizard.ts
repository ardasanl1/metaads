export type WizardGender = "ALL" | "MALE" | "FEMALE";

export type WizardCtaChoice =
  | "SHOP_NOW"
  | "LEARN_MORE"
  | "SIGN_UP"
  | "GET_OFFER";

export type WizardSpecialAdCategory =
  | "NONE"
  | "EMPLOYMENT"
  | "HOUSING"
  | "CREDIT"
  | "ISSUES_ELECTIONS_POLITICS"
  | "FINANCIAL_PRODUCTS_SERVICES";

export type WebsiteSalesDraft = {
  campaignName: string;
  dailyBudget: number;
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD

  countryCode: string; // ISO 3166-1 alpha-2, e.g. TR
  city?: string;
  ageMin: number;
  ageMax: number;
  gender: WizardGender;

  websiteUrl: string;
  pageId: string;
  instagramActorId?: string;
  pixelId: string;

  imageFile: File | null;
  primaryText: string;
  headline: string;
  description?: string;
  cta: WizardCtaChoice;
  specialAdCategory: WizardSpecialAdCategory;
};

export type WebsiteSalesSubmit = Omit<WebsiteSalesDraft, "imageFile"> & {
  imageHash: string;
};

export type WizardStepId =
  | "campaign_budget"
  | "audience"
  | "meta_assets"
  | "ad_content"
  | "review_create";

export type WizardCreateStep =
  | "upload_image"
  | "create_campaign"
  | "create_adset"
  | "create_creative"
  | "create_ad";

export type WizardCreateResult = {
  success: boolean;
  completedStep: WizardCreateStep | null;
  failedStep: WizardCreateStep | null;
  message: string;
  campaignId?: string;
  adSetId?: string;
  creativeId?: string;
  adId?: string;
};

export type MetaPage = { id: string; name: string };
export type MetaInstagramAccount = { id: string; username?: string; name?: string };
export type MetaPixel = { id: string; name?: string };

