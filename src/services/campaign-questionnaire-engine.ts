import type { CampaignRecipeId } from "@/config/campaign-recipes";
import { getCampaignRecipe, isRecipeEnabled, normalizeRecipeId } from "@/config/campaign-recipes";
import type {
  BusinessGoalId,
  CampaignQuestionnaireAnswers,
  ConversionDestinationId,
  DesiredResultId,
  SurveyQuestion,
  SurveyQuestionId,
} from "@/types/campaign-questionnaire";

export const BUSINESS_GOAL_OPTIONS = [
  { id: "brand_awareness" as const, label: "Daha fazla kişi markamı görsün" },
  { id: "website_traffic" as const, label: "Web sitem daha fazla ziyaret edilsin" },
  { id: "engagement" as const, label: "Gönderim veya videom etkileşim alsın" },
  { id: "messages" as const, label: "İnsanlar bana mesaj atsın" },
  { id: "leads" as const, label: "Potansiyel müşteri bilgisi toplamak istiyorum" },
  { id: "website_sales" as const, label: "İnternet sitemden satış yapmak istiyorum" },
  { id: "catalog_sales" as const, label: "Katalog ürünlerimi satmak istiyorum" },
  { id: "app" as const, label: "Uygulamam indirilsin veya kullanılsın" },
];

const DESTINATION_LABELS: Record<ConversionDestinationId, string> = {
  website: "İnternet sitesi",
  meta_form: "Meta hızlı formu",
  whatsapp: "WhatsApp",
  instagram: "Instagram mesajları",
  messenger: "Messenger",
  phone_call: "Telefon araması",
  app: "Mobil uygulama",
  catalog: "Ürün kataloğu",
  facebook_post: "Facebook veya Instagram gönderisi",
  video: "Video",
};

const DESIRED_RESULT_LABELS: Record<DesiredResultId, string> = {
  purchase: "Satın alma",
  lead_submit: "Form gönderimi",
  conversation: "Mesajlaşma konuşması",
  phone_call: "Telefon araması",
  landing_page_view: "Landing page görüntüleme",
  link_click: "Link tıklaması",
  post_engagement: "Gönderi etkileşimi",
  video_view: "Video görüntüleme",
  reach: "Erişim",
  impressions: "Gösterim",
  app_install: "Uygulama yükleme",
};

export function getDestinationOptionsForGoal(goal: BusinessGoalId): ConversionDestinationId[] {
  switch (goal) {
    case "brand_awareness":
      return ["facebook_post"];
    case "website_traffic":
      return ["website"];
    case "engagement":
      return ["facebook_post", "video"];
    case "messages":
      return ["whatsapp", "instagram", "messenger"];
    case "leads":
      return ["meta_form", "website", "whatsapp", "instagram", "messenger", "phone_call"];
    case "website_sales":
      return ["website"];
    case "catalog_sales":
      return ["catalog"];
    case "app":
      return ["app"];
    default:
      return [];
  }
}

export function getDesiredResultOptions(
  goal: BusinessGoalId,
  destination: ConversionDestinationId,
): DesiredResultId[] {
  if (goal === "website_sales" || (goal === "catalog_sales" && destination === "catalog")) {
    return ["purchase"];
  }
  if (goal === "website_traffic" && destination === "website") {
    return ["landing_page_view", "link_click"];
  }
  if (goal === "leads" && destination === "website") {
    return ["lead_submit"];
  }
  if (goal === "leads" && destination === "meta_form") {
    return ["lead_submit"];
  }
  if (goal === "leads" && destination === "phone_call") {
    return ["phone_call"];
  }
  if (goal === "messages" || (goal === "leads" && ["whatsapp", "instagram", "messenger"].includes(destination))) {
    return ["conversation"];
  }
  if (goal === "engagement" && destination === "facebook_post") {
    return ["post_engagement"];
  }
  if (goal === "engagement" && destination === "video") {
    return ["video_view", "reach"];
  }
  if (goal === "brand_awareness") {
    return ["reach", "impressions"];
  }
  if (goal === "app") {
    return ["app_install"];
  }
  return ["reach"];
}

export function needsLeadCollectionFollowUp(answers: CampaignQuestionnaireAnswers): boolean {
  return answers.businessGoal === "leads" && !answers.conversionDestination;
}

export function needsVideoPriorityFollowUp(answers: CampaignQuestionnaireAnswers): boolean {
  return (
    answers.businessGoal === "engagement" &&
    answers.conversionDestination === "video" &&
    answers.desiredResult === "video_view" &&
    !answers.followUpAnswers.video_priority
  );
}

