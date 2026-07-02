export type BusinessRelationship = "owned" | "client" | "ad_account_field";

export type BusinessDiscoveryMatch = {
  businessId: string;
  businessName: string;
  relationship: BusinessRelationship;
};

export type BusinessDiscoveryError = {
  step: string;
  businessId?: string;
  code?: number;
  type?: string;
  message: string;
};

export type BusinessDiscoveryBusinessSummary = {
  id: string;
  name: string;
  ownedAdAccountCount: number;
  clientAdAccountCount: number;
  matched: boolean;
};

export type BusinessDiscoveryResult = {
  success: boolean;
  tokenUser: {
    id: string;
    name: string;
  };
  permissions: {
    granted: string[];
    declined: string[];
  };
  businessesFound: number;
  businesses: BusinessDiscoveryBusinessSummary[];
  normalizedAdAccountId: string;
  matchedBusinesses: Array<{
    id: string;
    name: string;
    relationship: BusinessRelationship;
  }>;
  matches: BusinessDiscoveryMatch[];
  errors: BusinessDiscoveryError[];
};
