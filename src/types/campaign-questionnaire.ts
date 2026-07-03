import type { CampaignRecipeId } from "@/config/campaign-recipes";
import type { WizardCtaChoice, WizardGender, WizardSpecialAdCategory } from "@/types/campaign-wizard";
import type { SelectedMetaAssets } from "@/types/meta-assets";

export type PixelResolution =
  | {
      status: "available";
      pixelId: string;
      pixelName: string;
    }
  | {
      status: "not_required";
    }
  | {
      status: "missing_fallback_available";
    }
  | {
      status: "missing_blocking";
    };

export type BusinessGoalId =
  | "brand_awareness"
  | "website_traffic"
  | "engagement"
  | "messages"
  | "leads"
  | "website_sales"
  | "catalog_sales"
  | "app";

export type ConversionDestinationId =
  | "website"
  | "meta_form"
  | "whatsapp"
  | "instagram"
  | "messenger"
  | "phone_call"
  | "app"
  | "catalog"
  | "facebook_post"
  | "video";

export type DesiredResultId =
  | "purchase"
  | "lead_submit"
  | "conversation"
  | "phone_call"
  | "landing_page_view"
  | "link_click"
  | "post_engagement"
  | "video_view"
  | "reach"
  | "impressions"
  | "app_install";

export type SelectedMetaLocation = {
  key: string;
  name: string;
  type: "country" | "region" | "city" | "zip";
  countryCode: string;
  countryName?: string;
  regionName?: string;
  displayName: string;
};

export type MediaDraft = {
  file: File | null;
  imageHash?: string;
  format: "image" | "video";
};

export type CampaignQuestionnaireAnswers = {
  businessGoal: BusinessGoalId | "";
  conversionDestination: ConversionDestinationId | "";
  desiredResult: DesiredResultId | "";
  dailyBudget: number;
  startDate: string;
  endDate?: string;
  audience: {
    locations: SelectedMetaLocation[];
    ageMin: number;
    ageMax: number;
    genders: WizardGender[];
  };
  creative: {
    media: MediaDraft[];
    primaryText: string;
    headline: string;
    description?: string;
    destinationUrl?: string;
    cta?: WizardCtaChoice;
  };
  specialAdCategoryConfirmed: boolean;
  specialAdCategories: WizardSpecialAdCategory[];
  followUpAnswers: Record<string, string>;
  selectedAssets: SelectedMetaAssets;
  /** Website Sales + Pixel yokken TRAFFIC_WEBSITE fallback onayı */
  salesTrafficFallbackAccepted?: boolean;
  campaignName?: string;
  adSetName?: string;
  adName?: string;
};

export type ResolvedCampaignPlan = {
  recipeId: CampaignRecipeId;
  /** Kullanıcının seçtiği orijinal recipe (fallback öncesi) */
  baseRecipeId: CampaignRecipeId;
  effectiveRecipeId: CampaignRecipeId;
  recipeEnabled: boolean;

  businessGoalLabel: string;
  conversionDestinationLabel: string;
  performanceGoalLabel: string;

  audience: {
    locations: SelectedMetaLocation[];
    ageMin: number;
    ageMax: number;
    genders: string[];
  };

  pixelResolution: PixelResolution;

  campaign: {
    name: string;
    objective: string;
    buyingType: string;
    specialAdCategories: string[];
    budgetLevel: "campaign" | "adset";
    status: "PAUSED";
  };

  adSet: {
    name: string;
    conversionLocation: string;
    destinationType?: string;
    performanceGoal: string;
    optimizationGoal: string;
    billingEvent: string;
    bidStrategy: string;
    dailyBudget: number;
    startTime?: string;
    endTime?: string;
    promotedObject?: Record<string, unknown>;
    conversionEvent?: string;
    attributionSettings?: Record<string, unknown>;
    placements: Record<string, unknown>;
    targeting: Record<string, unknown>;
    status: "PAUSED";
  };

  creative: {
    name: string;
    identity: Record<string, unknown>;
    format: string;
    callToAction: WizardCtaChoice;
    destinationUrl?: string;
    primaryText: string;
    headline: string;
    description?: string;
  };

  ad: {
    name: string;
    status: "PAUSED";
  };

  requiredAssets: string[];
  automaticallySelectedAssets: string[];
  unresolvedFields: string[];
  explanation: string[];
};

export type SurveyQuestionId =
  | "business_goal"
  | "conversion_destination"
  | "desired_result"
  | "lead_collection_method"
  | "video_priority"
  | "budget"
  | "audience"
  | "creative"
  | "special_category"
  | "assets"
  | "review";

export type SurveyOption = {
  id: string;
  label: string;
};

export type SurveyQuestion = {
  id: SurveyQuestionId;
  title: string;
  description?: string;
  type: "single_choice" | "form";
  options?: SurveyOption[];
};