export function shouldShowDestinationQuestion(answers: CampaignQuestionnaireAnswers): boolean {
  if (!answers.businessGoal) return false;
  const options = getDestinationOptionsForGoal(answers.businessGoal);
  if (options.length <= 1) return false;
  if (answers.businessGoal === "leads" && answers.followUpAnswers.lead_collection_method) return false;
  return !answers.conversionDestination;
}

export function shouldShowDesiredResultQuestion(answers: CampaignQuestionnaireAnswers): boolean {
  if (!answers.businessGoal) return false;
  const destination =
    answers.conversionDestination ||
    inferSingleDestination(answers.businessGoal) ||
    (answers.followUpAnswers.lead_collection_method as ConversionDestinationId | undefined);
  if (!destination) return false;
  const options = getDesiredResultOptions(answers.businessGoal, destination);
  return options.length > 1 && !answers.desiredResult;
}

function inferSingleDestination(goal: BusinessGoalId): ConversionDestinationId | null {
  const options = getDestinationOptionsForGoal(goal);
  return options.length === 1 ? options[0] : null;
}

export function resolveRecipeFromAnswers(answers: CampaignQuestionnaireAnswers): CampaignRecipeId | null {
  const goal = answers.businessGoal;
  if (!goal) return null;

  let destination =
    answers.conversionDestination ||
    inferSingleDestination(goal) ||
    (answers.followUpAnswers.lead_collection_method as ConversionDestinationId | undefined);

  if (goal === "leads" && answers.followUpAnswers.lead_collection_method) {
    destination = answers.followUpAnswers.lead_collection_method as ConversionDestinationId;
  }

  const desired = answers.desiredResult;

  if (goal === "brand_awareness") {
    return desired === "impressions" ? "AWARENESS_REACH" : "AWARENESS_REACH";
  }

  if (goal === "website_traffic") return "TRAFFIC_WEBSITE";

  if (goal === "website_sales") return "SALES_WEBSITE";

  if (goal === "catalog_sales") return "SALES_CATALOG";

  if (goal === "app") return "APP_INSTALL";

  if (goal === "messages") {
    if (destination === "whatsapp") return "LEAD_WHATSAPP";
    if (destination === "instagram") return "LEAD_INSTAGRAM_MESSAGES";
    if (destination === "messenger") return "LEAD_MESSENGER";
    return null;
  }

  if (goal === "leads") {
    if (destination === "meta_form") return "LEAD_INSTANT_FORM";
    if (destination === "website") return "LEAD_WEBSITE";
    if (destination === "whatsapp") return "LEAD_WHATSAPP";
    if (destination === "instagram") return "LEAD_INSTAGRAM_MESSAGES";
    if (destination === "messenger") return "LEAD_MESSENGER";
    if (destination === "phone_call") return "LEAD_CALLS";
    return null;
  }

  if (goal === "engagement") {
    if (destination === "facebook_post") return "ENGAGEMENT_POST";
    if (destination === "video") {
      if (!answers.followUpAnswers.video_priority) return null;
      if (answers.followUpAnswers.video_priority === "reach") return "AWARENESS_VIDEO";
      return "ENGAGEMENT_VIDEO";
    }
    return "ENGAGEMENT_POST";
  }

  return null;
}

export function buildSurveyFlow(answers: CampaignQuestionnaireAnswers): SurveyQuestion[] {
  const flow: SurveyQuestion[] = [
    {
      id: "business_goal",
      title: "Bu reklamdan ne elde etmek istiyorsunuz?",
      type: "single_choice",
      options: BUSINESS_GOAL_OPTIONS.map((o) => ({ id: o.id, label: o.label })),
    },
  ];

  const goal = answers.businessGoal as BusinessGoalId | "";
  if (!goal) return flow;

  if (goal === "leads") {
    flow.push({
      id: "lead_collection_method",
      title: "Bilgiler nerede toplanacak?",
      type: "single_choice",
      options: getDestinationOptionsForGoal("leads").map((id) => ({
        id,
        label: DESTINATION_LABELS[id],
      })),
    });
  } else {
    const destinations = getDestinationOptionsForGoal(goal);
    if (destinations.length > 1) {
      flow.push({
        id: "conversion_destination",
        title: "İnsanlar işlemi nerede gerçekleştirecek?",
        type: "single_choice",
        options: destinations.map((id) => ({ id, label: DESTINATION_LABELS[id] })),
      });
    }
  }

  const destination =
    answers.conversionDestination ||
    inferSingleDestination(goal) ||
    (answers.followUpAnswers.lead_collection_method as ConversionDestinationId | undefined);

  if (destination) {
    const results = getDesiredResultOptions(goal, destination);
    if (goal === "engagement" && destination === "video") {
      flow.push({
        id: "video_priority",
        title: "Önceliğiniz hangisi?",
        type: "single_choice",
        options: [
          { id: "reach", label: "Videonun mümkün olduğunca fazla kişiye ulaşması" },
          { id: "engagement", label: "İnsanların videoyu daha uzun izlemesi ve etkileşim kurması" },
        ],
      });
    } else if (results.length > 1) {
      flow.push({
        id: "desired_result",
        title: "En önemli sonuç nedir?",
        type: "single_choice",
        options: results.map((id) => ({ id, label: DESIRED_RESULT_LABELS[id] })),
      });
    }
  }

  const recipeId = resolveRecipeFromAnswers(answers);
  if (!recipeId) return flow;

  flow.push(
    { id: "budget", title: "Günlük bütçeniz ve reklam süreniz nedir?", type: "form" },
    { id: "audience", title: "Reklamı kimlere göstermek istiyorsunuz?", type: "form" },
  );

  const recipe = getCampaignRecipe(recipeId);
  if (recipe?.requiredAssets.some((a) => a !== "location")) {
    flow.push({
      id: "assets",
      title: "Gerekli Meta hesaplarını seçin",
      description: "Tek seçenek varsa otomatik seçilir.",
      type: "form",
    });
  }

  flow.push(
    { id: "creative", title: "Reklamda ne kullanacaksınız?", type: "form" },
    {
      id: "special_category",
      title: "Bu reklam kredi, istihdam, konut, sosyal konular, seçimler veya siyaset ile ilgili mi?",
      type: "single_choice",
      options: [
        { id: "no", label: "Hayır" },
        { id: "yes", label: "Evet" },
      ],
    },
    { id: "review", title: "Reklam planı özeti", type: "form" },
  );

  return flow;
}

