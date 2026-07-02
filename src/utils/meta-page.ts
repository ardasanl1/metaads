import type { MetaPageOption } from "@/types/meta-assets";

export function isMissingPageDisplayName(id: string, name?: string): boolean {
  const trimmed = name?.trim();
  if (!trimmed) return true;
  return trimmed === id || /^\d{10,}$/.test(trimmed);
}

export function formatPageOptionLabel(page: Pick<MetaPageOption, "id" | "name" | "username">): string {
  if (!isMissingPageDisplayName(page.id, page.name)) {
    return page.name.trim();
  }
  const username = page.username?.trim().replace(/^@/, "");
  if (username && !/^\d{10,}$/.test(username)) {
    return `@${username}`;
  }
  return page.name?.trim() || page.id;
}
