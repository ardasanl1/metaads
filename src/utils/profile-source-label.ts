export function profileSourceLabel(source?: string): string {
  const map: Record<string, string> = {
    direct_promote_pages: "Meta varlıklarından bulundu",
    direct_user_accounts: "Meta varlıklarından bulundu",
    direct_business: "Meta varlıklarından bulundu",
    direct_adspixels: "Meta varlıklarından bulundu",
    historical_creative: "Mevcut reklamlardan bulundu",
    historical_adset: "Mevcut reklam setlerinden bulundu",
    custom_conversion: "Custom conversion üzerinden bulundu",
    historical_ad: "Mevcut reklamlardan bulundu",
    manual: "Manuel olarak tanımlandı",
  };
  return map[source ?? ""] ?? "Bilinmeyen kaynak";
}
