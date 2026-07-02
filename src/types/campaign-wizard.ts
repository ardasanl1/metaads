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

export type GoogleLocationSelection = {
  placeId: string;
  displayName: string;
  countryCode: string;
  countryName?: string;
  regionName?: string;
  cityName?: string;
  latitude?: number;
  longitude?: number;
};

export type MetaTargetingLocationType = "country" | "region" | "city";

export type MetaTargetingLocation = {
  key: string;
  name: string;
  type: MetaTargetingLocationType;
  countryCode: string;
  countryName?: string;
  region?: string;
  regionId?: string;
  supportsRadius?: boolean;
};

export type WebsiteSalesDraft = {
  campaignName: string;
  dailyBudget: number;
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD

  country: GoogleLocationSelection | null;
  city?: GoogleLocationSelection | null;
  metaCountryCode: string | null;
  metaCity?: MetaTargetingLocation | null;
  metaRegion?: MetaTargetingLocation | null;
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

export type MetaPage = { id: string; name: string; pictureUrl?: string };

export type MetaPagesDiagnostics = {
  userAccountsCount: number;
  businessOwnedCount: number;
  businessClientCount: number;
  adAccountCount: number;
  userAccountsError?: string;
  adAccountError?: string;
  missingPermissions: string[];
  hint?: string;
};
export type MetaInstagramAccount = {
  id: string;
  username?: string;
  name?: string;
  profilePictureUrl?: string;
  pageId: string;
  pageName: string;
};
export type MetaPixel = { id: string; name?: string; lastFiredTime?: string; isAvailable: boolean };

