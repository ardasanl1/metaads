export type MetaAssetKind =
  | "location"
  | "page"
  | "instagram"
  | "pixel"
  | "instantForm"
  | "whatsapp"
  | "catalog"
  | "productSet"
  | "app";

export type MetaLocationType = "country" | "region" | "city" | "zip";

export type MetaLocationOption = {
  key: string;
  name: string;
  type: MetaLocationType;
  countryCode: string;
  countryName?: string;
  regionName?: string;
  displayName: string;
};

export type MetaPageOption = {
  id: string;
  name: string;
  pictureUrl?: string;
  source:
    | "user"
    | "business_owned"
    | "business_client"
    | "ad_account"
    | "assigned_user"
    | "pending_client"
    | "existing_creative";
};

export type MetaInstagramOption = {
  id: string;
  username?: string;
  name?: string;
  profilePictureUrl?: string;
  pageId?: string;
  pageName?: string;
};

export type MetaPixelOption = {
  id: string;
  name: string;
  lastFiredTime?: string;
  source: "ad_account" | "business";
  available: boolean;
};

export type MetaInstantFormOption = { id: string; name: string };
export type MetaWhatsAppOption = { id: string; name: string; pageId?: string };
export type MetaCatalogOption = { id: string; name: string };
export type MetaProductSetOption = { id: string; name: string; catalogId?: string };
export type MetaAppOption = { id: string; name: string };

export type MetaAssetDiagnostics = {
  adAccount: {
    accessible: boolean;
    normalizedId?: string;
    reason?: string;
  };
  locations: {
    available: boolean;
    reason?: string;
  };
  pages: {
    requestSucceeded: boolean;
    count: number;
    reason?: string;
  };
  instagram: {
    requestSucceeded: boolean;
    count: number;
    reason?: string;
  };
  pixels: {
    requestSucceeded: boolean;
    count: number;
    reason?: string;
  };
  missingPermissions: string[];
};

export type ResolvedMetaAssets = {
  locations: MetaLocationOption[];
  pages: MetaPageOption[];
  instagramAccounts: MetaInstagramOption[];
  pixels: MetaPixelOption[];
  instantForms: MetaInstantFormOption[];
  whatsappAccounts: MetaWhatsAppOption[];
  catalogs: MetaCatalogOption[];
  productSets: MetaProductSetOption[];
  apps: MetaAppOption[];
  diagnostics: MetaAssetDiagnostics;
  autoSelected?: SelectedMetaAssets;
};

export type SelectedMetaAssets = {
  location?: {
    key: string;
    type: MetaLocationType;
    displayName: string;
    countryCode: string;
  };
  page?: { id: string; name: string };
  instagram?: { id: string; username?: string; name?: string };
  pixel?: { id: string; name: string };
  instantForm?: { id: string; name: string };
  catalog?: { id: string; name: string };
  productSet?: { id: string; name: string };
};

export type ResolveMetaAssetsInput = {
  connectionId: string;
  businessId?: string;
  adAccountId: string;
  recipeId: string;
  locationQuery?: string;
  countryCode?: string;
  pageId?: string;
};
