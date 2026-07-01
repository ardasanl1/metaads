export const META_PURCHASE_ACTION_TYPES = [
  "purchase",
  "offsite_conversion.fb_pixel_purchase",
  "omni_purchase",
] as const;

export const LOCAL_STORAGE_KEYS = {
  SELECTED_BUSINESS_ID: "meta-panel-selected-business-id",
  SELECTED_AD_ACCOUNT_ID: "meta-panel-selected-ad-account-id",
  ACTIVE_CONNECTION_ID: "meta-panel-active-connection-id",
} as const;

export const CAMPAIGN_PAGE_SIZE = 100;
export const INSIGHTS_DEFAULT_DATE_PRESET = "last_7d";
