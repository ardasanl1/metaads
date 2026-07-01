export type MetaConnectionStatus = {
  connected: boolean;
  activeConnectionId: string | null;
  connections: MetaConnectionSummary[];
  metaUserId: string | null;
  metaUserName: string | null;
  selectedAdAccountId: string | null;
  selectedAdAccountName: string | null;
};

export type MetaConnectionSummary = {
  id: string;
  metaUserId: string | null;
  metaUserName: string | null;
  selectedAdAccountId: string;
  selectedAdAccountName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  displayName?: string;
};

export type Business = {
  id: string;
  name: string;
};

export type AdAccount = {
  id: string;
  accountId: string;
  name: string;
  connectionId: string;
  account_status?: number;
  currency?: string;
};

export type MetaAction = {
  action_type: string;
  value: string;
};

export type MetaInsightRaw = {
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  frequency?: string;
  actions?: MetaAction[];
  action_values?: MetaAction[];
  purchase_roas?: MetaAction[];
  date_start?: string;
  date_stop?: string;
};

export type ParsedInsights = {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  cpc: number;
  cpm: number;
  ctr: number;
  frequency: number;
  purchases: number;
  purchaseValue: number;
  roas: number;
};

export type CampaignBase = {
  id: string;
  name: string;
  objective: string;
  status: string;
  effective_status: string;
  created_time: string;
  updated_time: string;
  daily_budget?: string;
  lifetime_budget?: string;
};

export type CampaignWithInsights = CampaignBase & {
  insights: ParsedInsights;
};

export type DateRangePreset =
  | "today"
  | "yesterday"
  | "last_7d"
  | "last_30d"
  | "this_month"
  | "custom";

export type QuickDateFilter =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "this_month";

export type CampaignSortField = "spend" | "roas" | "ctr" | "purchases" | "budget";
export type SortDirection = "asc" | "desc";

export type CampaignFilters = {
  search: string;
  status: string;
  objective: string;
  quickDateFilter: QuickDateFilter;
  since: string;
  until: string;
};

export type ApiErrorResponse = {
  error?: string;
};
