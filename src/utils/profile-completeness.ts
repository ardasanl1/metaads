export function profileIsCompleteForRecipe(
  profile: {
    defaultPageId?: string;
    defaultPixelId?: string;
    defaultWebsiteUrl?: string;
  },
  needs: { page?: boolean; pixel?: boolean; website?: boolean },
): boolean {
  if (needs.page && !profile.defaultPageId) return false;
  if (needs.pixel && !profile.defaultPixelId) return false;
  if (needs.website && !profile.defaultWebsiteUrl) return false;
  return true;
}
