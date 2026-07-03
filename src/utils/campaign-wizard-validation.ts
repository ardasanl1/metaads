import { getCampaignRecipe } from "@/config/campaign-recipes";
import type { CampaignDraft, CampaignSubmit } from "@/types/campaign-wizard";

export type WizardValidationErrors = Partial<Record<keyof CampaignDraft, string>> & {
  form?: string;
  recipeId?: string;
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

export function validateCampaignDraft(draft: CampaignDraft): WizardValidationErrors {
  const errors: WizardValidationErrors = {};

  if (!draft.recipeId) errors.recipeId = "Kampanya hedefi seçin";

  const recipe = draft.recipeId ? getCampaignRecipe(draft.recipeId) : null;

  if (!Number.isFinite(draft.dailyBudget) || draft.dailyBudget <= 0) {
    errors.dailyBudget = "Günlük bütçe pozitif bir sayı olmalı";
  }
  if (!draft.startDate || !isValidIsoDate(draft.startDate)) errors.startDate = "Başlangıç tarihi gerekli";
  if (draft.endDate && !isValidIsoDate(draft.endDate)) errors.endDate = "Bitiş tarihi geçersiz";
  if (draft.endDate && draft.startDate && draft.endDate < draft.startDate) {
    errors.endDate = "Bitiş tarihi başlangıçtan önce olamaz";
  }

  if (!draft.selectedAssets.location?.key?.trim()) {
    errors.city = "Meta hedefleme konumunu listeden seçin";
  }

  if (!Number.isFinite(draft.ageMin) || draft.ageMin < 13) errors.ageMin = "Minimum yaş en az 13 olmalı";
  if (!Number.isFinite(draft.ageMax) || draft.ageMax > 65) errors.ageMax = "Maksimum yaş en fazla 65 olmalı";
  if (draft.ageMin > draft.ageMax) errors.ageMax = "Maksimum yaş minimumdan küçük olamaz";

  if (recipe?.requiredUserFields.includes("websiteUrl")) {
    if (!draft.websiteUrl.trim() || !isValidUrl(draft.websiteUrl)) {
      errors.websiteUrl = "Geçerli bir Website URL girin";
    }
  }

  if (recipe?.requiredAssets.includes("page")) {
    if (!draft.selectedAssets.page?.id?.trim() && !draft.pageId.trim()) {
      errors.pageId = "Facebook Page seçin";
    }
  }

  if (recipe?.requiredAssets.includes("pixel")) {
    if (!draft.selectedAssets.pixel?.id?.trim() && !draft.pixelId.trim()) {
      errors.pixelId = "Pixel seçin";
    }
  }

  if (recipe?.requiredAssets.includes("instantForm")) {
    if (!draft.selectedAssets.instantForm?.id?.trim() && !draft.instantFormId?.trim()) {
      errors.instantFormId = "Meta formu seçin";
    }
  }

  if (recipe?.requiredAssets.includes("whatsapp")) {
    if (!draft.selectedAssets.whatsapp?.id?.trim() && !draft.whatsappId?.trim()) {
      errors.whatsappId = "WhatsApp hesabı seçin";
    }
  }

  if (recipe?.requiredAssets.includes("instagram")) {
    if (!draft.selectedAssets.instagram?.id?.trim() && !draft.instagramActorId?.trim()) {
      errors.instagramActorId = "Instagram hesabı seçin";
    }
  }

  if (recipe?.requiredAssets.includes("catalog")) {
    if (!draft.selectedAssets.catalog?.id?.trim() && !draft.catalogId?.trim()) {
      errors.catalogId = "Katalog seçin";
    }
  }

  if (recipe?.requiredAssets.includes("app")) {
    if (!draft.selectedAssets.app?.id?.trim() && !draft.appId?.trim()) {
      errors.appId = "Uygulama seçin";
    }
  }

  if (!draft.imageFile) errors.imageFile = "Görsel yükleyin";
  if (!draft.primaryText.trim()) errors.primaryText = "Reklam metni gerekli";
  if (!draft.headline.trim()) errors.headline = "Başlık gerekli";
  if (!draft.cta) errors.cta = "CTA seçin";

  if (draft.specialAdCategoryAsked && !draft.specialAdCategory) {
    errors.specialAdCategory = "Özel reklam kategorisi seçin";
  }

  return errors;
}

/** @deprecated Use validateCampaignDraft */
export const validateWebsiteSalesDraft = validateCampaignDraft;

export function validateCampaignSubmit(input: CampaignSubmit): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.imageHash?.trim()) errors.imageHash = "Görsel yüklenmedi (image hash yok)";
  if (!input.recipeId) errors.recipeId = "Recipe seçilmedi";
  return errors;
}

/** @deprecated Use validateCampaignSubmit */
export const validateWebsiteSalesSubmit = validateCampaignSubmit;

export function hasErrors(errors: WizardValidationErrors): boolean {
  return Object.values(errors).some(Boolean);
}
