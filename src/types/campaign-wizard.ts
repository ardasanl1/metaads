import type { CampaignRecipeId } from "@/config/campaign-recipes";
import type { SelectedMetaAssets } from "@/types/meta-assets";

export type WizardGender = "ALL" | "MALE" | "FEMALE";

export type WizardCtaChoice =
  | "SHOP_NOW"
  | "LEARN_MORE"
  | "SIGN_UP"
  | "GET_OFFER"
  | "CALL_NOW"
  | "APPLY_NOW"
  | "GET_QUOTE"
  | "WHATSAPP_MESSAGE"
  | "SEND_MESSAGE"
  | "MESSAGE_PAGE"
  | "WATCH_MORE"
  | "NO_BUTTON"
  | "INSTALL_MOBILE_APP"
  | "USE_APP";

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

export type MetaTargetingLocationType = "country" | "region" | "city" | "zip";

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

export type CampaignDraft = {
  recipeId: CampaignRecipeId | null;
  goalAnswerId?: string;
  campaignName: string;
  dailyBudget: number;
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD

  country: GoogleLocationSelection | null;
  city?: GoogleLocationSelection | null;
  metaCountryCode: string | null;
  metaCity?: MetaTargetingLocation | null;
  metaRegion?: MetaTargetingLocation | null;
  selectedAssets: SelectedMetaAssets;
  ageMin: number;
  ageMax: number;
  gender: WizardGender;

  websiteUrl: string;
  pageId: string;
  instagramActorId?: string;
  pixelId: string;
  instantFormId?: string;
  whatsappId?: string;
  catalogId?: string;
  productSetId?: string;
  appId?: string;

  imageFile: File | null;
  primaryText: string;
  headline: string;
  description?: string;
  cta: WizardCtaChoice;
  specialAdCategory: WizardSpecialAdCategory;
  specialAdCategoryAsked: boolean;
};

/** @deprecated Use CampaignDraft */
export type WebsiteSalesDraft = CampaignDraft;

export type CampaignSubmit = Omit<CampaignDraft, "imageFile" | "goalAnswerId" | "specialAdCategoryAsked"> & {
  imageHash: string;
};

/** @deprecated Use CampaignSubmit */
export type WebsiteSalesSubmit = CampaignSubmit;

export type WizardStepId =
  | "goal"
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

export type MetaPage = { id: string; name: string; pictureUrl?: string; source?: string };

export type MetaPagesDiagnostics = {
  userAccountsCount: number;
  businessOwnedCount: number;
  businessClientCount: number;
  adAccountCount: number;
  assignedPagesCount?: number;
  pendingClientPagesCount?: number;
  creativePagesCount?: number;
  businessesScanned?: number;
  userAccountsError?: string;
  assignedPagesError?: string;
  businessPagesError?: string;
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

