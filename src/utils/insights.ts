import type { MetaAction, MetaInsightRaw, ParsedInsights } from "@/types/meta";
import { META_PURCHASE_ACTION_TYPES } from "@/utils/meta-constants";

function parseNumber(value?: string): number {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sumActions(actions: MetaAction[] | undefined, types: readonly string[]): number {
  if (!actions?.length) return 0;
  return actions
    .filter((action) => types.includes(action.action_type))
    .reduce((sum, action) => sum + parseNumber(action.value), 0);
}

export function parseMetaInsights(raw?: MetaInsightRaw | null): ParsedInsights {
  if (!raw) {
    return {
      spend: 0,
      impressions: 0,
      reach: 0,
      clicks: 0,
      cpc: 0,
      cpm: 0,
      ctr: 0,
      frequency: 0,
      purchases: 0,
      purchaseValue: 0,
      roas: 0,
    };
  }

  const purchases = sumActions(raw.actions, META_PURCHASE_ACTION_TYPES);
  const purchaseValue = sumActions(raw.action_values, META_PURCHASE_ACTION_TYPES);

  let roas = 0;
  if (raw.purchase_roas?.length) {
    const roasEntry = raw.purchase_roas.find((entry) =>
      META_PURCHASE_ACTION_TYPES.some((type) => entry.action_type.includes(type)),
    );
    roas = parseNumber(roasEntry?.value);
  } else if (raw.spend && purchaseValue > 0) {
    const spend = parseNumber(raw.spend);
    roas = spend > 0 ? purchaseValue / spend : 0;
  }

  return {
    spend: parseNumber(raw.spend),
    impressions: parseNumber(raw.impressions),
    reach: parseNumber(raw.reach),
    clicks: parseNumber(raw.clicks),
    cpc: parseNumber(raw.cpc),
    cpm: parseNumber(raw.cpm),
    ctr: parseNumber(raw.ctr),
    frequency: parseNumber(raw.frequency),
    purchases,
    purchaseValue,
    roas,
  };
}