export function canProceedFromQuestion(
  questionId: SurveyQuestionId,
  answers: CampaignQuestionnaireAnswers,
): boolean {
  switch (questionId) {
    case "business_goal":
      return Boolean(answers.businessGoal);
    case "lead_collection_method":
      return Boolean(answers.followUpAnswers.lead_collection_method);
    case "conversion_destination":
      return Boolean(answers.conversionDestination);
    case "desired_result":
      return Boolean(answers.desiredResult);
    case "video_priority":
      return Boolean(answers.followUpAnswers.video_priority);
    case "budget":
      return answers.dailyBudget > 0 && Boolean(answers.startDate?.trim());
    case "audience":
      return answers.audience.locations.length > 0;
    case "assets": {
      const recipeId = resolveRecipeFromAnswers(answers);
      if (!recipeId) return false;
      const recipe = getCampaignRecipe(recipeId);
      if (!recipe) return false;
      const assets = answers.selectedAssets;
      if (recipe.requiredAssets.includes("page") && !assets.page?.id) return false;
      if (recipe.requiredAssets.includes("pixel") && !assets.pixel?.id) return false;
      if (
        (recipe.requiredUserFields.includes("websiteUrl") || recipeId === "SALES_WEBSITE") &&
        !answers.creative.destinationUrl?.trim()
      ) {
        return false;
      }
      if (recipe.requiredAssets.includes("instantForm") && !assets.instantForm?.id) return false;
      if (recipe.requiredAssets.includes("whatsapp") && !assets.whatsapp?.id) return false;
      return true;
    }
    case "creative": {
      const recipeId = resolveRecipeFromAnswers(answers);
      const recipe = recipeId ? getCampaignRecipe(recipeId) : null;
      const hasMedia = Boolean(answers.creative.media[0]?.imageHash);
      const hasCopy =
        Boolean(answers.creative.primaryText.trim()) && Boolean(answers.creative.headline.trim());
      if (!hasMedia || !hasCopy) return false;
      if (recipe?.requiredUserFields.includes("websiteUrl") && !answers.creative.destinationUrl?.trim()) {
        return false;
      }
      return true;
    }
    case "special_category":
      return answers.specialAdCategoryConfirmed;
    case "review":
      return true;
    default:
      return true;
  }
}

export function getActiveSurveyQuestion(
  answers: CampaignQuestionnaireAnswers,
  currentIndex: number,
): SurveyQuestion | null {
  const flow = buildSurveyFlow(answers);
  return flow[currentIndex] ?? null;
}

export function countSurveyQuestions(answers: CampaignQuestionnaireAnswers): number {
  return buildSurveyFlow(answers).length;
}

export function isRecipeResolvable(answers: CampaignQuestionnaireAnswers): boolean {
  const id = resolveRecipeFromAnswers(answers);
  if (!id) return false;
  return isRecipeEnabled(id);
}

export function getDestinationLabel(id: ConversionDestinationId): string {
  return DESTINATION_LABELS[id];
}

export function getDesiredResultLabel(id: DesiredResultId): string {
  return DESIRED_RESULT_LABELS[id];
}

export function getBusinessGoalLabel(id: BusinessGoalId): string {
  return BUSINESS_GOAL_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

export { normalizeRecipeId };
