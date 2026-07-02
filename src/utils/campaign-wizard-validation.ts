import type { WebsiteSalesDraft } from "@/types/campaign-wizard";

export type WizardValidationErrors = Partial<Record<keyof WebsiteSalesDraft, string>> & {
  form?: string;
};

function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateWebsiteSalesDraft(draft: WebsiteSalesDraft): WizardValidationErrors {
  const errors: WizardValidationErrors = {};

  if (!draft.campaignName.trim()) errors.campaignName = "Kampanya adı gerekli";
  if (!Number.isFinite(draft.dailyBudget) || draft.dailyBudget <= 0) {
    errors.dailyBudget = "Günlük bütçe pozitif bir sayı olmalı";
  }
  if (!draft.startDate || !isValidIsoDate(draft.startDate)) errors.startDate = "Başlangıç tarihi gerekli";
  if (draft.endDate && !isValidIsoDate(draft.endDate)) errors.endDate = "Bitiş tarihi geçersiz";
  if (draft.endDate && draft.startDate && draft.endDate < draft.startDate) {
    errors.endDate = "Bitiş tarihi başlangıçtan önce olamaz";
  }

  if (!draft.country) errors.country = "Ülke seçin";
  if (!draft.metaCountryCode?.trim()) errors.country = "Ülke doğrulanamadı";
  if (draft.city && !draft.metaCity?.key?.trim() && !draft.metaRegion?.key?.trim()) {
    errors.city = "Şehir Meta hedefleme konumuna eşlenemedi";
  }
  if (!Number.isFinite(draft.ageMin) || draft.ageMin < 13) errors.ageMin = "Minimum yaş en az 13 olmalı";
  if (!Number.isFinite(draft.ageMax) || draft.ageMax > 65) errors.ageMax = "Maksimum yaş en fazla 65 olmalı";
  if (draft.ageMin > draft.ageMax) errors.ageMax = "Maksimum yaş minimumdan küçük olamaz";

  if (!draft.websiteUrl.trim() || !isValidUrl(draft.websiteUrl)) errors.websiteUrl = "Geçerli bir Website URL girin";
  if (!draft.pageId.trim()) errors.pageId = "Facebook Page seçin";
  if (!draft.pixelId.trim()) errors.pixelId = "Pixel seçin";

  if (!draft.imageFile) errors.imageFile = "Görsel yükleyin";
  if (!draft.primaryText.trim()) errors.primaryText = "Primary Text gerekli";
  if (!draft.headline.trim()) errors.headline = "Headline gerekli";
  if (!draft.cta) errors.cta = "CTA seçin";
  if (!draft.specialAdCategory) errors.specialAdCategory = "Special Ad Category seçin";

  return errors;
}

export function validateWebsiteSalesSubmit(input: {
  imageHash: string;
}): { imageHash?: string } {
  const errors: { imageHash?: string } = {};
  if (!input.imageHash?.trim()) errors.imageHash = "Görsel yüklenmedi (image hash yok)";
  return errors;
}

export function hasErrors(errors: WizardValidationErrors): boolean {
  return Object.values(errors).some(Boolean);
}

