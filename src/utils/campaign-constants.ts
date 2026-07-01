export const CAMPAIGN_OBJECTIVES = [
  { value: "OUTCOME_AWARENESS", label: "Awareness" },
  { value: "OUTCOME_TRAFFIC", label: "Traffic" },
  { value: "OUTCOME_ENGAGEMENT", label: "Engagement" },
  { value: "OUTCOME_LEADS", label: "Leads" },
  { value: "OUTCOME_APP_PROMOTION", label: "App Promotion" },
  { value: "OUTCOME_SALES", label: "Sales" },
] as const;

export const BUYING_TYPES = [
  { value: "AUCTION", label: "Auction" },
  { value: "RESERVED", label: "Reserved" },
] as const;

export const SPECIAL_AD_CATEGORIES = [
  { value: "NONE", label: "Yok" },
  { value: "EMPLOYMENT", label: "Employment" },
  { value: "HOUSING", label: "Housing" },
  { value: "CREDIT", label: "Credit" },
  { value: "ISSUES_ELECTIONS_POLITICS", label: "Issues, Elections or Politics" },
] as const;

export const CAMPAIGN_STATUSES = [
  { value: "PAUSED", label: "Duraklatılmış" },
  { value: "ACTIVE", label: "Aktif" },
] as const;

export type CampaignObjective = (typeof CAMPAIGN_OBJECTIVES)[number]["value"];
export type BuyingType = (typeof BUYING_TYPES)[number]["value"];
export type SpecialAdCategory = (typeof SPECIAL_AD_CATEGORIES)[number]["value"];
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number]["value"];
